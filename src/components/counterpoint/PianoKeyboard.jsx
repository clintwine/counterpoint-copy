import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Keyboard, Guitar, Volume2, Waves, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { initAudio, playNoteSustain, stopNoteSustain, playNote, setEffectLevel, getEffectLevels, setEnvelope as setGlobalEnvelope, playNoteWithCustomInstrument, getAnalyser } from './audioEngine';
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
{ note: 'B', isBlack: false, offset: 144 }];


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
  { value: 'piano', label: 'Piano' },
  { value: 'harpsichord', label: 'Harpsichord' },
  { value: 'strings', label: 'Strings' },
  { value: 'cello', label: 'Cello' },
  { value: 'harp', label: 'Harp' },
  { value: 'flute', label: 'Flute' },
  { value: 'clarinet', label: 'Clarinet' },
  { value: 'oboe', label: 'Oboe' },
  { value: 'saxophone', label: 'Saxophone' },
  { value: 'trumpet', label: 'Trumpet' },
  { value: 'brass', label: 'Brass' },
  { value: 'choir', label: 'Choir' },
  { value: 'electricGuitar', label: 'Electric Guitar' },
  { value: 'pad', label: 'Pad' },
  { value: 'bells', label: 'Bells' },
  { value: 'celeste', label: 'Celeste' },
  { value: 'vibraphone', label: 'Vibraphone' },
  { value: 'marimba', label: 'Marimba' },
  { value: 'pluck', label: 'Pluck' },
  { value: 'bass', label: 'Bass' },
  { value: 'clean', label: 'Clean' },
  { value: 'electric', label: 'Electric' },
  { value: 'distortion', label: 'Distortion' },
  { value: 'synth', label: 'Synth' }];


// Built-in instrument configurations (same as WaveEditor)
const BUILTIN_INSTRUMENTS = {
  electricGuitar: {
    name: 'Electric Guitar',
    oscillators: [
      { waveform: 'sawtooth', detune: -8, gain: 0.7, harmonic: 1, phase: 0 },
      { waveform: 'square', detune: 5, gain: 0.5, harmonic: 1, phase: 90 },
      { waveform: 'triangle', detune: 0, gain: 0.3, harmonic: 2, phase: 0 }
    ],
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.25 },
    effects: [
      { type: 'filter', config: { filterType: 'lowpass', frequency: 3500, Q: 1.8 } }
    ],
    eq: [
      { frequency: 60, gain: -2, Q: 1, type: 'lowshelf' },
      { frequency: 250, gain: 1, Q: 1.5, type: 'peaking' },
      { frequency: 1000, gain: 2, Q: 1, type: 'peaking' },
      { frequency: 4000, gain: 3, Q: 1.2, type: 'peaking' },
      { frequency: 12000, gain: -1, Q: 1, type: 'highshelf' }
    ],
    distortion: 5,
    bitcrush: 2,
    volume: 1
  }
};

const PRESET_LIBRARY = [
  {
    name: 'Warm Pad',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.5 },
      { waveform: 'sawtooth', detune: 7, gain: 0.5 }],

    envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1200, Q: 0.5 }
  },
{
  name: 'Bright Lead',
  oscillators: [
  { waveform: 'sawtooth', detune: 0, gain: 0.7 },
  { waveform: 'square', detune: 12, gain: 0.3 }],

  envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
  filter: { type: 'lowpass', frequency: 4000, Q: 2 }
},
{
  name: 'Sub Bass',
  oscillators: [
  { waveform: 'sine', detune: 0, gain: 1.0 }],

  envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
  filter: { type: 'lowpass', frequency: 500, Q: 1 }
},
{
  name: 'Pluck',
  oscillators: [
  { waveform: 'triangle', detune: 0, gain: 0.8 },
  { waveform: 'square', detune: 0, gain: 0.2 }],

  envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 },
  filter: { type: 'lowpass', frequency: 3000, Q: 1.5 }
},
{
  name: 'Bell',
  oscillators: [
  { waveform: 'sine', detune: 0, gain: 0.6 },
  { waveform: 'sine', detune: 700, gain: 0.3 },
  { waveform: 'sine', detune: 1200, gain: 0.1 }],

  envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 },
  filter: { type: 'highpass', frequency: 500, Q: 0.5 }
},
{
  name: 'Choir',
  oscillators: [
  { waveform: 'sawtooth', detune: -5, gain: 0.4 },
  { waveform: 'sawtooth', detune: 5, gain: 0.4 },
  { waveform: 'sine', detune: 0, gain: 0.2 }],

  envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 },
  filter: { type: 'bandpass', frequency: 1500, Q: 2 }
},
{
  name: 'Reese Bass',
  oscillators: [
  { waveform: 'sawtooth', detune: -10, gain: 0.5 },
  { waveform: 'sawtooth', detune: 10, gain: 0.5 }],

  envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 },
  filter: { type: 'lowpass', frequency: 800, Q: 3 }
},
{
  name: 'Flutey',
  oscillators: [
  { waveform: 'sine', detune: 0, gain: 0.9 },
  { waveform: 'triangle', detune: 0, gain: 0.1 }],

  envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 },
  filter: { type: 'lowpass', frequency: 3500, Q: 0.3 }
}];


// Full 88-key piano: A0 to C8
const FULL_PIANO_OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7];

function InstrumentSelect({ value, onChange, instruments, onCreateNew, customInstruments = [], onPreview }) {
  const [open, setOpen] = React.useState(false);
  const selected = instruments.find((i) => i.value === value);
  const selectedItemRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      console.log('[InstrumentSelect] Dialog opened, current value:', value);
      console.log('[InstrumentSelect] Selected item ref:', selectedItemRef.current);
      
      if (selectedItemRef.current) {
        // Delay to ensure DOM is ready
        setTimeout(() => {
          console.log('[InstrumentSelect] Scrolling to selected item');
          selectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 100);
      } else {
        console.log('[InstrumentSelect] No selected item ref found');
      }
    }
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open} className="inline-flex items-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground px-4 py-2 w-32 h-8 justify-between bg-slate-700 border-slate-600 text-white text-xs hover:bg-slate-600 hidden\n">


          <div className="flex items-center gap-1.5">
            <Guitar className="w-4 h-4 text-white/60" />
            <span>{selected?.label || 'Select...'}</span>
          </div>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0 bg-slate-800 border-slate-700">
        <Command className="bg-slate-800" value={selected?.label || ''}>
          <CommandInput placeholder="Search instrument..." className="h-8 text-xs text-white" />
          <CommandList>
            <CommandEmpty className="text-white/50 text-xs py-2 text-center">
              No instrument found.
            </CommandEmpty>
            <CommandGroup>
              {instruments.map((inst) => {
                const isSelected = inst.value === value;
                return (
                  <CommandItem
                    key={inst.value}
                    value={inst.label}
                    ref={isSelected ? selectedItemRef : null}
                    onSelect={() => {
                      onChange(inst.value);
                      setOpen(false);
                    }}
                    className="text-white text-xs cursor-pointer flex items-center justify-between group"
                  >

                  <span>{inst.label}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPreview) onPreview(inst.value);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity"
                    title="Preview sound"
                  >
                    ▶
                  </button>
                  </CommandItem>
                  );
                  })}
                  </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>);

}

export default function PianoKeyboard({ activeNotes = [], instrument = 'organ', onInstrumentChange, onPressedNotesChange, onTogglePanel, onPopOut, onNotePress, onNoteRelease, effects: externalEffects, onEffectsChange: externalOnEffectsChange, envelope: externalEnvelope, onEnvelopeChange: externalOnEnvelopeChange, openWaveEditor: externalOpenWaveEditor, customInstruments: externalCustomInstruments = [], onSaveInstrument, onDeleteInstrument, onVoiceInstrumentChange }) {
  const octaves = FULL_PIANO_OCTAVES;
  const [showKeys, setShowKeys] = useState(false);
  const [pressedNotes, setPressedNotes] = useState(new Set());
  const effects = externalEffects || { reverb: 0.3, delay: 0, chorus: 0 };
  const setEffects = externalOnEffectsChange || (() => {});
  const envelope = externalEnvelope || { attack: 0.02, sustain: 0.7, release: 0.3 };
  const setEnvelope = externalOnEnvelopeChange || (() => {});
  const activeOscillators = useRef({});
  const isDraggingRef = useRef(false);
  const [showWaveEditor, setShowWaveEditor] = useState(false);
  const customInstruments = externalCustomInstruments;

  // Handle external trigger to open wave editor
  useEffect(() => {
    if (externalOpenWaveEditor) {
      console.log('[PianoKeyboard] External trigger to open wave editor');
      setShowWaveEditor(true);
    }
  }, [externalOpenWaveEditor]);
  
  // Debug: Log when dialog state changes
  useEffect(() => {
    console.log('[PianoKeyboard] showWaveEditor changed to:', showWaveEditor);
  }, [showWaveEditor]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const isCreatingInstrumentRef = useRef(false);

  // Combined instruments list
  const allInstruments = [
  ...DEFAULT_INSTRUMENTS,
  ...PRESET_LIBRARY.map((inst, i) => ({ value: `preset_${i}`, label: inst.name, preset: inst })),
  ...customInstruments.map((inst, i) => ({ value: `custom_${i}`, label: inst.name, custom: inst }))];




  // Get custom/preset/builtin instrument config if selected
  const getCustomConfig = useCallback(() => {
    if (instrument.startsWith('custom_')) {
      const index = parseInt(instrument.split('_')[1]);
      return customInstruments[index];
    }
    if (instrument.startsWith('preset_')) {
      const index = parseInt(instrument.split('_')[1]);
      return PRESET_LIBRARY[index];
    }
    // Check if it's a built-in instrument with custom config
    if (BUILTIN_INSTRUMENTS[instrument]) {
      return BUILTIN_INSTRUMENTS[instrument];
    }
    return null;
  }, [instrument, customInstruments]);

  const handlePreview = useCallback(async (instrumentValue) => {
    initAudio();
    
    // Check if it's a custom or preset instrument
    if (instrumentValue.startsWith('custom_')) {
      const index = parseInt(instrumentValue.split('_')[1]);
      const customConfig = customInstruments[index];
      if (customConfig) {
        await playNoteWithCustomInstrument('C4', 0.5, 0.7, customConfig);
      }
    } else if (instrumentValue.startsWith('preset_')) {
      const index = parseInt(instrumentValue.split('_')[1]);
      const presetConfig = PRESET_LIBRARY[index];
      if (presetConfig) {
        await playNoteWithCustomInstrument('C4', 0.5, 0.7, presetConfig);
      }
    } else {
      playNote('C4', 0.5, 0.7, 0, instrumentValue);
    }
  }, [customInstruments]);

  const handleEffectChange = (effect, value) => {
    const numValue = parseFloat(value);
    setEffects((prev) => ({ ...prev, [effect]: numValue }));
    setEffectLevel(effect, numValue);
  };

  const handleEnvelopeChange = (param, value) => {
    const numValue = parseFloat(value);
    const newEnvelope = { ...envelope, [param]: numValue };
    setEnvelope(newEnvelope);
    setGlobalEnvelope(newEnvelope);
  };

  const whiteKeyWidth = 24;
  const blackKeyWidth = 14;
  const octaveWidth = whiteKeyWidth * 7;

  const isNoteActive = (note, octave) => {
    const fullNote = `${note}${octave}`;
    return activeNotes.findIndex((n) => n.pitch === fullNote);
  };

  const isNotePressed = (note, octave) => {
    return pressedNotes.has(`${note}${octave}`);
  };

  const startNote = useCallback(async (pitch) => {
    if (activeOscillators.current[pitch]) return; // Already playing

    await initAudio();
    const customConfig = getCustomConfig();

    if (customConfig) {
      // Use custom instrument - DON'T store the result as it's not a sustaining note
      playNoteWithCustomInstrument(pitch, 2, envelope.sustain, customConfig);
      // Mark as playing but don't store oscillator object
      activeOscillators.current[pitch] = true;
    } else {
      // Use built-in instrument
      const oscObj = playNoteSustain(pitch, envelope.sustain, 0, instrument, envelope.attack);
      activeOscillators.current[pitch] = oscObj;
    }
    setPressedNotes((prev) => {
      const next = new Set([...prev, pitch]);
      onPressedNotesChange?.(next);
      return next;
    });

    // Notify parent about note press for recording
    onNotePress?.(pitch);
  }, [instrument, envelope, customInstruments, onPressedNotesChange, onNotePress, getCustomConfig]);

  const endNote = useCallback((pitch) => {
    if (activeOscillators.current[pitch]) {
      // Only call stopNoteSustain if it's an oscillator object (built-in instruments)
      // Custom instruments handle their own duration, so we don't need to stop them
      if (typeof activeOscillators.current[pitch] === 'object' && activeOscillators.current[pitch] !== true) {
        stopNoteSustain(activeOscillators.current[pitch], envelope.release);
      }
      delete activeOscillators.current[pitch];
      setPressedNotes((prev) => {
        const next = new Set(prev);
        next.delete(pitch);
        onPressedNotesChange?.(next);
        return next;
      });
      
      // Notify parent about note release for recording
      onNoteRelease?.(pitch);
    }
  }, [envelope.release, onNoteRelease, onPressedNotesChange]);

  const handleMouseDown = useCallback(async (e, note, octave) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const pitch = `${note}${octave}`;
    await startNote(pitch);
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
    Object.keys(activeOscillators.current).forEach((pitch) => {
      endNote(pitch);
    });
  }, [endNote]);

  // Handle computer keyboard input
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Don't trigger piano when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return;
      // Don't trigger piano for modifier key combinations (undo/redo/copy/paste etc)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const pitch = KEY_MAP[e.key.toLowerCase()];
      if (pitch) {
        e.preventDefault();
        await startNote(pitch);
      }
    };

    const handleKeyUp = (e) => {
      // Don't trigger piano when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
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
      Object.values(activeOscillators.current).forEach((osc) => {
        if (typeof osc === 'object') {
          stopNoteSustain(osc);
        }
      });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Audio visualizer - Logic Pro style with more detail
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas resolution to match display size with higher DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Smoothing array for more fluid animation
    const smoothingFactor = 0.7;
    let previousData = null;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const analyserNode = getAnalyser();
      if (!analyserNode) {
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, rect.width, rect.height);
        return;
      }

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      // Smooth the data
      if (previousData) {
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = previousData[i] * smoothingFactor + dataArray[i] * (1 - smoothingFactor);
        }
      }
      previousData = new Uint8Array(dataArray);

      // Clear with subtle gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      bgGradient.addColorStop(0, '#1A1A1A');
      bgGradient.addColorStop(1, '#0F0F0F');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // More bars for higher detail (Logic Pro style)
      const numBars = 80;
      const barWidth = rect.width / numBars;
      const gap = 1.5;

      for (let i = 0; i < numBars; i++) {
        // Sample multiple frequencies for each bar for better detail
        const startIdx = Math.floor(i / numBars * bufferLength);
        const endIdx = Math.floor((i + 1) / numBars * bufferLength);
        let sum = 0;
        let count = 0;
        for (let j = startIdx; j < endIdx; j++) {
          sum += dataArray[j];
          count++;
        }
        const value = count > 0 ? sum / count : 0;

        const labelSpace = 16; // Reserve space for labels
        const barHeight = value / 255 * (rect.height - labelSpace) * 0.85;
        const x = i * barWidth;

        // Logic Pro style gradient - blue to green to yellow to red
        const gradient = ctx.createLinearGradient(x, rect.height - barHeight, x, rect.height);

        if (barHeight < rect.height * 0.3) {
          // Low levels - blue/cyan
          gradient.addColorStop(0, '#00D4FF');
          gradient.addColorStop(1, '#0088FF');
        } else if (barHeight < rect.height * 0.6) {
          // Mid levels - green/yellow
          gradient.addColorStop(0, '#00FF88');
          gradient.addColorStop(0.5, '#88FF00');
          gradient.addColorStop(1, '#00D4FF');
        } else if (barHeight < rect.height * 0.8) {
          // High levels - yellow/orange
          gradient.addColorStop(0, '#FFCC00');
          gradient.addColorStop(0.5, '#00FF88');
          gradient.addColorStop(1, '#00D4FF');
        } else {
          // Peak levels - red/orange
          gradient.addColorStop(0, '#FF3333');
          gradient.addColorStop(0.3, '#FFAA00');
          gradient.addColorStop(0.6, '#00FF88');
          gradient.addColorStop(1, '#00D4FF');
        }

        ctx.fillStyle = gradient;

        // Draw bar with rounded top
        const radius = 2;
        ctx.beginPath();
        ctx.moveTo(x, rect.height);
        ctx.lineTo(x, rect.height - barHeight + radius);
        ctx.arcTo(x, rect.height - barHeight, x + barWidth - gap, rect.height - barHeight, radius);
        ctx.lineTo(x + barWidth - gap, rect.height);
        ctx.closePath();
        ctx.fill();

        // Add subtle glow for higher values
        if (value > 180) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = barHeight > rect.height * 0.8 ? '#FF3333' : '#00FF88';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Add subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = rect.height / 4 * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }

      // Add frequency markers (20Hz - 20kHz range)
      const freqMarkers = [
      { freq: '20Hz', pos: 0.02 },
      { freq: '100Hz', pos: 0.15 },
      { freq: '500Hz', pos: 0.35 },
      { freq: '1kHz', pos: 0.5 },
      { freq: '5kHz', pos: 0.75 },
      { freq: '10kHz', pos: 0.9 }];


      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      freqMarkers.forEach((marker) => {
        const x = marker.pos * rect.width;
        ctx.fillText(marker.freq, x, 10);
      });
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
    <div className="bg-[#2D2D2D] rounded-xl p-2 sm:p-3 border border-[#3A3A3A] max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-2 gap-2">
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-3">
          <div className="relative" style={{ width: totalWidth + whiteKeyWidth * 3, height: 80 }}>
            {/* Generate all 88 keys - A0 to C8 */}
          {(() => {
              const keys = [];
              let whiteKeyIndex = 0;

              // Extra greyed out keys below A0 to fill left side (4 more + 2 existing)
              const extraLowKeys = ['C', 'D', 'E', 'F', 'G', 'A'];
              extraLowKeys.forEach((note, idx) => {
                keys.push(
                  <div
                    key={`extra-low-${note}`}
                    className="absolute bottom-0 border border-slate-400 rounded-b opacity-30 cursor-not-allowed flex items-end justify-center pb-0.5"
                    style={{
                      left: idx * whiteKeyWidth,
                      width: whiteKeyWidth - 1,
                      height: 75,
                      backgroundColor: '#D0D0D0'
                    }} />

                );
              });

              // Extra low black keys (C#, D#, F#, G#)
              const extraLowBlackOffsets = [14, 38, 86, 110];
              extraLowBlackOffsets.forEach((offset, idx) => {
                keys.push(
                  <div
                    key={`extra-low-black-${idx}`}
                    className="absolute top-0 rounded-b z-10 opacity-30 cursor-not-allowed"
                    style={{
                      left: offset * (whiteKeyWidth / 24),
                      width: blackKeyWidth,
                      height: 45,
                      backgroundColor: '#3A3A3A'
                    }} />

                );
              });

              whiteKeyIndex = 6; // Start real keys after the 6 extra ones

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
                      height: 75,
                      backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5'
                    }}>

                  {showKeys && getKeyLabel(note, 0) &&
                    <span className="text-[8px] font-bold text-slate-500 mb-0.5">{getKeyLabel(note, 0)}</span>
                    }
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
                  className="absolute top-0 rounded-b z-10 cursor-pointer flex items-end justify-center pb-1"
                  style={{
                    left: (whiteKeyIndex - 2) * whiteKeyWidth + 134 * (whiteKeyWidth / 24),
                    width: blackKeyWidth,
                    height: 45,
                    backgroundColor: a0SharpPressed ? '#D4A574' : a0SharpActive !== -1 ? VOICE_COLORS[a0SharpActive] : '#1E293B'
                  }} />

              );

              // Full octaves 1-7
              for (let octave = 1; octave <= 7; octave++) {
                const octaveStartWhite = whiteKeyIndex;

                OCTAVE_NOTES.filter((n) => !n.isBlack).forEach((key) => {
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
                        height: 75,
                        backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5'
                      }}>

                    {showKeys && keyLabel &&
                      <span className="text-[8px] font-bold text-slate-500 mb-0.5">{keyLabel}</span>
                      }
                    {key.note === 'C' && <span className="text-[8px] text-slate-400">C{octave}</span>}
                  </div>
                  );
                  whiteKeyIndex++;
                });

                // Black keys for this octave
                OCTAVE_NOTES.filter((n) => n.isBlack).forEach((key) => {
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
                        height: 45,
                        backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#1E293B'
                      }}>

                    {showKeys && blackKeyLabel &&
                      <span className="text-[7px] font-bold text-white/70">{blackKeyLabel}</span>
                      }
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
                    height: 75,
                    backgroundColor: c8Pressed ? '#D4A574' : c8Active !== -1 ? VOICE_COLORS[c8Active] : '#F5F5F5'
                  }}>

                <span className="text-[8px] text-slate-400">C8</span>
              </div>
              );
              whiteKeyIndex++;

              // Add 9 extra greyed out keys at the end to fill space
              const extraHighKeys = ['C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A'];
              extraHighKeys.forEach((note, idx) => {
                const isBlack = note.includes('#');
                if (isBlack) {
                  // Black key - calculate offset based on position
                  let blackOffset;
                  if (note === 'C#') blackOffset = 14;else
                  if (note === 'D#') blackOffset = 38;else
                  if (note === 'F#') blackOffset = 86;else
                  if (note === 'G#') blackOffset = 110;

                  keys.push(
                    <div
                      key={`extra-high-black-${note}`}
                      className="absolute top-0 rounded-b z-10 opacity-30 cursor-not-allowed"
                      style={{
                        left: (whiteKeyIndex - 1) * whiteKeyWidth + blackOffset * (whiteKeyWidth / 24),
                        width: blackKeyWidth,
                        height: 45,
                        backgroundColor: '#3A3A3A'
                      }} />

                  );
                } else {
                  // White key
                  keys.push(
                    <div
                      key={`extra-high-${note}`}
                      className="absolute bottom-0 border border-slate-400 rounded-b opacity-30 cursor-not-allowed"
                      style={{
                        left: whiteKeyIndex * whiteKeyWidth,
                        width: whiteKeyWidth - 1,
                        height: 75,
                        backgroundColor: '#D0D0D0'
                      }} />

                  );
                  whiteKeyIndex++;
                }
              });

              return keys;
            })()}
        </div>
      </div>
      </div>

      {/* Wave Editor Modal */}
              <Dialog 
                open={showWaveEditor} 
                onOpenChange={(open) => {
                  console.log('[PianoKeyboard] Dialog onOpenChange:', open);
                  setShowWaveEditor(open);
                }}
                modal={true}
              >
                <DialogContent 
                  className="bg-slate-900 border-slate-700 max-w-4xl h-[92vh] overflow-y-auto p-6 z-[100000] [&>button]:text-white [&>button]:hover:text-white/80" 
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  aria-describedby="wave-editor-description"
                >
                  <DialogHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-white text-lg">Instrument Editor</DialogTitle>
                      <Button
                        onClick={async () => {
                          if (isCreatingInstrumentRef.current) return;
                          isCreatingInstrumentRef.current = true;
                          try {
                            const newIndex = customInstruments.length;
                            const nextNumber = newIndex + 1;
                            const newInstrument = { 
                              name: `Custom ${nextNumber}`,
                              oscillators: [{ waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1, phase: 0 }],
                              envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 },
                              effects: [{ type: 'filter', config: { filterType: 'lowpass', frequency: 2000, Q: 1 } }],
                              eq: [
                                { frequency: 60, gain: 0, Q: 1, type: 'lowshelf' },
                                { frequency: 250, gain: 0, Q: 1, type: 'peaking' },
                                { frequency: 1000, gain: 0, Q: 1, type: 'peaking' },
                                { frequency: 4000, gain: 0, Q: 1, type: 'peaking' },
                                { frequency: 12000, gain: 0, Q: 1, type: 'highshelf' }
                              ]
                            };
                            await onSaveInstrument(newInstrument, -1);
                            // Select the newly created instrument after save completes
                            onInstrumentChange(`custom_${newIndex}`);
                          } finally {
                            setTimeout(() => {
                              isCreatingInstrumentRef.current = false;
                            }, 500);
                          }
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        New
                      </Button>
                      <Button
                        onClick={() => {
                          if (instrument.startsWith('custom_')) {
                            const index = parseInt(instrument.split('_')[1]);
                            const customConfig = customInstruments[index];
                            if (customConfig && confirm(`Delete "${customConfig.name}"?`)) {
                              onDeleteInstrument(index);
                            }
                          }
                        }}
                        size="sm"
                        disabled={!instrument.startsWith('custom_')}
                        className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p id="wave-editor-description" className="sr-only">
                      Create and edit custom instruments with oscillators, filters, and effects
                    </p>
                  </DialogHeader>
                  <WaveEditor
                  customInstruments={customInstruments}
                  onSaveInstrument={onSaveInstrument}
                  onDeleteInstrument={onDeleteInstrument}
                  onInstrumentChange={onInstrumentChange}
                  onVoiceInstrumentChange={onVoiceInstrumentChange}
                  onClose={() => setShowWaveEditor(false)}
                  currentInstrument={instrument}
                  currentInstrumentConfig={getCustomConfig()}
                  presetLibrary={PRESET_LIBRARY}
                  onNew={() => {}} />

                </DialogContent>
              </Dialog>
    </div>);

}