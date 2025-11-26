import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { initAudio, playNote } from './audioEngine';

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
  'a': 'C4', 'w': 'C#4', 's': 'D4', 'e': 'D#4', 'd': 'E4', 'f': 'F4',
  't': 'F#4', 'g': 'G4', 'y': 'G#4', 'h': 'A4', 'u': 'A#4', 'j': 'B4',
  'k': 'C5', 'o': 'C#5', 'l': 'D5', 'p': 'D#5', ';': 'E5'
};

export default function PianoKeyboard({ activeNotes = [], octaves = [3, 4, 5] }) {
  const whiteKeyWidth = 24;
  const blackKeyWidth = 16;
  const octaveWidth = whiteKeyWidth * 7;

  const isNoteActive = (note, octave) => {
    const fullNote = `${note}${octave}`;
    return activeNotes.findIndex(n => n.pitch === fullNote);
  };

  const handleKeyClick = useCallback((note, octave) => {
    initAudio();
    const pitch = `${note}${octave}`;
    playNote(pitch, 0.5, 0.8, 0);
  }, []);

  // Handle computer keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      const pitch = KEY_MAP[e.key.toLowerCase()];
      if (pitch) {
        initAudio();
        playNote(pitch, 0.5, 0.8, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-600">
      <h3 className="text-white/90 text-xs uppercase tracking-wider mb-3 font-medium">Active Notes</h3>
      
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: octaves.length * octaveWidth, height: 80 }}>
          {octaves.map((octave, octaveIndex) => (
            <React.Fragment key={octave}>
              {/* White keys */}
              {OCTAVE_NOTES.filter(n => !n.isBlack).map((key, keyIndex) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                
                return (
                  <motion.button
                    key={`${octave}-${key.note}`}
                    onClick={() => handleKeyClick(key.note, octave)}
                    className="absolute bottom-0 border border-slate-500 rounded-b transition-colors cursor-pointer focus:outline-none"
                    style={{
                      left: octaveIndex * octaveWidth + keyIndex * whiteKeyWidth,
                      width: whiteKeyWidth - 1,
                      height: 72,
                      backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : '#F5F5F5',
                    }}
                    whileHover={{ backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : '#E5E5E5' }}
                    whileTap={{ backgroundColor: '#D4A574', scale: 0.98 }}
                    animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {key.note === 'C' && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 font-medium">
                        {octave}
                      </span>
                    )}
                  </motion.button>
                );
              })}
              
              {/* Black keys */}
              {OCTAVE_NOTES.filter(n => n.isBlack).map((key) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                
                return (
                  <motion.button
                    key={`${octave}-${key.note}`}
                    onClick={() => handleKeyClick(key.note, octave)}
                    className="absolute top-0 rounded-b z-10 transition-colors cursor-pointer focus:outline-none"
                    style={{
                      left: octaveIndex * octaveWidth + key.offset * (whiteKeyWidth / 24),
                      width: blackKeyWidth,
                      height: 44,
                      backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : '#1E293B',
                    }}
                    whileHover={{ backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : '#334155' }}
                    whileTap={{ backgroundColor: '#D4A574', scale: 0.98 }}
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <p className="text-white/50 text-[10px] mt-2">
        Click keys or use keyboard (A-L for white keys, W/E/T/Y/U/O/P for black keys)
      </p>
    </div>
  );
}