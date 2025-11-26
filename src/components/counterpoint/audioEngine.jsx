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
    masterGain.gain.value = 0.3;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

export function getAudioContext() {
  return audioContext;
}

export function playNote(pitch, duration = 0.5, volume = 0.8, voiceIndex = 0) {
  if (!audioContext) initAudio();
  
  const freq = NOTE_FREQUENCIES[pitch];
  if (!freq) return;
  
  const now = audioContext.currentTime;
  
  // Create oscillators for richer sound
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  // Different timbres per voice
  const waveforms = ['sine', 'triangle', 'sine', 'triangle'];
  osc1.type = waveforms[voiceIndex % 4];
  osc2.type = 'sine';
  
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 2; // Octave harmonic
  
  // Filter for warmth
  filterNode.type = 'lowpass';
  filterNode.frequency.value = 2000 + (voiceIndex * 500);
  filterNode.Q.value = 1;
  
  // Envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.6, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, now + duration * 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  // Connect nodes
  osc1.connect(filterNode);
  osc2.connect(gainNode);
  osc2.gain = audioContext.createGain();
  
  const osc2Gain = audioContext.createGain();
  osc2Gain.gain.value = 0.15;
  osc2.connect(osc2Gain);
  osc2Gain.connect(filterNode);
  
  filterNode.connect(gainNode);
  gainNode.connect(masterGain);
  
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
  
  return { osc1, osc2, gainNode };
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
      if (masterGain) masterGain.gain.value = 0.3;
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