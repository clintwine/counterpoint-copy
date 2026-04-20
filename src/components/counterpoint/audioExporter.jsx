import { INSTRUMENT_CONFIGS } from './audioEngine';
import { PRESET_LIBRARY_CONFIGS } from './presetLibrary';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFrequency(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 440;
  const [, note, octave] = match;
  const semitone = NOTE_NAMES.indexOf(note);
  const midi = (parseInt(octave) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createOfflineReverb(ctx) {
  const convolver = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 1.5);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3) * 0.4;
    }
  }
  convolver.buffer = impulse;
  return convolver;
}

function createOfflineDelay(ctx) {
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.4;
  delay.connect(feedback);
  feedback.connect(delay);
  return delay;
}

function createWaveShaper(ctx, amount) {
  const ws = ctx.createWaveShaper();
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  ws.curve = curve;
  ws.oversample = '4x';
  return ws;
}

// Resolve instrument name to a full config object matching audioEngine structure
function resolveInstrumentConfig(instrumentName, customInstrumentsList = []) {
  // Custom instrument by index
  if (instrumentName?.startsWith('custom_')) {
    const idx = parseInt(instrumentName.split('_')[1]);
    const inst = customInstrumentsList[idx];
    if (inst) return inst; // Return full custom instrument config
  }

  // Preset instrument by index (use PRESET_LIBRARY_CONFIGS for full config)
  if (instrumentName?.startsWith('preset_')) {
    const idx = parseInt(instrumentName.split('_')[1]);
    const p = PRESET_LIBRARY_CONFIGS[idx];
    if (p) return p;
  }

  // Built-in named instruments from audioEngine
  if (INSTRUMENT_CONFIGS && INSTRUMENT_CONFIGS[instrumentName]) {
    return INSTRUMENT_CONFIGS[instrumentName];
  }

  // Fallback to organ
  return INSTRUMENT_CONFIGS?.organ || {
    oscillators: [{ waveform: 'sine', detune: 0, gain: 0.8, harmonic: 1 }],
    attack: 0.02,
    filterFreq: 6000,
    filterQ: 1,
    distortion: 0,
    reverbAmount: 0.2
  };
}

// Render a single note to the offline context
function renderNote(ctx, note, instrument, volume, globalEnvelope, masterGain, reverbNode, reverbGain, delayNode, delayGain, tempo) {
  const freq = noteToFrequency(note.pitch);
  const startTime = Math.max(0, note.beat * (60 / tempo) / 4);
  const noteDuration = Math.max(0.05, (note.duration || 1) * (60 / tempo) / 4);
  const velocity = (note.velocity ?? 0.8) * volume;

  // Resolve oscillator configs
  const oscConfigs = instrument.oscillators || [];
  if (oscConfigs.length === 0) return;

  // Per-instrument envelope (or fall back to global)
  const attack = instrument.attack ?? globalEnvelope?.attack ?? 0.02;
  const sustainLevel = globalEnvelope?.sustain ?? 0.7;
  const release = globalEnvelope?.release ?? 0.3;

  // Build the signal chain: oscillators -> filter -> [distortion] -> gain
  const gainNode = ctx.createGain();
  const filterNode = ctx.createBiquadFilter();
  filterNode.type = 'lowpass';
  filterNode.frequency.value = instrument.filterFreq || 4000;
  filterNode.Q.value = instrument.filterQ || 1;

  const maxOscs = Math.min(6, oscConfigs.length);
  oscConfigs.slice(0, maxOscs).forEach(oscConfig => {
    const osc = ctx.createOscillator();
    osc.type = oscConfig.waveform || oscConfig.type || 'sine';
    osc.frequency.value = freq * (oscConfig.harmonic || 1);
    osc.detune.value = oscConfig.detune || 0;

    const oscGain = ctx.createGain();
    oscGain.gain.value = (oscConfig.gain ?? 0.5) * 0.25;

    osc.connect(oscGain);
    oscGain.connect(filterNode);

    const stopTime = Math.max(startTime + 0.01, startTime + noteDuration + release + 0.1);
    osc.start(startTime);
    osc.stop(Math.min(stopTime, ctx.length / ctx.sampleRate - 0.01));
  });

  // Distortion
  let outputNode = filterNode;
  if (instrument.distortion > 0) {
    const distNode = createWaveShaper(ctx, instrument.distortion);
    filterNode.connect(distNode);
    outputNode = distNode;
  }

  // Envelope
  const totalDuration = noteDuration + release;
  const attackEndTime = Math.max(startTime + 0.001, startTime + Math.min(attack, noteDuration * 0.5));
  const releaseStartTime = Math.max(attackEndTime + 0.001, startTime + noteDuration - Math.min(release, noteDuration * 0.4));
  const releaseEndTime = Math.max(releaseStartTime + 0.01, startTime + totalDuration);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(velocity * 0.8, attackEndTime);
  gainNode.gain.setValueAtTime(velocity * 0.8 * sustainLevel, releaseStartTime);
  gainNode.gain.linearRampToValueAtTime(0, releaseEndTime);

  outputNode.connect(gainNode);
  gainNode.connect(masterGain);

  // Per-instrument reverb send
  const instReverbAmount = instrument.reverbAmount ?? 0;
  if (instReverbAmount > 0 && reverbNode && reverbGain) {
    const send = ctx.createGain();
    send.gain.value = instReverbAmount;
    gainNode.connect(send);
    send.connect(reverbNode);
  }

  // Delay send
  if (delayNode && delayGain && delayGain.gain.value > 0) {
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.3;
    gainNode.connect(delaySend);
    delaySend.connect(delayNode);
  }
}

/**
 * Render all voices to a WAV blob, matching live playback as closely as possible.
 * @param {Array} allVoicesData - Array of { notes, instrument, volume } objects
 * @param {number} tempo - BPM
 * @param {string} _primaryInstrument - (unused, kept for compat)
 * @param {object} options - { effects, envelope, customInstruments }
 */
export async function renderToWav(allVoicesData, tempo, _primaryInstrument, { effects, envelope, customInstruments: customInstrumentsList = [] } = {}) {
  // Flatten all notes to calculate total duration
  const allNotes = allVoicesData.flatMap(v => (v.notes || []).filter(n => n.beat >= 0));
  if (allNotes.length === 0) throw new Error('No valid notes to export');

  const maxBeat = Math.max(...allNotes.map(n => n.beat + (n.duration || 1)));
  const duration = (maxBeat * (60 / tempo) / 4) + 3.0; // extra tail for reverb

  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);

  // Master gain (match audioEngine 0.25 * 1.2 for export loudness)
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 1.0;

  // Compressor (mirrors audioEngine)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -30;
  compressor.knee.value = 40;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  masterGain.connect(compressor);
  compressor.connect(offlineCtx.destination);

  // Global reverb
  const reverbLevel = effects?.reverb ?? 0.3;
  let reverbNode = null;
  let reverbGain = null;
  if (reverbLevel > 0) {
    reverbNode = createOfflineReverb(offlineCtx);
    reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = reverbLevel * 0.6;
    masterGain.connect(reverbGain);
    reverbGain.connect(reverbNode);
    reverbNode.connect(compressor);
  }

  // Global delay
  const delayLevel = effects?.delay ?? 0;
  let delayNode = null;
  let delayGain = null;
  if (delayLevel > 0) {
    delayNode = createOfflineDelay(offlineCtx);
    delayGain = offlineCtx.createGain();
    delayGain.gain.value = delayLevel * 0.5;
    masterGain.connect(delayGain);
    delayGain.connect(delayNode);
    delayNode.connect(compressor);
  }

  // Render each voice
  for (const voiceData of allVoicesData) {
    const { notes, instrument: instrumentName, volume = 1 } = voiceData;
    if (!notes?.length) continue;

    const instrumentConfig = resolveInstrumentConfig(instrumentName, customInstrumentsList);

    for (const note of notes) {
      if (note.beat < 0) continue;
      renderNote(offlineCtx, note, instrumentConfig, volume, envelope, masterGain, reverbNode, reverbGain, delayNode, delayGain, tempo);
    }
  }

  const audioBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = buffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, s));
      data.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF);
    }
  }

  const dataSize = data.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const ws = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  ws(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  ws(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }

  return new Blob([ab], { type: 'audio/wav' });
}