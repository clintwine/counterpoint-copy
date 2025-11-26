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

// Full 88-key piano: A0 to C8
const FULL_PIANO_OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7];

export default function PianoKeyboard({ activeNotes = [], instrument = 'organ', onInstrumentChange }) {
  const octaves = FULL_PIANO_OCTAVES;
  const [showKeys, setShowKeys] = useState(false);
  const [pressedNotes, setPressedNotes] = useState(new Set());
  const activeOscillators = useRef({});
  
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
      // Only call stopNoteSustain if it's an oscillator object, not just a boolean
      if (typeof activeOscillators.current[pitch] === 'object') {
        stopNoteSustain(activeOscillators.current[pitch]);
      }
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
    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-600">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white/90 text-xs uppercase tracking-wider font-medium">Piano (88 Keys)</h3>
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
            Keys
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto pb-1">
        <div className="relative" style={{ width: totalWidth + whiteKeyWidth * 3, height: 80 }}>
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
                  onMouseDown={() => handleMouseDown(note, 0)}
                  onMouseUp={() => handleMouseUp(note, 0)}
                  onMouseLeave={() => handleMouseLeave(note, 0)}
                  className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex items-end justify-center pb-0.5"
                  style={{
                    left: whiteKeyIndex * whiteKeyWidth,
                    width: whiteKeyWidth - 1,
                    height: 70,
                    backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                  }}
                >
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
                onMouseDown={() => handleMouseDown('A#', 0)}
                onMouseUp={() => handleMouseUp('A#', 0)}
                onMouseLeave={() => handleMouseLeave('A#', 0)}
                className="absolute top-0 rounded-b z-10 cursor-pointer"
                style={{
                  left: whiteKeyWidth - blackKeyWidth / 2,
                  width: blackKeyWidth,
                  height: 45,
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
                
                keys.push(
                  <div
                    key={`${octave}-${key.note}`}
                    onMouseDown={() => handleMouseDown(key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex items-end justify-center pb-0.5"
                    style={{
                      left: whiteKeyIndex * whiteKeyWidth,
                      width: whiteKeyWidth - 1,
                      height: 70,
                      backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                    }}
                  >
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
                
                keys.push(
                  <div
                    key={`${octave}-${key.note}`}
                    onMouseDown={() => handleMouseDown(key.note, octave)}
                    onMouseUp={() => handleMouseUp(key.note, octave)}
                    onMouseLeave={() => handleMouseLeave(key.note, octave)}
                    className="absolute top-0 rounded-b z-10 cursor-pointer"
                    style={{
                      left: octaveStartWhite * whiteKeyWidth + key.offset * (whiteKeyWidth / 24),
                      width: blackKeyWidth,
                      height: 45,
                      backgroundColor: isPressed ? '#D4A574' : isActive ? VOICE_COLORS[voiceIndex] : '#1E293B',
                    }}
                  />
                );
              });
            }
            
            // C8 (final key)
            const c8Active = isNoteActive('C', 8);
            const c8Pressed = isNotePressed('C', 8);
            keys.push(
              <div
                key="8-C"
                onMouseDown={() => handleMouseDown('C', 8)}
                onMouseUp={() => handleMouseUp('C', 8)}
                onMouseLeave={() => handleMouseLeave('C', 8)}
                className="absolute bottom-0 border border-slate-400 rounded-b cursor-pointer select-none flex items-end justify-center pb-0.5"
                style={{
                  left: whiteKeyIndex * whiteKeyWidth,
                  width: whiteKeyWidth - 1,
                  height: 70,
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
      
      <p className="text-white/50 text-[10px] mt-1">
        Click keys or use keyboard (Z-M, Q-P rows)
      </p>
    </div>
  );
}