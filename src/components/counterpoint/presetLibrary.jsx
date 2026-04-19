export const PRESET_LIBRARY_CONFIGS = [
  {
    name: 'Warm Pad',
    oscillators: [
      { waveform: 'sawtooth', detune: -12, gain: 0.45, harmonic: 1 },
      { waveform: 'sawtooth', detune: -5, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 5, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 12, gain: 0.45, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.3, harmonic: 2 }
    ],
    envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 0.7 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 1400, Q: 0.5 } },
      { type: 'reverb', config: { size: 0.7, mix: 0.45 } },
      { type: 'chorus', config: { rate: 0.5, depth: 0.3 } }
    ],
    lfo: { rate: 0.3, amount: 0.08, target: 'filter' },
    eq: [
      { frequency: 60, gain: 3, Q: 1, type: 'lowshelf' },
      { frequency: 300, gain: -2, Q: 1, type: 'peaking' },
      { frequency: 1000, gain: 0, Q: 1, type: 'peaking' },
      { frequency: 4000, gain: -3, Q: 1, type: 'peaking' },
      { frequency: 10000, gain: -4, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Bright Lead',
    oscillators: [
      { waveform: 'sawtooth', detune: -5, gain: 0.7, harmonic: 1 },
      { waveform: 'sawtooth', detune: 5, gain: 0.7, harmonic: 1 },
      { waveform: 'square', detune: 0, gain: 0.35, harmonic: 2 }
    ],
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.65, release: 0.2 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 4500, Q: 3 } },
      { type: 'distortion', config: { amount: 8 } },
      { type: 'delay', config: { time: 0.18, feedback: 0.25, mix: 0.15 } }
    ],
    eq: [
      { frequency: 60, gain: -2, Q: 1, type: 'lowshelf' },
      { frequency: 400, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 2000, gain: 3, Q: 1, type: 'peaking' },
      { frequency: 6000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 12000, gain: 1, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Sub Bass',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sawtooth', detune: -3, gain: 0.4, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.35, harmonic: 2 }
    ],
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.9, release: 0.15 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 600, Q: 1.5 } },
      { type: 'distortion', config: { amount: 6 } }
    ],
    eq: [
      { frequency: 60, gain: 6, Q: 1, type: 'lowshelf' },
      { frequency: 200, gain: 3, Q: 1.5, type: 'peaking' },
      { frequency: 800, gain: -4, Q: 1, type: 'peaking' },
      { frequency: 3000, gain: -6, Q: 1, type: 'peaking' },
      { frequency: 10000, gain: -8, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Pluck',
    oscillators: [
      { waveform: 'triangle', detune: 0, gain: 0.85, harmonic: 1 },
      { waveform: 'square', detune: -5, gain: 0.3, harmonic: 1 },
      { waveform: 'sine', detune: 5, gain: 0.25, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.12, harmonic: 4 }
    ],
    envelope: { attack: 0.005, decay: 0.35, sustain: 0.08, release: 0.25 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 4000, Q: 2 } },
      { type: 'reverb', config: { size: 0.4, mix: 0.18 } }
    ],
    eq: [
      { frequency: 60, gain: -1, Q: 1, type: 'lowshelf' },
      { frequency: 500, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 2000, gain: 1, Q: 1, type: 'peaking' },
      { frequency: 5000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 12000, gain: 0, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Bell',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.7, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.5, harmonic: 2.756 },
      { waveform: 'sine', detune: 5, gain: 0.3, harmonic: 5.404 },
      { waveform: 'sine', detune: -3, gain: 0.18, harmonic: 8.933 },
      { waveform: 'sine', detune: 0, gain: 0.1, harmonic: 13.46 }
    ],
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.15, release: 1.2 },
    effects: [
      { type: 'filter', config: { filterType: 'highpass', frequency: 300, Q: 0.5 } },
      { type: 'reverb', config: { size: 0.6, mix: 0.35 } }
    ],
    eq: [
      { frequency: 60, gain: -4, Q: 1, type: 'lowshelf' },
      { frequency: 400, gain: -2, Q: 1, type: 'peaking' },
      { frequency: 2000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 6000, gain: 3, Q: 1.5, type: 'peaking' },
      { frequency: 12000, gain: 2, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Choir Ahh',
    oscillators: [
      { waveform: 'sawtooth', detune: -14, gain: 0.38, harmonic: 1 },
      { waveform: 'sawtooth', detune: -7, gain: 0.45, harmonic: 1 },
      { waveform: 'sawtooth', detune: 0, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 7, gain: 0.45, harmonic: 1 },
      { waveform: 'sawtooth', detune: 14, gain: 0.38, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.25, harmonic: 2 },
      { waveform: 'triangle', detune: 0, gain: 0.12, harmonic: 3 }
    ],
    envelope: { attack: 0.3, decay: 0.15, sustain: 0.75, release: 0.5 },
    effects: [
      { type: 'filter', config: { filterType: 'bandpass', frequency: 900, Q: 1.5 } },
      { type: 'reverb', config: { size: 0.8, mix: 0.5 } },
      { type: 'chorus', config: { rate: 0.6, depth: 0.25 } }
    ],
    lfo: { rate: 4.5, amount: 0.05, target: 'pitch' },
    eq: [
      { frequency: 80, gain: -2, Q: 1, type: 'lowshelf' },
      { frequency: 500, gain: 3, Q: 2, type: 'peaking' },
      { frequency: 1200, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 3000, gain: -1, Q: 1, type: 'peaking' },
      { frequency: 8000, gain: -3, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Reese Bass',
    oscillators: [
      { waveform: 'sawtooth', detune: -14, gain: 0.55, harmonic: 1 },
      { waveform: 'sawtooth', detune: -7, gain: 0.6, harmonic: 1 },
      { waveform: 'sawtooth', detune: 7, gain: 0.6, harmonic: 1 },
      { waveform: 'sawtooth', detune: 14, gain: 0.55, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.4, harmonic: 2 }
    ],
    envelope: { attack: 0.02, decay: 0.12, sustain: 0.85, release: 0.2 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 1000, Q: 4 } },
      { type: 'chorus', config: { rate: 1.2, depth: 0.4 } }
    ],
    lfo: { rate: 0.5, amount: 0.4, target: 'filter' },
    eq: [
      { frequency: 60, gain: 5, Q: 1, type: 'lowshelf' },
      { frequency: 200, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 800, gain: -2, Q: 1, type: 'peaking' },
      { frequency: 3000, gain: -5, Q: 1, type: 'peaking' },
      { frequency: 10000, gain: -6, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Flute Solo',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.9, harmonic: 1 },
      { waveform: 'sine', detune: 2, gain: 0.3, harmonic: 2 },
      { waveform: 'triangle', detune: -2, gain: 0.12, harmonic: 3 },
      { waveform: 'sine', detune: 0, gain: 0.05, harmonic: 4 }
    ],
    envelope: { attack: 0.09, decay: 0.05, sustain: 0.75, release: 0.3 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 5500, Q: 0.4 } },
      { type: 'reverb', config: { size: 0.5, mix: 0.22 } }
    ],
    lfo: { rate: 5.5, amount: 0.06, target: 'pitch' },
    eq: [
      { frequency: 80, gain: -3, Q: 1, type: 'lowshelf' },
      { frequency: 400, gain: 1, Q: 1, type: 'peaking' },
      { frequency: 1500, gain: 2, Q: 1, type: 'peaking' },
      { frequency: 5000, gain: 1, Q: 1.5, type: 'peaking' },
      { frequency: 12000, gain: -1, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Vintage EP',
    oscillators: [
      { waveform: 'triangle', detune: -3, gain: 0.75, harmonic: 1 },
      { waveform: 'sine', detune: 3, gain: 0.65, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.4, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.2, harmonic: 3 }
    ],
    envelope: { attack: 0.003, decay: 0.25, sustain: 0.5, release: 0.4 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 3500, Q: 1.2 } },
      { type: 'chorus', config: { rate: 0.8, depth: 0.3 } },
      { type: 'reverb', config: { size: 0.3, mix: 0.15 } }
    ],
    eq: [
      { frequency: 80, gain: 2, Q: 1, type: 'lowshelf' },
      { frequency: 300, gain: -1, Q: 1.5, type: 'peaking' },
      { frequency: 1000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 3000, gain: 1, Q: 1, type: 'peaking' },
      { frequency: 8000, gain: -2, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'String Ensemble',
    oscillators: [
      { waveform: 'sawtooth', detune: -15, gain: 0.42, harmonic: 1 },
      { waveform: 'sawtooth', detune: -8, gain: 0.48, harmonic: 1 },
      { waveform: 'sawtooth', detune: -2, gain: 0.52, harmonic: 1 },
      { waveform: 'sawtooth', detune: 2, gain: 0.52, harmonic: 1 },
      { waveform: 'sawtooth', detune: 8, gain: 0.48, harmonic: 1 },
      { waveform: 'sawtooth', detune: 15, gain: 0.42, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.2, harmonic: 2 }
    ],
    envelope: { attack: 0.25, decay: 0.2, sustain: 0.85, release: 0.65 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 4000, Q: 0.9 } },
      { type: 'reverb', config: { size: 0.75, mix: 0.4 } },
      { type: 'chorus', config: { rate: 0.4, depth: 0.25 } }
    ],
    lfo: { rate: 4.8, amount: 0.04, target: 'pitch' },
    eq: [
      { frequency: 80, gain: 1, Q: 1, type: 'lowshelf' },
      { frequency: 250, gain: -1, Q: 1, type: 'peaking' },
      { frequency: 800, gain: 1, Q: 1, type: 'peaking' },
      { frequency: 4000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 10000, gain: -2, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Dark Synth',
    oscillators: [
      { waveform: 'sawtooth', detune: -7, gain: 0.65, harmonic: 1 },
      { waveform: 'square', detune: 0, gain: 0.55, harmonic: 1 },
      { waveform: 'sawtooth', detune: 7, gain: 0.45, harmonic: 1 },
      { waveform: 'square', detune: 0, gain: 0.3, harmonic: 2 }
    ],
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.65, release: 0.35 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 1800, Q: 5 } },
      { type: 'distortion', config: { amount: 15 } },
      { type: 'reverb', config: { size: 0.5, mix: 0.2 } }
    ],
    lfo: { rate: 0.2, amount: 0.6, target: 'filter' },
    eq: [
      { frequency: 60, gain: 4, Q: 1, type: 'lowshelf' },
      { frequency: 300, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 1000, gain: 0, Q: 1, type: 'peaking' },
      { frequency: 4000, gain: -3, Q: 1, type: 'peaking' },
      { frequency: 12000, gain: -5, Q: 1, type: 'highshelf' }
    ]
  },
  {
    name: 'Glass Marimba',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.8, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.5, harmonic: 3 },
      { waveform: 'triangle', detune: 5, gain: 0.25, harmonic: 4.07 },
      { waveform: 'sine', detune: -3, gain: 0.12, harmonic: 7 }
    ],
    envelope: { attack: 0.001, decay: 0.45, sustain: 0.1, release: 0.6 },
    effects: [
      { type: 'filter', config: { filterType: 'bandpass', frequency: 3000, Q: 1 } },
      { type: 'reverb', config: { size: 0.55, mix: 0.3 } }
    ],
    eq: [
      { frequency: 80, gain: -5, Q: 1, type: 'lowshelf' },
      { frequency: 500, gain: 1, Q: 1, type: 'peaking' },
      { frequency: 2000, gain: 3, Q: 1.5, type: 'peaking' },
      { frequency: 6000, gain: 2, Q: 1.5, type: 'peaking' },
      { frequency: 12000, gain: 1, Q: 1, type: 'highshelf' }
    ]
  }
];

export const PRESET_LIBRARY = PRESET_LIBRARY_CONFIGS.map((config, i) => ({ value: `preset_${i}`, label: config.name }));