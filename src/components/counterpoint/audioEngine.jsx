// Web Audio API based synthesizer for counterpoint playback

let audioContext = null;
let masterGain = null;

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

export function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(audioContext.destination);
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function getAudioContext() {
  return audioContext;
}

// Instrument configurations
const INSTRUMENT_CONFIGS = {
  organ: {
    waveform: 'sine',
    harmonics: [1, 0.5, 0.25],
    attack: 0.02,
    filterFreq: 2500,
    filterQ: 1,
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
    waveform: 'sawtooth',
    harmonics: [1, 0.3],
    attack: 0.15,
    filterFreq: 2000,
    filterQ: 0.5,
    distortion: 0
  },
  flute: {
    waveform: 'sine',
    harmonics: [1, 0.1, 0.05],
    attack: 0.08,
    filterFreq: 3500,
    filterQ: 0.3,
    distortion: 0
  },
  synth: {
    waveform: 'square',
    harmonics: [1, 0.5, 0.25],
    attack: 0.01,
    filterFreq: 3000,
    filterQ: 3,
    distortion: 5
  }
};

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

export function playNote(pitch, duration = 0.5, volume = 0.8, voiceIndex = 0, instrument = 'organ') {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return;
  
  const config = INSTRUMENT_CONFIGS[instrument] || INSTRUMENT_CONFIGS.organ;
  const now = audioContext.currentTime;
  
  // Create oscillators based on harmonics
  const oscillators = [];
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  config.harmonics.forEach((harmGain, idx) => {
    const osc = audioContext.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = freq * (idx + 1);
    
    const oscGain = audioContext.createGain();
    oscGain.gain.value = harmGain * 0.3;
    
    osc.connect(oscGain);
    oscGain.connect(filterNode);
    oscillators.push(osc);
  });
  
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
  
  // Envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.6, now + config.attack);
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, now + duration * 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  outputNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  oscillators.forEach(osc => {
    osc.start(now);
    osc.stop(now + duration);
  });
  
  return { oscillators, gainNode };
}

// Play a note that sustains until stopped
export function playNoteSustain(pitch, volume = 0.7, voiceIndex = 0) {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return null;
  
  const now = audioContext.currentTime;
  
  // Create oscillators for richer sound
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const osc3 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  // Piano-like sound with multiple oscillators
  osc1.type = 'triangle';
  osc2.type = 'sine';
  osc3.type = 'sine';
  
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 2; // Octave harmonic
  osc3.frequency.value = freq * 3; // Fifth harmonic
  
  // Filter for warmth
  filterNode.type = 'lowpass';
  filterNode.frequency.value = 3000;
  filterNode.Q.value = 0.5;
  
  // Attack envelope (sustain level maintained)
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, now + 0.01);
  gainNode.gain.linearRampToValueAtTime(volume * 0.6, now + 0.1);
  
  // Connect oscillators with different volumes
  const osc1Gain = audioContext.createGain();
  osc1Gain.gain.value = 0.5;
  osc1.connect(osc1Gain);
  osc1Gain.connect(filterNode);
  
  const osc2Gain = audioContext.createGain();
  osc2Gain.gain.value = 0.25;
  osc2.connect(osc2Gain);
  osc2Gain.connect(filterNode);
  
  const osc3Gain = audioContext.createGain();
  osc3Gain.gain.value = 0.1;
  osc3.connect(osc3Gain);
  osc3Gain.connect(filterNode);
  
  filterNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  osc1.start(now);
  osc2.start(now);
  osc3.start(now);
  
  return { osc1, osc2, osc3, gainNode, filterNode };
}

// Stop a sustained note with release envelope
export function stopNoteSustain(oscillatorObj) {
  if (!oscillatorObj || !audioContext) return;
  
  const { osc1, osc2, osc3, gainNode } = oscillatorObj;
  const now = audioContext.currentTime;
  
  // Release envelope
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
  // Stop oscillators after release
  setTimeout(() => {
    try {
      osc1.stop();
      osc2.stop();
      if (osc3) osc3.stop();
    } catch (e) {
      // Oscillator already stopped
    }
  }, 350);
}

export function playChord(pitches, duration = 0.5, volumes = []) {
  pitches.forEach((pitch, idx) => {
    const vol = volumes[idx] || 0.7;
    playNote(pitch, duration, vol, idx);
  });
}

export function stopAllNotes() {
  if (audioContext) {
    masterGain.gain.setValueAtTime(0, audioContext.currentTime);
    setTimeout(() => {
      if (masterGain) masterGain.gain.value = 0.4;
    }, 100);
  }
}

export function setMasterVolume(volume) {
  if (masterGain) {
    masterGain.gain.value = volume;
  }
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