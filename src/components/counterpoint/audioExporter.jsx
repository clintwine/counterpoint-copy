import { getCustomInstruments, INSTRUMENT_CONFIGS } from './audioEngine';

function noteToFrequency(pitch) {
  const notes = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  
  const match = pitch.match(/([A-G]#?)(\d)/);
  if (!match) return 440;
  
  const [, note, octave] = match;
  const noteNumber = notes[note];
  const midiNote = (parseInt(octave) + 1) * 12 + noteNumber;
  
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Fallback instrument configurations (used if INSTRUMENT_CONFIGS not available)
const defaultInstruments = {
  organ: {
    oscillators: [
      { type: 'sine', detune: 1, gain: 0.6 },
      { type: 'sine', detune: 2, gain: 0.3 },
      { type: 'sine', detune: 3, gain: 0.2 }
    ],
    filter: null
  },
  piano: {
    oscillators: [
      { type: 'triangle', detune: 1, gain: 0.7 },
      { type: 'sine', detune: 2, gain: 0.2 }
    ],
    filter: { type: 'lowpass', frequency: 3000, Q: 1 }
  }
};

function createReverb(ctx) {
  const convolver = ctx.createConvolver();
  const rate = ctx.sampleRate;
  const length = rate * 2;
  const impulse = ctx.createBuffer(2, length, rate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }
  convolver.buffer = impulse;
  return convolver;
}

function createDelay(ctx) {
  const delay = ctx.createDelay(1.0);
  const feedback = ctx.createGain();
  const wetGain = ctx.createGain();
  
  delay.delayTime.value = 0.3;
  feedback.gain.value = 0.4;
  wetGain.gain.value = 0.5;
  
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  
  return { input: delay, output: wetGain };
}

// Resolve an instrument name to an oscillator config array for offline rendering
function resolveInstrumentConfig(instrumentName, customInstrumentsList = []) {
  // Custom instrument by index
  if (instrumentName?.startsWith('custom_')) {
    const idx = parseInt(instrumentName.split('_')[1]);
    const inst = customInstrumentsList[idx];
    if (inst?.oscillators) {
      return {
        oscillators: inst.oscillators.map(o => ({
          type: o.waveform || o.type || 'sine',
          detune: o.detune || 0,
          gain: o.gain ?? 0.5
        })),
        filter: inst.filter || null,
        envelope: inst.envelope || null
      };
    }
  }

  // Preset instrument by index
  if (instrumentName?.startsWith('preset_')) {
    const PRESET_LIBRARY = [
      { name: 'Warm Pad', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.5 }, { waveform: 'sawtooth', detune: 7, gain: 0.5 }], envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }, filter: { type: 'lowpass', frequency: 1200, Q: 0.5 } },
      { name: 'Bright Lead', oscillators: [{ waveform: 'sawtooth', detune: 0, gain: 0.7 }, { waveform: 'square', detune: 12, gain: 0.3 }], envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 }, filter: { type: 'lowpass', frequency: 4000, Q: 2 } },
      { name: 'Sub Bass', oscillators: [{ waveform: 'sine', detune: 0, gain: 1.0 }], envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 }, filter: { type: 'lowpass', frequency: 500, Q: 1 } },
      { name: 'Pluck', oscillators: [{ waveform: 'triangle', detune: 0, gain: 0.8 }, { waveform: 'square', detune: 0, gain: 0.2 }], envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 }, filter: { type: 'lowpass', frequency: 3000, Q: 1.5 } },
      { name: 'Bell', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.6 }, { waveform: 'sine', detune: 700, gain: 0.3 }, { waveform: 'sine', detune: 1200, gain: 0.1 }], envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 }, filter: { type: 'highpass', frequency: 500, Q: 0.5 } },
      { name: 'Choir', oscillators: [{ waveform: 'sawtooth', detune: -5, gain: 0.4 }, { waveform: 'sawtooth', detune: 5, gain: 0.4 }, { waveform: 'sine', detune: 0, gain: 0.2 }], envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 }, filter: { type: 'bandpass', frequency: 1500, Q: 2 } },
      { name: 'Reese Bass', oscillators: [{ waveform: 'sawtooth', detune: -10, gain: 0.5 }, { waveform: 'sawtooth', detune: 10, gain: 0.5 }], envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 }, filter: { type: 'lowpass', frequency: 800, Q: 3 } },
      { name: 'Flutey', oscillators: [{ waveform: 'sine', detune: 0, gain: 0.9 }, { waveform: 'triangle', detune: 0, gain: 0.1 }], envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 }, filter: { type: 'lowpass', frequency: 3500, Q: 0.3 } }
    ];
    const idx = parseInt(instrumentName.split('_')[1]);
    const p = PRESET_LIBRARY[idx];
    if (p) {
      return {
        oscillators: p.oscillators.map(o => ({
          type: o.waveform || o.type || 'sine',
          detune: o.detune || 0,
          gain: o.gain ?? 0.5
        })),
        filter: p.filter || null,
        envelope: p.envelope || null
      };
    }
  }

  // Try INSTRUMENT_CONFIGS from audioEngine (built-in named instruments)
  if (INSTRUMENT_CONFIGS && INSTRUMENT_CONFIGS[instrumentName]) {
    const cfg = INSTRUMENT_CONFIGS[instrumentName];
    return {
      oscillators: (cfg.oscillators || []).map(o => ({
        type: o.waveform || o.type || 'sine',
        detune: o.detune || 0,
        gain: o.gain ?? 0.5
      })),
      filter: cfg.filter || null,
      envelope: cfg.envelope || null
    };
  }

  // Fallback to hardcoded defaults
  return defaultInstruments[instrumentName] || defaultInstruments.organ;
}

export async function renderToWav(notes, tempo, instrumentName, { effects, envelope, customInstruments: customInstrumentsList } = {}) {
  // Filter out any notes with negative beats
  const validNotes = notes.filter(n => n.beat >= 0);
  
  if (validNotes.length === 0) {
    throw new Error('No valid notes to export');
  }
  
  // Calculate duration
  const maxBeat = Math.max(...validNotes.map(n => n.beat + (n.duration || 1)), 0);
  const duration = (maxBeat * (60 / tempo) / 4) + 2.5;
  
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
  
  // Resolve instrument config
  const instrument = resolveInstrumentConfig(instrumentName, customInstrumentsList || []);

  // Effect levels from session (default to subtle if not provided)
  const reverbLevel = effects?.reverb ?? 0.3;
  const delayLevel = effects?.delay ?? 0;

  // Master gain
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 1.2;
  masterGain.connect(offlineCtx.destination);

  // Reverb chain
  if (reverbLevel > 0) {
    const reverb = createReverb(offlineCtx);
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = reverbLevel * 0.6;
    masterGain.connect(reverbGain);
    reverbGain.connect(reverb);
    reverb.connect(offlineCtx.destination);
  }
  
  // Delay chain
  if (delayLevel > 0) {
    const delayEffect = createDelay(offlineCtx);
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = delayLevel * 0.5;
    masterGain.connect(delayGain);
    delayGain.connect(delayEffect.input);
    delayEffect.output.connect(offlineCtx.destination);
  }

  // Envelope settings
  const envAttack = envelope?.attack ?? 0.02;
  const envRelease = envelope?.release ?? 0.1;
  
  // Render each note
  validNotes.forEach(note => {
    const frequency = noteToFrequency(note.pitch);
    const startTime = Math.max(0, note.beat * (60 / tempo) / 4);
    const noteDuration = Math.max(0.05, (note.duration || 1) * (60 / tempo) / 4);
    const velocity = note.velocity || 0.8;
    
    const instEnv = instrument.envelope;

    instrument.oscillators.forEach(osc => {
      const oscillator = offlineCtx.createOscillator();
      const gainNode = offlineCtx.createGain();
      
      // Support both 'type' and 'waveform' keys
      oscillator.type = osc.type || osc.waveform || 'sine';

      // Detune: if > 24 treat as cents directly, otherwise as semitone multiplier
      if (osc.detune !== undefined && osc.detune !== 0) {
        if (Math.abs(osc.detune) > 24) {
          oscillator.detune.value = osc.detune; // cents
          oscillator.frequency.value = frequency;
        } else if (osc.detune < 4) {
          // Old-style harmonic multiplier (e.g. 1, 2, 3)
          oscillator.frequency.value = frequency * osc.detune;
        } else {
          oscillator.detune.value = osc.detune; // semitones as cents
          oscillator.frequency.value = frequency;
        }
      } else {
        oscillator.frequency.value = frequency;
      }
      
      // Apply filter if instrument has one
      let lastNode = gainNode;
      if (instrument.filter) {
        const filterNode = offlineCtx.createBiquadFilter();
        filterNode.type = instrument.filter.type || 'lowpass';
        filterNode.frequency.value = instrument.filter.frequency || 2000;
        filterNode.Q.value = instrument.filter.Q || 1;
        gainNode.connect(filterNode);
        lastNode = filterNode;
      }
      lastNode.connect(masterGain);
      
      // Envelope
      const attack = instEnv?.attack ?? envAttack;
      const release = instEnv?.release ?? envRelease;
      const sustainLevel = velocity * (osc.gain ?? 0.5) * 0.5;
      
      const attackEndTime = Math.max(0, startTime + Math.min(attack, noteDuration * 0.5));
      const releaseStartTime = Math.max(attackEndTime, startTime + noteDuration - Math.min(release, noteDuration * 0.4));
      const releaseEndTime = Math.max(releaseStartTime + 0.01, startTime + noteDuration + Math.min(release, 0.3));
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(sustainLevel, attackEndTime);
      gainNode.gain.setValueAtTime(sustainLevel, releaseStartTime);
      gainNode.gain.linearRampToValueAtTime(0, releaseEndTime);
      
      oscillator.connect(gainNode);
      oscillator.start(startTime);
      oscillator.stop(Math.min(releaseEndTime + 0.1, duration - 0.01));
    });
  });
  
  // Render
  const audioBuffer = await offlineCtx.startRendering();
  
  // Convert to WAV
  return audioBufferToWav(audioBuffer);
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample));
      data.push(intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF);
    }
  }
  
  const dataSize = data.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}