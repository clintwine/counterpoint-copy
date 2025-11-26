// Web Audio API based synthesizer for counterpoint playback

let audioContext = null;
let masterGain = null;
let reverbNode = null;
let reverbGain = null;
let delayNode = null;
let delayGain = null;
let chorusNode = null;
let chorusGain = null;

// Effect levels (0-1)
let effectLevels = {
  reverb: 0.3,
  delay: 0,
  chorus: 0
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
  const length = sampleRate * 2; // 2 second reverb
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
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
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.4;
    
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
      reverbGain.connect(audioContext.destination);
    }
    
    if (delayNode) {
      masterGain.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(audioContext.destination);
    }
    
    if (chorusNode) {
      masterGain.connect(chorusNode);
      chorusNode.connect(chorusGain);
      chorusGain.connect(audioContext.destination);
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
  if (effect === 'reverb' && reverbGain) {
    reverbGain.gain.value = level;
  } else if (effect === 'delay' && delayGain) {
    delayGain.gain.value = level;
  } else if (effect === 'chorus' && chorusGain) {
    chorusGain.gain.value = level;
  }
}

export function getEffectLevels() {
  return { ...effectLevels };
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
export function playNoteSustain(pitch, volume = 0.7, voiceIndex = 0, instrument = 'organ', attack = 0.02) {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return null;
  
  const config = INSTRUMENT_CONFIGS[instrument] || INSTRUMENT_CONFIGS.organ;
  const now = audioContext.currentTime;
  
  // Create oscillators based on instrument harmonics
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
  
  // Distortion for certain instruments
  let outputNode = filterNode;
  if (config.distortion > 0) {
    const distNode = createDistortion(config.distortion);
    filterNode.connect(distNode);
    outputNode = distNode;
  }
  
  // Attack envelope - sustain level maintained until release
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.8, now + attack);
  gainNode.gain.linearRampToValueAtTime(volume * 0.6, now + attack + 0.1);
  
  outputNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  oscillators.forEach(osc => osc.start(now));
  
  return { oscillators, gainNode, filterNode };
}

// Stop a sustained note with release envelope
export function stopNoteSustain(oscillatorObj, release = 0.3) {
  if (!oscillatorObj || !audioContext) return;
  
  const { oscillators, gainNode } = oscillatorObj;
  const now = audioContext.currentTime;
  
  // Release envelope
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + release);
  
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

// Metronome click sound
export function playMetronomeClick(isDownbeat = false) {
  if (!audioContext) initAudio();
  
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Higher pitch for downbeat, lower for other beats
  osc.frequency.value = isDownbeat ? 1500 : 1000;
  osc.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  
  osc.connect(gainNode);
  gainNode.connect(audioContext.destination); // Direct to output, bypass effects
  
  osc.start(now);
  osc.stop(now + 0.05);
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