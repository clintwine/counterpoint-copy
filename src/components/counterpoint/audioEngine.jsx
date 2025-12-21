// Web Audio API based synthesizer for counterpoint playback

let audioContext = null;
let masterGain = null;
let reverbNode = null;
let reverbGain = null;
let delayNode = null;
let delayGain = null;
let chorusNode = null;
let chorusGain = null;
let analyser = null;

// Effect levels (0-1)
let effectLevels = {
  reverb: 0.3,
  delay: 0,
  chorus: 0
};

// Global envelope settings
let envelopeSettings = {
  attack: 0.02,
  sustain: 0.7,
  release: 0.3
};

const NOTE_FREQUENCIES = {};
const A4 = 440;
const A4_MIDI = 69;

// Pre-calculate frequencies
for (let midi = 21; midi <= 108; midi++) {
  const note = midiToNoteName(midi);
  NOTE_FREQUENCIES[note] = A4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

function midiToNoteName(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

// Create convolver reverb
async function createReverb() {
  if (!audioContext) return null;
  
  const convolver = audioContext.createConvolver();
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 1.5; // Shorter reverb to reduce CPU load
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Softer decay curve to prevent buildup and crackling
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3) * 0.4;
    }
  }
  
  convolver.buffer = impulse;
  return convolver;
}

// Create delay effect
function createDelay() {
  if (!audioContext) return null;
  
  const delay = audioContext.createDelay(1);
  delay.delayTime.value = 0.3;
  
  const feedback = audioContext.createGain();
  feedback.gain.value = 0.4;
  
  delay.connect(feedback);
  feedback.connect(delay);
  
  return delay;
}

// Create chorus effect
function createChorus() {
  if (!audioContext) return null;
  
  const delay = audioContext.createDelay(0.1);
  delay.delayTime.value = 0.02;
  
  const lfo = audioContext.createOscillator();
  lfo.frequency.value = 0.5;
  lfo.type = 'sine';
  
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 0.002;
  
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  lfo.start();
  
  return delay;
}

export async function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Add compressor to prevent clipping and crackling
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 40;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.1;

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.25; // Lower to prevent clipping
    
    // Create analyser for visualization
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.85;
    
    masterGain.connect(analyser);
    analyser.connect(compressor);
    compressor.connect(audioContext.destination);
    
    // Create effect nodes
    reverbNode = await createReverb();
    reverbGain = audioContext.createGain();
    reverbGain.gain.value = effectLevels.reverb;
    
    delayNode = createDelay();
    delayGain = audioContext.createGain();
    delayGain.gain.value = effectLevels.delay;
    
    chorusNode = createChorus();
    chorusGain = audioContext.createGain();
    chorusGain.gain.value = effectLevels.chorus;
    
    // Connect effects in parallel to master
    masterGain.connect(audioContext.destination);
    
    if (reverbNode) {
      masterGain.connect(reverbNode);
      reverbNode.connect(reverbGain);
      reverbGain.connect(compressor);
    }
    
    if (delayNode) {
      masterGain.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(compressor);
    }
    
    if (chorusNode) {
      masterGain.connect(chorusNode);
      chorusNode.connect(chorusGain);
      chorusGain.connect(compressor);
    }
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function setEffectLevel(effect, level) {
  effectLevels[effect] = level;
  if (!audioContext) return;
  
  const now = Math.max(0.001, audioContext.currentTime + 0.01);
  if (effect === 'reverb' && reverbGain) {
    reverbGain.gain.cancelScheduledValues(now);
    reverbGain.gain.setValueAtTime(reverbGain.gain.value, now);
    reverbGain.gain.linearRampToValueAtTime(level, Math.max(now + 0.05, 0.06));
  } else if (effect === 'delay' && delayGain) {
    delayGain.gain.cancelScheduledValues(now);
    delayGain.gain.setValueAtTime(delayGain.gain.value, now);
    delayGain.gain.linearRampToValueAtTime(level, Math.max(now + 0.05, 0.06));
  } else if (effect === 'chorus' && chorusGain) {
    chorusGain.gain.cancelScheduledValues(now);
    chorusGain.gain.setValueAtTime(chorusGain.gain.value, now);
    chorusGain.gain.linearRampToValueAtTime(level, Math.max(now + 0.05, 0.06));
  }
}

export function getEffectLevels() {
  return { ...effectLevels };
}

export function setEnvelope(envelope) {
  envelopeSettings = { ...envelopeSettings, ...envelope };
}

export function getEnvelope() {
  return { ...envelopeSettings };
}

export function getAudioContext() {
  return audioContext;
}

export function getAnalyser() {
  return analyser;
}

// Instrument configurations with sophisticated multi-oscillator layering
const INSTRUMENT_CONFIGS = {
  organ: {
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.8, harmonic: 2 },
      { waveform: 'sine', detune: -2, gain: 0.6, harmonic: 3 },
      { waveform: 'sine', detune: 2, gain: 0.4, harmonic: 5 }
    ],
    attack: 0.02,
    filterFreq: 3000,
    filterQ: 1.2,
    distortion: 0
  },
  distortion: {
    waveform: 'sawtooth',
    harmonics: [1, 0.8, 0.6, 0.4],
    attack: 0.005,
    filterFreq: 4000,
    filterQ: 2,
    distortion: 50
  },
  clean: {
    waveform: 'triangle',
    harmonics: [1, 0.3, 0.1],
    attack: 0.01,
    filterFreq: 3000,
    filterQ: 0.5,
    distortion: 0
  },
  bass: {
    waveform: 'sawtooth',
    harmonics: [1, 0.5],
    attack: 0.01,
    filterFreq: 800,
    filterQ: 2,
    distortion: 10
  },
  strings: {
    oscillators: [
      { waveform: 'sawtooth', detune: -5, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 5, gain: 0.5, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.3, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.2, harmonic: 3 }
    ],
    attack: 0.2,
    filterFreq: 3200,
    filterQ: 1.2,
    distortion: 0
  },
  flute: {
    waveform: 'sine',
    harmonics: [1, 0.4, 0.2, 0.1, 0.05],
    attack: 0.08,
    filterFreq: 4200,
    filterQ: 0.4,
    distortion: 0
  },
  synth: {
    waveform: 'square',
    harmonics: [1, 0.5, 0.25],
    attack: 0.01,
    filterFreq: 3000,
    filterQ: 3,
    distortion: 5
  },
  harpsichord: {
    waveform: 'sawtooth',
    harmonics: [1, 0.7, 0.4, 0.2],
    attack: 0.001,
    filterFreq: 4000,
    filterQ: 1.5,
    distortion: 0
  },
  piano: {
    oscillators: [
      { waveform: 'triangle', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.8, harmonic: 2 },
      { waveform: 'triangle', detune: -1, gain: 0.5, harmonic: 3 },
      { waveform: 'sine', detune: 1, gain: 0.3, harmonic: 4 }
    ],
    attack: 0.003,
    filterFreq: 4500,
    filterQ: 0.8,
    distortion: 2
  },
  electric: {
    waveform: 'square',
    harmonics: [1, 0.6, 0.4],
    attack: 0.01,
    filterFreq: 2500,
    filterQ: 2,
    distortion: 15
  },
  bells: {
    waveform: 'sine',
    harmonics: [1, 0.6, 0.9, 0.4, 0.25, 0.1],
    attack: 0.001,
    filterFreq: 5000,
    filterQ: 2,
    distortion: 0
  },
  brass: {
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.8, harmonic: 1 },
      { waveform: 'square', detune: -4, gain: 0.5, harmonic: 2 },
      { waveform: 'sawtooth', detune: 4, gain: 0.6, harmonic: 3 }
    ],
    attack: 0.05,
    filterFreq: 3000,
    filterQ: 3,
    distortion: 8
  },
  clarinet: {
    waveform: 'square',
    harmonics: [1, 0, 0.3, 0, 0.1],
    attack: 0.04,
    filterFreq: 2800,
    filterQ: 1,
    distortion: 0
  },
  pad: {
    oscillators: [
      { waveform: 'sawtooth', detune: -10, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 0, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 10, gain: 0.5, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.4, harmonic: 2 }
    ],
    attack: 0.4,
    filterFreq: 1500,
    filterQ: 0.3,
    distortion: 0
  },
  pluck: {
    waveform: 'triangle',
    harmonics: [1, 0.4, 0.15],
    attack: 0.001,
    filterFreq: 3500,
    filterQ: 2,
    distortion: 0
  },
  celeste: {
    waveform: 'sine',
    harmonics: [1, 0.8, 0.5, 0.3, 0.2],
    attack: 0.002,
    filterFreq: 6000,
    filterQ: 1,
    distortion: 0
  },
  trumpet: {
    waveform: 'sawtooth',
    harmonics: [1, 0.95, 0.85, 0.7, 0.6, 0.45, 0.3],
    attack: 0.04,
    filterFreq: 4500,
    filterQ: 5,
    distortion: 18
  },
  saxophone: {
    waveform: 'sawtooth',
    harmonics: [1, 0.6, 0.4, 0.3, 0.2, 0.1],
    attack: 0.06,
    filterFreq: 2500,
    filterQ: 2,
    distortion: 5
  },
  vibraphone: {
    waveform: 'sine',
    harmonics: [1, 0.7, 0.5, 0.3, 0.2, 0.15],
    attack: 0.002,
    filterFreq: 5500,
    filterQ: 1.5,
    distortion: 0
  },
  marimba: {
    waveform: 'triangle',
    harmonics: [1, 0.5, 0.3, 0.15],
    attack: 0.001,
    filterFreq: 2000,
    filterQ: 1,
    distortion: 0
  },
  choir: {
    oscillators: [
      { waveform: 'sawtooth', detune: -7, gain: 0.4, harmonic: 1 },
      { waveform: 'sawtooth', detune: 0, gain: 0.4, harmonic: 1 },
      { waveform: 'sawtooth', detune: 7, gain: 0.4, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.3, harmonic: 2 }
    ],
    attack: 0.25,
    filterFreq: 2200,
    filterQ: 0.7,
    distortion: 0
  },
  oboe: {
    waveform: 'sawtooth',
    harmonics: [1, 0.7, 0.5, 0.3, 0.2],
    attack: 0.08,
    filterFreq: 3200,
    filterQ: 2,
    distortion: 2
  },
  cello: {
    oscillators: [
      { waveform: 'sawtooth', detune: -3, gain: 0.6, harmonic: 1 },
      { waveform: 'sawtooth', detune: 3, gain: 0.6, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.4, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.25, harmonic: 3 }
    ],
    attack: 0.15,
    filterFreq: 1800,
    filterQ: 1.5,
    distortion: 1
  },
  harp: {
    waveform: 'triangle',
    harmonics: [1, 0.8, 0.6, 0.4, 0.25, 0.15, 0.08],
    attack: 0.001,
    filterFreq: 5500,
    filterQ: 1.5,
    distortion: 0
  }
};

// Custom instruments storage
let customInstruments = {};

export function registerCustomInstrument(name, config) {
  customInstruments[name] = config;
}

export function unregisterCustomInstrument(name) {
  delete customInstruments[name];
}

export function getCustomInstruments() {
  return { ...customInstruments };
}

// Play note with custom instrument support
export async function playNoteWithCustomInstrument(pitch, duration, volume, customConfig) {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return;

  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  
  // Check if this is a sampled instrument (with URL or buffer)
  if (customConfig.audioSampleUrl && !customConfig.audioSample) {
    // Load the audio buffer from URL if not already loaded
    try {
      const response = await fetch(customConfig.audioSampleUrl);
      const arrayBuffer = await response.arrayBuffer();
      customConfig.audioSample = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to load audio sample:', error);
      return;
    }
  }
  
  if (customConfig.audioSample) {
    return playSampledNote(pitch, duration, volume, customConfig);
  }
  
  const { oscillators: oscConfigs, envelope, filter: filterConfig, lfo, distortion, bitcrush } = customConfig;

  const oscillators = [];
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();

  // LFO setup
  let lfoNode = null;
  let lfoGain = null;
  if (lfo && lfo.rate > 0 && lfo.amount > 0) {
    lfoNode = audioContext.createOscillator();
    lfoNode.frequency.value = lfo.rate;
    lfoNode.type = 'sine';
    lfoGain = audioContext.createGain();
    
    // Set LFO amount based on target
    if (lfo.target === 'pitch') {
      lfoGain.gain.value = lfo.amount * 50; // Vibrato depth in cents
    } else if (lfo.target === 'filter') {
      lfoGain.gain.value = lfo.amount * 1000; // Filter modulation depth
    } else if (lfo.target === 'volume') {
      lfoGain.gain.value = lfo.amount * 0.3; // Tremolo depth
    }
    
    lfoNode.connect(lfoGain);
    lfoNode.start(now);
    lfoNode.stop(now + duration + envelope.release);
  }

  // Create oscillators from custom config (limit to first 3 for performance)
  const maxOscs = Math.min(3, oscConfigs.length);
  oscConfigs.slice(0, maxOscs).forEach(oscConfig => {
    // Ensure oscConfig has all required properties with defaults
    const safeConfig = {
      waveform: oscConfig?.waveform || 'sine',
      gain: oscConfig?.gain ?? 0.5,
      detune: oscConfig?.detune || 0,
      harmonic: oscConfig?.harmonic || 1,
      phase: oscConfig?.phase || 0
    };

    const osc = audioContext.createOscillator();
    osc.type = safeConfig.waveform;

    // Apply harmonic ratio and phase
    const harmonic = safeConfig.harmonic;
    osc.frequency.value = freq * harmonic;
    osc.detune.value = safeConfig.detune;
    
    // Apply LFO modulation
    if (lfoGain && lfo.target === 'pitch') {
      lfoGain.connect(osc.detune);
    }

    const oscGain = audioContext.createGain();
    oscGain.gain.value = safeConfig.gain * 0.3;
    
    // Apply LFO to volume if selected
    if (lfoGain && lfo.target === 'volume') {
      lfoGain.connect(oscGain.gain);
    }

    osc.connect(oscGain);
    oscGain.connect(filterNode);
    oscillators.push(osc);
  });

  // Filter
  filterNode.type = filterConfig.type || 'lowpass';
  filterNode.frequency.value = filterConfig.frequency || 2000;
  filterNode.Q.value = filterConfig.Q || 1;
  
  // Apply LFO to filter if selected
  if (lfoGain && lfo.target === 'filter') {
    lfoGain.connect(filterNode.frequency);
  }

  // Chain effects: filter -> distortion -> bitcrush -> gain
  let outputNode = filterNode;
  
  // Apply distortion
  if (distortion > 0) {
    const distortionNode = createDistortion(distortion);
    outputNode.connect(distortionNode);
    outputNode = distortionNode;
  }
  
  // Apply bitcrush
  if (bitcrush > 0) {
    const bitcrushNode = createBitcrusher(bitcrush);
    outputNode.connect(bitcrushNode);
    outputNode = bitcrushNode;
  }

  // Envelope
  const { attack, decay, sustain, release } = envelope;
  const totalDuration = duration + release;
  const attackTime = Math.max(now + 0.001, now + attack);
  const decayTime = Math.max(attackTime + 0.001, now + attack + decay);
  const releaseStartTime = Math.max(decayTime + 0.001, now + duration - release);
  const releaseEndTime = Math.max(releaseStartTime + 0.001, now + totalDuration);

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, attackTime);
  gainNode.gain.linearRampToValueAtTime(volume * sustain * 0.6, decayTime);
  gainNode.gain.setValueAtTime(volume * sustain * 0.6, releaseStartTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEndTime);

  outputNode.connect(gainNode);
  gainNode.connect(masterGain);

  const stopTime = Math.max(now + 0.01, now + totalDuration);
  oscillators.forEach(osc => {
    osc.start(now);
    osc.stop(stopTime);
  });

  return { oscillators, gainNode };
}

// Play a sampled instrument (like recorded voice)
function playSampledNote(pitch, duration, volume, customConfig) {
  const freq = NOTE_FREQUENCIES[pitch];
  const baseFreq = 440; // A4 reference
  const playbackRate = freq / baseFreq;
  
  const source = audioContext.createBufferSource();
  source.buffer = customConfig.audioSample;
  source.playbackRate.value = playbackRate;
  
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  // Apply filter settings
  const { filter: filterConfig, envelope } = customConfig;
  filterNode.type = filterConfig.type || 'lowpass';
  filterNode.frequency.value = filterConfig.frequency || 2000;
  filterNode.Q.value = filterConfig.Q || 1;
  
  // Envelope
  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  const { attack, decay, sustain, release } = envelope;
  const totalDuration = duration + release;
  const attackTime = Math.max(now + 0.001, now + attack);
  const decayTime = Math.max(attackTime + 0.001, now + attack + decay);
  const releaseStartTime = Math.max(decayTime + 0.001, now + duration - release);
  const releaseEndTime = Math.max(releaseStartTime + 0.001, now + totalDuration);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, attackTime);
  gainNode.gain.linearRampToValueAtTime(volume * sustain * 0.6, decayTime);
  gainNode.gain.setValueAtTime(volume * sustain * 0.6, releaseStartTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEndTime);
  
  source.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  const stopTime = Math.max(now + 0.01, now + totalDuration);
  source.start(now);
  source.stop(stopTime);
  
  return { oscillators: [source], gainNode };
}

function createBitcrusher(bits) {
  if (!audioContext) return null;
  const bitcrush = audioContext.createWaveShaper();
  const samples = 44100;
  const curve = new Float32Array(samples);
  const step = Math.pow(0.5, bits);
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = step * Math.floor(x / step + 0.5);
  }
  
  bitcrush.curve = curve;
  return bitcrush;
}

function createDistortion(amount) {
  if (!audioContext) return null;
  const distortion = audioContext.createWaveShaper();
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  distortion.curve = curve;
  distortion.oversample = '4x';
  return distortion;
}

// Active oscillators tracking to prevent too many at once
let activeOscillatorCount = 0;
const MAX_CONCURRENT_NOTES = 200; // Higher limit to handle complex pieces like Bach inventions

export function playNote(pitch, duration = 0.5, volume = 0.8, voiceIndex = 0, instrument = 'organ', pitchBend = 0) {
  if (!audioContext) initAudio();
  
  // Throttle to prevent audio crackling - but allow overflow for musical passages
  if (activeOscillatorCount >= MAX_CONCURRENT_NOTES) {
    console.warn('Max concurrent notes reached, some notes may not play');
    // Don't return, allow it to play anyway for musical integrity
  }
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return;
  
  const config = INSTRUMENT_CONFIGS[instrument] || INSTRUMENT_CONFIGS.organ;
  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  
  // Use global envelope settings
  const attack = envelopeSettings.attack;
  const sustainLevel = envelopeSettings.sustain;
  const release = envelopeSettings.release;
  
  // Create oscillators - support both old format (harmonics) and new format (oscillators)
  const oscillators = [];
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  if (config.oscillators) {
    // New sophisticated multi-oscillator format
    const maxOscs = Math.min(4, config.oscillators.length);
    config.oscillators.slice(0, maxOscs).forEach((oscConfig) => {
      // Ensure oscConfig has all required properties with defaults
      const safeConfig = {
        waveform: oscConfig?.waveform || 'sine',
        gain: oscConfig?.gain ?? 0.5,
        detune: oscConfig?.detune || 0,
        harmonic: oscConfig?.harmonic || 1,
        phase: oscConfig?.phase || 0
      };
      
      const osc = audioContext.createOscillator();
      osc.type = safeConfig.waveform;
      osc.frequency.value = freq * safeConfig.harmonic;
      osc.detune.value = safeConfig.detune;
    
      // Apply pitch bend envelope if provided
      if (pitchBend !== 0 || (typeof pitchBend === 'object' && pitchBend !== null)) {
        if (typeof pitchBend === 'number') {
          // Simple constant bend
          osc.detune.value = pitchBend * 100;
        } else if (pitchBend) {
          // Envelope bend: { start, end, startTime, endTime }
          const bendStart = (pitchBend.start ?? 0) * 100;
          const bendEnd = (pitchBend.end ?? 0) * 100;
          const startTime = pitchBend.startTime ?? 0; // 0-1 (percentage of note duration)
          const endTime = pitchBend.endTime ?? 1; // 0-1
          
          const bendStartTimeAbs = now + (duration * startTime);
          const bendEndTimeAbs = now + (duration * endTime);
          
          osc.detune.setValueAtTime(bendStart, now);
          if (startTime > 0) {
            osc.detune.setValueAtTime(bendStart, bendStartTimeAbs);
          }
          osc.detune.linearRampToValueAtTime(bendEnd, bendEndTimeAbs);
        }
      }
    
      const oscGain = audioContext.createGain();
      // Reduce gain when reverb is active to prevent clipping
      const effectReduction = 1 - (effectLevels.reverb * 0.4);
      oscGain.gain.value = safeConfig.gain * 0.25 * effectReduction;
      
      osc.connect(oscGain);
      oscGain.connect(filterNode);
      oscillators.push(osc);
    });
  } else {
    // Old harmonics format (fallback)
    const maxHarmonics = Math.min(3, config.harmonics?.length || 0);
    (config.harmonics || [1]).slice(0, maxHarmonics).forEach((harmGain, idx) => {
      const osc = audioContext.createOscillator();
      osc.type = config.waveform || 'sine';
      osc.frequency.value = freq * (idx + 1);
      
      const oscGain = audioContext.createGain();
      const effectReduction = 1 - (effectLevels.reverb * 0.4);
      oscGain.gain.value = harmGain * 0.3 * effectReduction;
      
      osc.connect(oscGain);
      oscGain.connect(filterNode);
      oscillators.push(osc);
    });
  }
  
  // Filter
  filterNode.type = 'lowpass';
  filterNode.frequency.value = config.filterFreq;
  filterNode.Q.value = config.filterQ;
  
  // Distortion for metal sounds
  let outputNode = filterNode;
  if (config.distortion > 0) {
    const distNode = createDistortion(config.distortion);
    filterNode.connect(distNode);
    outputNode = distNode;
  }
  
  // Envelope using global settings
  const totalDuration = duration + release;
  const attackTime = Math.max(now + 0.001, now + attack);
  const decayTime = Math.max(attackTime + 0.001, now + attack + 0.05);
  const releaseStartTime = Math.max(decayTime + 0.001, now + duration - release);
  const releaseEndTime = Math.max(releaseStartTime + 0.001, now + totalDuration);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, attackTime);
  gainNode.gain.linearRampToValueAtTime(volume * sustainLevel * 0.6, decayTime);
  gainNode.gain.setValueAtTime(volume * sustainLevel * 0.6, releaseStartTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEndTime);
  
  outputNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  const stopTime = Math.max(now + 0.01, now + totalDuration);
  activeOscillatorCount += oscillators.length;
  
  oscillators.forEach(osc => {
    osc.start(now);
    osc.stop(stopTime);
    osc.onended = () => {
      activeOscillatorCount--;
    };
  });
  
  return { oscillators, gainNode };
}

// Play a note that sustains until stopped
export function playNoteSustain(pitch, volume = 0.7, voiceIndex = 0, instrument = 'organ', attack = 0.02) {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return null;
  
  const config = INSTRUMENT_CONFIGS[instrument] || INSTRUMENT_CONFIGS.organ;
  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  
  // Create oscillators - support both old format (harmonics) and new format (oscillators)
  const oscillators = [];
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  if (config.oscillators) {
    // New sophisticated multi-oscillator format
    const maxOscs = Math.min(4, config.oscillators.length);
    config.oscillators.slice(0, maxOscs).forEach((oscConfig) => {
      // Ensure oscConfig has all required properties with defaults
      const safeConfig = {
        waveform: oscConfig?.waveform || 'sine',
        gain: oscConfig?.gain ?? 0.5,
        detune: oscConfig?.detune || 0,
        harmonic: oscConfig?.harmonic || 1,
        phase: oscConfig?.phase || 0
      };

      const osc = audioContext.createOscillator();
      osc.type = safeConfig.waveform;
      osc.frequency.value = freq * safeConfig.harmonic;
      osc.detune.value = safeConfig.detune;

      const oscGain = audioContext.createGain();
      const effectReduction = 1 - (effectLevels.reverb * 0.4);
      oscGain.gain.value = safeConfig.gain * 0.25 * effectReduction;
      
      osc.connect(oscGain);
      oscGain.connect(filterNode);
      oscillators.push(osc);
    });
  } else {
    // Old harmonics format (fallback)
    const maxHarmonics = Math.min(3, config.harmonics?.length || 0);
    (config.harmonics || [1]).slice(0, maxHarmonics).forEach((harmGain, idx) => {
      const osc = audioContext.createOscillator();
      osc.type = config.waveform || 'sine';
      osc.frequency.value = freq * (idx + 1);
      
      const oscGain = audioContext.createGain();
      const effectReduction = 1 - (effectLevels.reverb * 0.4);
      oscGain.gain.value = harmGain * 0.3 * effectReduction;
      
      osc.connect(oscGain);
      oscGain.connect(filterNode);
      oscillators.push(osc);
    });
  }
  
  // Filter
  filterNode.type = 'lowpass';
  filterNode.frequency.value = config.filterFreq;
  filterNode.Q.value = config.filterQ;
  
  // Distortion for certain instruments
  let outputNode = filterNode;
  if (config.distortion > 0) {
    const distNode = createDistortion(config.distortion);
    filterNode.connect(distNode);
    outputNode = distNode;
  }
  
  // Attack envelope - sustain level maintained until release
  const attackTime = Math.max(now + 0.001, now + attack);
  const sustainTime = Math.max(attackTime + 0.001, now + attack + 0.1);
  
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, attackTime);
  gainNode.gain.linearRampToValueAtTime(volume * 0.6, sustainTime);
  
  outputNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  oscillators.forEach(osc => osc.start(now));
  
  return { oscillators, gainNode, filterNode };
}

// Stop a sustained note with release envelope
export function stopNoteSustain(oscillatorObj, release = 0.3) {
  if (!oscillatorObj || !audioContext) return;
  
  const { oscillators, gainNode } = oscillatorObj;
  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  const releaseEndTime = Math.max(now + 0.01, now + release);
  
  // Release envelope
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, releaseEndTime);
  
  // Stop oscillators after release
  setTimeout(() => {
    oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator already stopped
      }
    });
  }, release * 1000 + 50);
}

export function playChord(pitches, duration = 0.5, volumes = []) {
  pitches.forEach((pitch, idx) => {
    const vol = volumes[idx] || 0.7;
    playNote(pitch, duration, vol, idx);
  });
}

export function stopAllNotes() {
  if (audioContext) {
    const now = Math.max(0.01, audioContext.currentTime + 0.01);
    const fadeEndTime = Math.max(now + 0.01, now + 0.05);
    // Smooth fade out to prevent snapping
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, fadeEndTime);
    setTimeout(() => {
      if (masterGain && audioContext) {
        const resetTime = Math.max(0.01, audioContext.currentTime);
        masterGain.gain.setValueAtTime(0.4, resetTime);
      }
    }, 100);
  }
}

export function setMasterVolume(volume) {
  if (masterGain && audioContext) {
    const now = Math.max(0.01, audioContext.currentTime + 0.01);
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(volume, now + 0.05);
  }
}

// Metronome click sound
export function playMetronomeClick(isDownbeat = false) {
  if (!audioContext) initAudio();
  
  const now = Math.max(0.01, audioContext.currentTime + 0.01);
  const endTime = Math.max(now + 0.01, now + 0.05);
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Higher pitch for downbeat, lower for other beats
  osc.frequency.value = isDownbeat ? 1500 : 1000;
  osc.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
  
  osc.connect(gainNode);
  gainNode.connect(audioContext.destination); // Direct to output, bypass effects
  
  osc.start(now);
  osc.stop(endTime);
}

// Create a more sophisticated instrument
export function createInstrument(type = 'organ') {
  if (!audioContext) initAudio();
  
  const instruments = {
    organ: {
      waveform: 'sine',
      harmonics: [1, 0.5, 0.25, 0.125],
      attack: 0.02,
      decay: 0.1,
      sustain: 0.8,
      release: 0.3
    },
    strings: {
      waveform: 'sawtooth',
      harmonics: [1, 0.3],
      attack: 0.15,
      decay: 0.2,
      sustain: 0.6,
      release: 0.4
    },
    flute: {
      waveform: 'sine',
      harmonics: [1, 0.1, 0.05],
      attack: 0.08,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2
    }
  };
  
  return instruments[type] || instruments.organ;
}