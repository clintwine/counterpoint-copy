/**
 * audioExporter.js
 * Offline audio renderer that mirrors the audioEngine signal chain exactly.
 * Engine reference: initAudio(), playSingleNote(), INSTRUMENT_CONFIGS
 */

import { INSTRUMENT_CONFIGS } from './audioEngine';
import { PRESET_LIBRARY_CONFIGS } from './presetLibrary';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFrequency(pitch) {
  const match = pitch?.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const [, note, octave] = match;
  const semitone = NOTE_NAMES.indexOf(note);
  const midi = (parseInt(octave) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createOfflineReverb(ctx) {
  const convolver = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 1.5);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // Exact same formula as audioEngine.createReverb()
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3) * 0.4;
    }
  }
  convolver.buffer = impulse;
  return convolver;
}

function createOfflineDelay(ctx) {
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.3; // mirrors createDelay()
  const feedback = ctx.createGain();
  feedback.gain.value = 0.4;
  delay.connect(feedback);
  feedback.connect(delay);
  return delay;
}

function createWaveShaper(ctx, amount) {
  // Exact same formula as audioEngine.createDistortion()
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

function resolveInstrumentConfig(instrumentName, customInstrumentsList = []) {
  if (instrumentName?.startsWith('custom_')) {
    const idx = parseInt(instrumentName.split('_')[1]);
    return customInstrumentsList[idx] || INSTRUMENT_CONFIGS.organ;
  }
  if (instrumentName?.startsWith('preset_')) {
    const idx = parseInt(instrumentName.split('_')[1]);
    return PRESET_LIBRARY_CONFIGS[idx] || INSTRUMENT_CONFIGS.organ;
  }
  return INSTRUMENT_CONFIGS[instrumentName] || INSTRUMENT_CONFIGS.organ;
}

/**
 * Render one note into the offline context, mirroring playSingleNote() exactly.
 */
function renderNote(ctx, note, config, volume, globalEnvelope, effectLevels, masterGain, reverbNode, reverbGain) {
  const freq = noteToFrequency(note.pitch);
  if (!freq) return;

  const tempo = 80; // passed via closure from outer function
  const startTime = Math.max(0.001, note._startTimeSec);
  const durationSec = Math.max(0.05, note._durationSec);

  // Global envelope - mirrors envelopeSettings in engine
  const attack = globalEnvelope?.attack ?? 0.02;
  const sustainLevel = globalEnvelope?.sustain ?? 0.7;
  const release = globalEnvelope?.release ?? 0.3;

  const gainNode = ctx.createGain();
  const filterNode = ctx.createBiquadFilter();

  // effectReduction matches the engine's oscGain calculation
  const effectReduction = 1 - ((effectLevels?.reverb ?? 0.3) * 0.4);

  if (config.oscillators) {
    const maxOscs = Math.min(6, config.oscillators.length);
    config.oscillators.slice(0, maxOscs).forEach(oscConfig => {
      const osc = ctx.createOscillator();
      osc.type = oscConfig?.waveform || 'sine';
      osc.frequency.value = freq * (oscConfig?.harmonic || 1);
      osc.detune.value = oscConfig?.detune || 0;

      const oscGain = ctx.createGain();
      // Exactly mirrors: (oscConfig?.gain ?? 0.5) * 0.25 * effectReduction
      oscGain.gain.value = (oscConfig?.gain ?? 0.5) * 0.25 * effectReduction;

      osc.connect(oscGain);
      oscGain.connect(filterNode);

      const totalDur = durationSec + release;
      const stopTime = Math.min(startTime + totalDur + 0.1, ctx.length / ctx.sampleRate - 0.001);
      osc.start(startTime);
      osc.stop(Math.max(startTime + 0.01, stopTime));
    });
  }

  // Filter - mirrors playSingleNote()
  filterNode.type = 'lowpass';
  filterNode.frequency.value = config.filterFreq ?? 4000;
  filterNode.Q.value = config.filterQ ?? 1;

  // Distortion - mirrors playSingleNote()
  let outputNode = filterNode;
  if (config.distortion > 0) {
    const distNode = createWaveShaper(ctx, config.distortion);
    filterNode.connect(distNode);
    outputNode = distNode;
  }

  // Envelope - mirrors playSingleNote() exactly:
  // attack → volume * 0.8
  // decay → volume * sustainLevel * 0.6
  const totalDuration = durationSec + release;
  const attackTime = Math.max(startTime + 0.001, startTime + attack);
  const decayTime = Math.max(attackTime + 0.001, startTime + attack + 0.05);
  const releaseStartTime = Math.max(decayTime + 0.001, startTime + durationSec - release);
  const releaseEndTime = Math.max(releaseStartTime + 0.001, startTime + totalDuration);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, attackTime);
  gainNode.gain.linearRampToValueAtTime(volume * sustainLevel * 0.6, decayTime);
  gainNode.gain.setValueAtTime(volume * sustainLevel * 0.6, releaseStartTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, Math.min(releaseEndTime, ctx.length / ctx.sampleRate - 0.001));

  outputNode.connect(gainNode);
  gainNode.connect(masterGain);

  // Per-instrument reverb send - mirrors playSingleNote()
  if (config.reverbAmount > 0 && reverbNode) {
    const instReverbSend = ctx.createGain();
    instReverbSend.gain.value = config.reverbAmount;
    gainNode.connect(instReverbSend);
    instReverbSend.connect(reverbNode);
  }
}

/**
 * Render all voices to a WAV blob, mirroring the live audioEngine signal chain.
 *
 * @param {Array} allVoicesData  Array of { notes, instrument, volume } objects
 * @param {number} tempo         BPM
 * @param {string} _unused       (kept for API compat)
 * @param {object} options       { effects, envelope, customInstruments }
 */
export async function renderToWav(allVoicesData, tempo, _unused, { effects, envelope, customInstruments: customInstrumentsList = [] } = {}) {
  const allNotes = allVoicesData.flatMap(v => (v.notes || []).filter(n => n?.pitch && n.beat >= 0));
  if (allNotes.length === 0) throw new Error('No valid notes to export');

  // Pre-compute absolute times for every note
  const beatsPerSec = tempo / 60;
  const beatDurationSec = 1 / beatsPerSec / 4; // one "beat unit" in seconds

  allVoicesData.forEach(v => {
    (v.notes || []).forEach(n => {
      n._startTimeSec = Math.max(0, n.beat * beatDurationSec);
      n._durationSec = Math.max(0.05, (n.duration || 1) * beatDurationSec);
    });
  });

  const maxEndSec = Math.max(...allNotes.map(n => n._startTimeSec + n._durationSec));
  const totalDuration = maxEndSec + (envelope?.release ?? 0.3) + 2.5; // reverb tail

  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);

  // ── Signal chain mirrors initAudio() exactly ──────────────────────────────

  // Compressor (same settings as engine)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -30;
  compressor.knee.value = 40;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.001;
  compressor.release.value = 0.1;
  compressor.connect(offlineCtx.destination);

  // Master gain = 0.25 (exact engine value)
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.25;
  masterGain.connect(compressor); // mirrors: masterGain → compressor

  // Reverb — mirrors: masterGain → reverbNode → reverbGain → compressor
  const reverbLevel = effects?.reverb ?? 0.3; // default matches engine's effectLevels.reverb
  const reverbNode = createOfflineReverb(offlineCtx);
  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = reverbLevel; // reverbGain.gain = effectLevels.reverb
  masterGain.connect(reverbNode);
  reverbNode.connect(reverbGain);
  reverbGain.connect(compressor);

  // Delay — mirrors: masterGain → delayNode → delayGain → compressor
  const delayLevel = effects?.delay ?? 0;
  const delayNode = createOfflineDelay(offlineCtx);
  const delayGain = offlineCtx.createGain();
  delayGain.gain.value = delayLevel;
  masterGain.connect(delayNode);
  delayNode.connect(delayGain);
  delayGain.connect(compressor);

  // Chorus — mirrors: masterGain → chorusNode → chorusGain → compressor
  const chorusLevel = effects?.chorus ?? 0;
  const chorusDelay = offlineCtx.createDelay(0.1);
  chorusDelay.delayTime.value = 0.02;
  const chorusGain = offlineCtx.createGain();
  chorusGain.gain.value = chorusLevel;
  masterGain.connect(chorusDelay);
  chorusDelay.connect(chorusGain);
  chorusGain.connect(compressor);

  // The effectLevels object used for oscGain effectReduction calculation
  const effectLevels = {
    reverb: reverbLevel,
    delay: delayLevel,
    chorus: chorusLevel,
  };

  // ── Render each voice ─────────────────────────────────────────────────────
  for (const voiceData of allVoicesData) {
    const { notes, instrument: instrumentName, volume = 1 } = voiceData;
    if (!notes?.length) continue;

    const config = resolveInstrumentConfig(instrumentName, customInstrumentsList);

    for (const note of notes) {
      if (!note?.pitch || note.beat < 0) continue;
      renderNote(offlineCtx, note, config, volume, envelope, effectLevels, masterGain, reverbNode, reverbGain);
    }
  }

  const audioBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;

  const dataSize = length * numChannels * bytesPerSample;
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
  view.setUint16(34, 16, true);
  ws(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}