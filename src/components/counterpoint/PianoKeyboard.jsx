import React from 'react';
import { motion } from 'framer-motion';

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

export default function PianoKeyboard({ activeNotes = [], octaves = [3, 4, 5] }) {
  const whiteKeyWidth = 24;
  const blackKeyWidth = 16;
  const octaveWidth = whiteKeyWidth * 7;

  const isNoteActive = (note, octave) => {
    const fullNote = `${note}${octave}`;
    return activeNotes.findIndex(n => n.pitch === fullNote);
  };

  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
      <h3 className="text-cream/70 text-xs uppercase tracking-wider mb-3">Active Notes</h3>
      
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: octaves.length * octaveWidth, height: 80 }}>
          {octaves.map((octave, octaveIndex) => (
            <React.Fragment key={octave}>
              {/* White keys */}
              {OCTAVE_NOTES.filter(n => !n.isBlack).map((key, keyIndex) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                
                return (
                  <motion.div
                    key={`${octave}-${key.note}`}
                    className={`absolute bottom-0 border border-slate-600 rounded-b transition-colors ${
                      isActive ? '' : 'bg-cream/95 hover:bg-cream'
                    }`}
                    style={{
                      left: octaveIndex * octaveWidth + keyIndex * whiteKeyWidth,
                      width: whiteKeyWidth - 1,
                      height: 72,
                      backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : undefined
                    }}
                    animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {key.note === 'C' && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 font-medium">
                        {octave}
                      </span>
                    )}
                  </motion.div>
                );
              })}
              
              {/* Black keys */}
              {OCTAVE_NOTES.filter(n => n.isBlack).map((key) => {
                const voiceIndex = isNoteActive(key.note, octave);
                const isActive = voiceIndex !== -1;
                
                return (
                  <motion.div
                    key={`${octave}-${key.note}`}
                    className={`absolute top-0 rounded-b z-10 transition-colors ${
                      isActive ? '' : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                    style={{
                      left: octaveIndex * octaveWidth + key.offset * (whiteKeyWidth / 24),
                      width: blackKeyWidth,
                      height: 44,
                      backgroundColor: isActive ? VOICE_COLORS[voiceIndex] : undefined
                    }}
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}