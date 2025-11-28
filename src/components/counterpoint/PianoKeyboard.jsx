import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Keyboard, Guitar, Volume2, Waves, ChevronDown } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { initAudio, playNoteSustain, stopNoteSustain, playNote, setEffectLevel, getEffectLevels, setEnvelope as setGlobalEnvelope, playNoteWithCustomInstrument } from './audioEngine';
import WaveEditor from './WaveEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const OCTAVE_NOTES = [
  { note: 'C', isBlack: false, offset: 0 },
  { note: 'C#', isBlack: true, offset: 14 },
  { note: 'D', isBlack: false, offset: 24 },
  { note: 'D#', isBlack: true, offset: 38 },
  { note: 'E', isBlack: false, offset: 48 },
  { note: 'F', isBlack: false, offset: 72 },
  { note: 'F#', isBlack: true, offset: 86 },
  { note: 'G', isBlack: false, offset: 96 },
  { note: 'G#', isBlack: true, offset: 110 },
  { note: 'A', isBlack: false, offset: 120 },
  { note: 'A#', isBlack: true, offset: 134 },
  { note: 'B', isBlack: false, offset: 144 },
];

const VOICE_COLORS = ['#D4A574', '#7B9E89', '#9B8AA6', '#A68B7B'];

// Keyboard mapping for computer keyboard to piano notes
const KEY_MAP = {
  'z': 'C3', 's': 'C#3', 'x': 'D3', 'd': 'D#3', 'c': 'E3', 'v': 'F3',
  'g': 'F#3', 'b': 'G3', 'h': 'G#3', 'n': 'A3', 'j': 'A#3', 'm': 'B3',
  'q': 'C4', '2': 'C#4', 'w': 'D4', '3': 'D#4', 'e': 'E4', 'r': 'F4',
  '5': 'F#4', 't': 'G4', '6': 'G#4', 'y': 'A4', '7': 'A#4', 'u': 'B4',
  'i': 'C5', '9': 'C#5', 'o': 'D5', '0': 'D#5', 'p': 'E5', '[': 'F5',
  '=': 'F#5', ']': 'G5'
};

// Reverse map to get key from pitch
const PITCH_TO_KEY = Object.entries(KEY_MAP).reduce((acc, [key, pitch]) => {
  acc[pitch] = key.toUpperCase();
  return acc;
}, {});

const DEFAULT_INSTRUMENTS = [
  { value: 'organ', label: 'Organ' },
  { value: 'distortion', label: 'Distortion' },
  { value: 'clean', label: 'Clean' },
  { value: 'bass', label: 'Bass' },
  { value: 'strings', label: 'Strings' },
  { value: 'flute', label: 'Flute' },
  { value: 'synth', label: 'Synth' },
];

const PRESET_LIBRARY = [
  {
    name: 'Warm Pad',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.5 },
      { waveform: 'sawtooth', detune: 7, gain: 0.5 }
    ],
    envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1200, Q: 0.5 }
  },
  {
    name: 'Bright Lead',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.7 },
      { waveform: 'square', detune: 12, gain: 0.3 }
    ],
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
    filter: { type: 'lowpass', frequency: 4000, Q: 2 }
  },
  {
    name: 'Sub Bass',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 1.0 }
    ],
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
    filter: { type: 'lowpass', frequency: 500, Q: 1 }
  },
  {
    name: 'Pluck',
    oscillators: [
      { waveform: 'triangle', detune: 0, gain: 0.8 },
      { waveform: 'square', detune: 0, gain: 0.2 }
    ],
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 },
    filter: { type: 'lowpass', frequency: 3000, Q: 1.5 }
  },
  {
    name: 'Bell',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.6 },
      { waveform: 'sine', detune: 700, gain: 0.3 },
      { waveform: 'sine', detune: 1200, gain: 0.1 }
    ],
    envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 },
    filter: { type: 'highpass', frequency: 500, Q: 0.5 }
  },
  {
    name: 'Choir',
    oscillators: [
      { waveform: 'sawtooth', detune: -5, gain: 0.4 },
      { waveform: 'sawtooth', detune: 5, gain: 0.4 },
      { waveform: 'sine', detune: 0, gain: 0.2 }
    ],
    envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 },
    filter: { type: 'bandpass', frequency: 1500, Q: 2 }
  },
  {
    name: 'Reese Bass',
    oscillators: [
      { waveform: 'sawtooth', detune: -10, gain: 0.5 },
      { waveform: 'sawtooth', detune: 10, gain: 0.5 }
    ],
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 },
    filter: { type: 'lowpass', frequency: 800, Q: 3 }
  },
  {
    name: 'Flutey',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.9 },
      { waveform: 'triangle', detune: 0, gain: 0.1 }
    ],
    envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 },
    filter: { type: 'lowpass', frequency: 3500, Q: 0.3 }
  }
];

// Full 88-key piano: A0 to C8
const FULL_PIANO_OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7];

function InstrumentSelect({ value, onChange, instruments, onCreateNew }) {
  const [open, setOpen] = React.useState(false);
  const selected = instruments.find(i => i.value === value);
  
  return (
    <div className="flex items-center gap-1.5">
      <Guitar className="w-3.5 h-3.5 text-white/60" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-28 h-7 justify-between bg-slate-700 border-slate-600 text-white text-xs hover:bg-slate-600"
          >
            {selected?.label || 'Select...'}
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0 bg-slate-800 border-slate-700">
          <Command className="bg-slate-800">
            <CommandInput placeholder="Search instrument..." className="h-8 text-xs text-white" />
            <CommandList>
              <CommandEmpty className="text-white/50 text-xs py-2 text-center">
                No instrument found.
                {onCreateNew && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                    className="block w-full mt-2 text-amber-400 hover:text-amber-300 underline"
                  >
                    Create new instrument
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {instruments.map(inst => (
                  <CommandItem
                    key={inst.value}
                    value={inst.label}
                    onSelect={() => {
                      onChange(inst.value);
                      setOpen(false);
                    }}
                    className="text-white text-xs cursor-pointer"
                  >
                    {inst.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function PianoKeyboard({ activeNotes = [], instrument = 'organ', onInstrumentChange, onPressedNotesChange }) {
  const octaves = FULL_PIANO_OCTAVES;
  const [showKeys, setShowKeys] = useState(false);
  const [pressedNotes, setPressedNotes] = useState(new Set());
  const [effects, setEffects] = useState({ reverb: 0.3, delay: 0, chorus: 0 });
  const [envelope, setEnvelope] = useState({ attack: 0.02, sustain: 0.7, release: 0.3 });
  const activeOscillators = useRef({});
  const isDraggingRef = useRef(false);
  const [showWaveEditor, setShowWaveEditor] = useState(false);
  const [customInstruments, setCustomInstruments] = useState([]);

  // Combined instruments list
  const allInstruments = [
    ...DEFAULT_INSTRUMENTS,
    ...PRESET_LIBRARY.map((inst, i) => ({ value: `preset_${i}`, label: inst.name, preset: inst })),
    ...customInstruments.map((inst, i) => ({ value: `custom_${i}`, label: inst.name, custom: inst }))
  ];

  const handleSaveInstrument = (inst, index) => {
    if (index >= 0) {
      const updated = [...customInstruments];
      updated[index] = inst;
      setCustomInstruments(updated);
    } else {
      setCustomInstruments([...customInstruments, inst]);
    }
  };

  const handleDeleteInstrument = (index) => {
    setCustomInstruments(customInstruments.filter((_, i) => i !== index));
    // If current instrument was deleted, switch to organ
    if (instrument === `custom_${index}`) {
      onInstrumentChange('organ');
    }
  };

  // Get custom/preset instrument config if selected
  const getCustomConfig = () => {
    if (instrument.startsWith('custom_')) {
      const index = parseInt(instrument.split('_')[1]);
      return customInstruments[index];
    }
    if (instrument.startsWith('preset_')) {
      const index = parseInt(instrument.split('_')[1]);
      return PRESET_LIBRARY[index];
    }
    return null;
  };

  const handleEffectChange = (effect, value) => {
    setEffects(prev => ({ ...prev, [effect]: value }));
    setEffectLevel(effect, value);
  };

  const handleEnvelopeChange = (param, value) => {
    const newEnvelope = { ...envelope, [param]: value };
    setEnvelope(newEnvelope);
    setGlobalEnvelope(newEnvelope); // Update global audio engine
  };
  
  const whiteKeyWidth = 24;
  const blackKeyWidth = 14;
  const octaveWidth = whiteKeyWidth * 7;

  const isNoteActive = (note, octave) => {
    const fullNote = `${note}${octave}`;
    return activeNotes.findIndex(n => n.pitch === fullNote);
  };

  const isNotePressed = (note, octave) => {
    return pressedNotes.has(`${note}${octave}`);
  };

  const startNote = useCallback((pitch) => {
    if (activeOscillators.current[pitch]) return; // Already playing
    
    initAudio();
    const customConfig = getCustomConfig();
    
    if (customConfig) {
      // Use custom instrument
      const oscObj = playNoteWithCustomInstrument(pitch, 2, envelope.sustain, customConfig);
      activeOscillators.current[pitch] = oscObj;
    } else {
      // Use built-in instrument
      const oscObj = playNoteSustain(pitch, envelope.sustain, 0, instrument, envelope.attack);
      activeOscillators.current[pitch] = oscObj;
    }
    setPressedNotes(prev => {
      const next = new Set([...prev, pitch]);
      onPressedNotesChange?.(next);
      return next;
    });
  }, [instrument, envelope, customInstruments, onPressedNotesChange]);

  const endNote = useCallback((pitch) => {
    if (activeOscillators.current[pitch]) {
      // Only call stopNoteSustain if it's an oscillator object
      if (typeof activeOscillators.current[pitch] === 'object') {
        stopNoteSustain(activeOscillators.current[pitch], envelope.release);
      }
      delete activeOscillators.current[pitch];
      setPressedNotes(prev => {
                const next = new Set(prev);
                next.delete(pitch);
                onPressedNotesChange?.(next);
                return next;
              });
    }
  }, [envelope.release]);

  const handleMouseDown = useCallback((e, note, octave) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const pitch = `${note}${octave}`;
    startNote(pitch);
  }, [startNote]);

  const handleMouseUp = useCallback((note, octave) => {
    isDraggingRef.current = false;
    const pitch = `${note}${octave}`;
    endNote(pitch);
  }, [endNote]);

  const handleMouseEnter = useCallback((note, octave) => {
    if (isDraggingRef.current) {
      const pitch = `${note}${octave}`;
      startNote(pitch);
    }
  }, [startNote]);

  const handleMouseLeave = useCallback((note, octave) => {
    if (isDraggingRef.current) {
      const pitch = `${note}${octave}`;
      endNote(pitch);
    }
  }, [endNote]);

  const handleGlobalMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    // Stop all currently playing notes
    Object.keys(activeOscillators.current).forEach(pitch => {
      endNote(pitch);
    });
  }, [endNote]);

  // Handle computer keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger piano when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return;
      // Don't trigger piano for modifier key combinations (undo/redo/copy/paste etc)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const pitch = KEY_MAP[e.key.toLowerCase()];
      if (pitch) {
        e.preventDefault();
        startNote(pitch);
      }
    };

    const handleKeyUp = (e) => {
      // Don't trigger piano when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const pitch = KEY_MAP[e.key.toLowerCase()];
      if (pitch) {
        e.preventDefault();
        endNote(pitch);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startNote, endNote]);

  // Global mouse up listener for drag release
  useEffect(() => {
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleGlobalMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(activeOscillators.current).forEach(osc => {
        if (typeof osc === 'object') {
          stopNoteSustain(osc);
        }
      });
    };
  }, []);

  const getKeyLabel = (note, octave) => {
    const pitch = `${note}${octave}`;
    return PITCH_TO_KEY[pitch] || '';
  };

  // Calculate total width for 88 keys (52 white keys)
  const totalWhiteKeys = 52;
  const totalWidth = totalWhiteKeys * whiteKeyWidth;

  return (
    <div className="bg-slate-800/60 rounded-xl p-2 sm:p-3 border border-slate-600 max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="text-white/90 text-xs uppercase tracking-wider font-medium hidden sm:block">Piano (88 Keys)</h3>
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* ADSR Envelope Knobs - hidden on mobile */}
                          <div className="hidden sm:flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Attack</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #10b981 ${envelope.attack * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(envelope.attack * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={envelope.attack}
                  onChange={(e) => handleEnvelopeChange('attack', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Sustain</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #10b981 ${envelope.sustain * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(envelope.sustain * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={envelope.sustain}
                  onChange={(e) => handleEnvelopeChange('sustain', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Release</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #10b981 ${envelope.release * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(envelope.release * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="2"
                  step="0.01"
                  value={envelope.release}
                  onChange={(e) => handleEnvelopeChange('release', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-600 hidden sm:block" />

                          {/* Effect Knobs - hidden on mobile */}
                          <div className="hidden sm:flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Reverb</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #f59e0b ${effects.reverb * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(effects.reverb * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.reverb}
                  onChange={(e) => handleEffectChange('reverb', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Delay</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #f59e0b ${effects.delay * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(effects.delay * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.delay}
                  onChange={(e) => handleEffectChange('delay', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/50 uppercase">Chorus</span>
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #f59e0b ${effects.chorus * 270}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(effects.chorus * 100)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.chorus}
                  onChange={(e) => handleEffectChange('chorus', parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-600 hidden sm:block" />

                          <div className="flex items-center gap-1 sm:gap-2">
                            <InstrumentSelect
                              value={instrument}
                              onChange={onInstrumentChange}
                              instruments={allInstruments}
                              onCreateNew={() => setShowWaveEditor(true)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowWaveEditor(!showWaveEditor)}
                              className={`h-7 px-2 text-xs ${showWaveEditor ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white'}`}
                            >
                              <Waves className="w-3.5 h-3.5 mr-1" />
                              Wave
                            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeys(!showKeys)}
              className={`h-7 px-2 text-xs ${showKeys ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white'}`}
            >
              <Keyboard className="w-3.5 h-3.5 mr-1" />
              Keys
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto pb-1">
                    <div className="relative" style={{ width: totalWidth + whiteKeyWidth * 3, height: 60 }}>
            {/* Generate all 88 keys - A0 to C8 */}
          {(() => {
            const keys = [];
            let whiteKeyIndex = 0;
            
            // A0, A#0, B0 (partial first octave)
            ['A', 'B'].forEach((note) => {
              const voiceIndex = isNoteActive(note, 0);
              const isActive = voiceIndex !== -1;
              const isPressed = isNotePressed(note, 0);
              keys.push(
                <div
                  key={`0-${note}`}
                  onMouseDown={(e) => handleMouseDown(e, note, 0)}
                  onMouseUp={() => handleMouseUp(note, 0)}
                  onMouseEnter={() => handleMouseEnter(note, 0)}
                  onMouseLeave={() => handleMouseLeave(note, 0)}
                  className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex flex-col items-center justify-end pb-0.5"
                  style={{
                                                                                                      left: whiteKeyIndex * whiteKeyWidth,
                                                                                                      width: whiteKeyWidth - 1,
                                                                                                      height: 50,
                    backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                  }}
                >
                  {showKeys && getKeyLabel(note, 0) && (
                    <span className="text-[8px] font-bold text-slate-500 mb-0.5">{getKeyLabel(note, 0)}</span>
                  )}
                  {note === 'A' && <span className="text-[8px] text-slate-400">A0</span>}
                </div>
              );
              whiteKeyIndex++;
            });
            
            // A#0 black key
            const a0SharpActive = isNoteActive('A#', 0);
            const a0SharpPressed = isNotePressed('A#', 0);
            keys.push(
              <div
                key="0-A#"
                onMouseDown={(e) => handleMouseDown(e, 'A#', 0)}
                onMouseUp={() => handleMouseUp('A#', 0)}
                onMouseEnter={() => handleMouseEnter('A#', 0)}
                onMouseLeave={() => handleMouseLeave('A#', 0)}
                className="absolute top-0 rounded-b z-10 cursor-pointer"
                                      style={{
                                        left: whiteKeyWidth - blackKeyWidth / 2,
                                        width: blackKeyWidth,
                                        height: 32,
                  backgroundColor: a0SharpPressed ? '#D4A574' : a0SharpActive !== -1 ? VOICE_COLORS[a0SharpActive] : '#1E293B',
                }}
              />
            );
            
            // Full octaves 1-7
            for (let octave = 1; octave <= 7; octave++) {
              const octaveStartWhite = whiteKeyIndex;
              
              OCTAVE_NOTES.filter(n => !n.isBlack).forEach((key) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                const isPressed = isNotePressed(key.note, octave);
                
                const keyLabel = getKeyLabel(key.note, octave);
                keys.push(
                  <div
                    key={`${octave}-${key.note}`}
                    onMouseDown={(e) => handleMouseDown(e, key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseEnter={() => handleMouseEnter(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex flex-col items-center justify-end pb-0.5"
                                              style={{
                                                left: whiteKeyIndex * whiteKeyWidth,
                                                width: whiteKeyWidth - 1,
                                                height: 50,
                      backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                    }}
                  >
                    {showKeys && keyLabel && (
                      <span className="text-[8px] font-bold text-slate-500 mb-0.5">{keyLabel}</span>
                    )}
                    {key.note === 'C' && <span className="text-[8px] text-slate-400">C{octave}</span>}
                  </div>
                );
                whiteKeyIndex++;
              });
              
              // Black keys for this octave
              OCTAVE_NOTES.filter(n => n.isBlack).forEach((key) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                const isPressed = isNotePressed(key.note, octave);
                
                const blackKeyLabel = getKeyLabel(key.note, octave);
                keys.push(
                  <div
                    key={`${octave}-${key.note}`}
                    onMouseDown={(e) => handleMouseDown(e, key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseEnter={() => handleMouseEnter(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute top-0 rounded-b z-10 cursor-pointer flex items-end justify-center pb-1"
                                              style={{
                                                left: octaveStartWhite * whiteKeyWidth + key.offset * (whiteKeyWidth / 24),
                                                width: blackKeyWidth,
                                                height: 32,
                      backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#1E293B',
                    }}
                  >
                    {showKeys && blackKeyLabel && (
                      <span className="text-[7px] font-bold text-white/70">{blackKeyLabel}</span>
                    )}
                  </div>
                );
              });
            }
            
            // C8 (final key)
            const c8Active = isNoteActive('C', 8);
            const c8Pressed = isNotePressed('C', 8);
            keys.push(
              <div
                key="8-C"
                onMouseDown={(e) => handleMouseDown(e, 'C', 8)}
                onMouseUp={() => handleMouseUp('C', 8)}
                onMouseEnter={() => handleMouseEnter('C', 8)}
                onMouseLeave={() => handleMouseLeave('C', 8)}
                className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex items-end justify-center pb-0.5"
                                      style={{
                                        left: whiteKeyIndex * whiteKeyWidth,
                                        width: whiteKeyWidth - 1,
                                        height: 50,
                  backgroundColor: c8Pressed ? '#D4A574' : c8Active !== -1 ? VOICE_COLORS[c8Active] : '#F5F5F5',
                }}
              >
                <span className="text-[8px] text-slate-400">C8</span>
              </div>
            );
            
            return keys;
          })()}
        </div>
      </div>
      
      <p className="text-white/50 text-[10px] mt-1 hidden sm:block">
                    Hold keys to sustain • Use keyboard (Z-M, Q-P rows)
                  </p>

      {/* Wave Editor Modal */}
              <Dialog open={showWaveEditor} onOpenChange={setShowWaveEditor}>
                <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl p-4">
                  <DialogHeader className="pb-2">
                    <DialogTitle className="text-white text-sm">Wave Editor</DialogTitle>
                  </DialogHeader>
                  <WaveEditor
                    customInstruments={customInstruments}
                    onSaveInstrument={handleSaveInstrument}
                    onDeleteInstrument={handleDeleteInstrument}
                    onClose={() => setShowWaveEditor(false)}
                  />
                </DialogContent>
              </Dialog>
    </div>
  );
}