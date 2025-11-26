import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Keyboard, Guitar } from 'lucide-react';
import { initAudio, playNoteSustain, stopNoteSustain, playNote } from './audioEngine';

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

const INSTRUMENTS = [
  { value: 'organ', label: 'Organ' },
  { value: 'distortion', label: 'Distortion' },
  { value: 'clean', label: 'Clean' },
  { value: 'bass', label: 'Bass' },
  { value: 'strings', label: 'Strings' },
  { value: 'flute', label: 'Flute' },
  { value: 'synth', label: 'Synth' },
];

export default function PianoKeyboard({ activeNotes = [], octaves = [3, 4, 5], instrument = 'organ', onInstrumentChange }) {
  const [showKeys, setShowKeys] = useState(false);
  const [pressedNotes, setPressedNotes] = useState(new Set());
  const activeOscillators = useRef({});
  
  const whiteKeyWidth = 28;
  const blackKeyWidth = 18;
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
    // Use playNote with instrument for better sound variety
    playNote(pitch, 0.5, 0.7, 0, instrument);
    activeOscillators.current[pitch] = true; // Mark as playing
    setPressedNotes(prev => new Set([...prev, pitch]));
    
    // Auto-release after duration
    setTimeout(() => {
      delete activeOscillators.current[pitch];
      setPressedNotes(prev => {
        const next = new Set(prev);
        next.delete(pitch);
        return next;
      });
    }, 500);
  }, [instrument]);

  const endNote = useCallback((pitch) => {
    if (activeOscillators.current[pitch]) {
      stopNoteSustain(activeOscillators.current[pitch]);
      delete activeOscillators.current[pitch];
      setPressedNotes(prev => {
        const next = new Set(prev);
        next.delete(pitch);
        return next;
      });
    }
  }, []);

  const handleMouseDown = useCallback((note, octave) => {
    const pitch = `${note}${octave}`;
    startNote(pitch);
  }, [startNote]);

  const handleMouseUp = useCallback((note, octave) => {
    const pitch = `${note}${octave}`;
    endNote(pitch);
  }, [endNote]);

  const handleMouseLeave = useCallback((note, octave) => {
    const pitch = `${note}${octave}`;
    if (pressedNotes.has(pitch)) {
      endNote(pitch);
    }
  }, [endNote, pressedNotes]);

  // Handle computer keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger piano when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) return;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(activeOscillators.current).forEach(osc => {
        stopNoteSustain(osc);
      });
    };
  }, []);

  const getKeyLabel = (note, octave) => {
    const pitch = `${note}${octave}`;
    return PITCH_TO_KEY[pitch] || '';
  };

  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white/90 text-xs uppercase tracking-wider font-medium">Piano</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Guitar className="w-3.5 h-3.5 text-white/60" />
            <Select value={instrument} onValueChange={onInstrumentChange}>
              <SelectTrigger className="w-24 h-7 bg-slate-700 border-slate-600 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {INSTRUMENTS.map(inst => (
                  <SelectItem key={inst.value} value={inst.value} className="text-white text-xs">
                    {inst.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeys(!showKeys)}
            className={`h-7 px-2 text-xs ${showKeys ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white'}`}
          >
            <Keyboard className="w-3.5 h-3.5 mr-1" />
            {showKeys ? 'Hide' : 'Show'} Keys
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: octaves.length * octaveWidth, height: 100 }}>
          {octaves.map((octave, octaveIndex) => (
            <React.Fragment key={octave}>
              {/* White keys */}
              {OCTAVE_NOTES.filter(n => !n.isBlack).map((key, keyIndex) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                const isPressed = isNotePressed(key.note, octave);
                const keyLabel = getKeyLabel(key.note, octave);
                
                return (
                  <motion.div
                    key={`${octave}-${key.note}`}
                    onMouseDown={() => handleMouseDown(key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex flex-col items-center justify-end pb-1"
                    style={{
                      left: octaveIndex * octaveWidth + keyIndex * whiteKeyWidth,
                      width: whiteKeyWidth - 1,
                      height: 90,
                      backgroundColor: isPressed ? '#D4A574' : (isActive && voiceIndex !== -1) ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                      boxShadow: isPressed ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                    animate={(isActive && voiceIndex !== -1) && !isPressed ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {showKeys && keyLabel && (
                      <span className="text-[9px] font-bold text-slate-500 mb-0.5">
                        {keyLabel}
                      </span>
                    )}
                    {key.note === 'C' && (
                      <span className="text-[9px] text-slate-400 font-medium">
                        C{octave}
                      </span>
                    )}
                  </motion.div>
                );
              })}
              
              {/* Black keys */}
              {OCTAVE_NOTES.filter(n => n.isBlack).map((key) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                const isPressed = isNotePressed(key.note, octave);
                const keyLabel = getKeyLabel(key.note, octave);
                
                return (
                  <motion.div
                    key={`${octave}-${key.note}`}
                    onMouseDown={() => handleMouseDown(key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute top-0 rounded-b z-10 cursor-pointer select-none flex items-end justify-center pb-1"
                    style={{
                      left: octaveIndex * octaveWidth + key.offset * (whiteKeyWidth / 24),
                      width: blackKeyWidth,
                      height: 55,
                      backgroundColor: isPressed ? '#D4A574' : (isActive && voiceIndex !== -1) ? VOICE_COLORS[voiceIndex] : '#1E293B',
                      boxShadow: isPressed ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : '0 3px 6px rgba(0,0,0,0.3)',
                    }}
                    animate={(isActive && voiceIndex !== -1) && !isPressed ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {showKeys && keyLabel && (
                      <span className="text-[8px] font-bold text-white/70">
                        {keyLabel}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <p className="text-white/50 text-[10px] mt-2">
        Click and hold keys or use your computer keyboard to play
      </p>
    </div>
  );
}