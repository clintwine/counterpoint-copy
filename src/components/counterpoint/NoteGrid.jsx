import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [5, 4, 3, 2];

const NOTE_COLORS = {
  0: '#E8B885', // Voice 1 - Gold
  1: '#7B9E89', // Voice 2 - Sage
  2: '#9B8AA6', // Voice 3 - Lavender
  3: '#A68B7B', // Voice 4 - Warm brown
};

export default function NoteGrid({ voices, currentBeat, isPlaying, measures = 8, onNoteClick }) {
  const gridRef = useRef(null);
  const beatsPerMeasure = 4;
  const totalBeats = measures;

  // Generate all pitches for the grid
  const pitches = [];
  OCTAVES.forEach(octave => {
    NOTE_NAMES.forEach(note => {
      pitches.push(`${note}${octave}`);
    });
  });

  // Scroll to current beat during playback
  useEffect(() => {
    if (isPlaying && gridRef.current && currentBeat > 4) {
      const scrollPosition = (currentBeat - 4) * 48;
      gridRef.current.scrollLeft = scrollPosition;
    }
  }, [currentBeat, isPlaying]);

  const getNoteAtBeat = (voiceIndex, beat) => {
    const voice = voices[voiceIndex];
    if (!voice || !voice.notes) return null;
    return voice.notes.find(n => n.beat === beat);
  };

  const handleCellClick = (pitch, beat) => {
    if (onNoteClick) {
      onNoteClick(pitch, beat);
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-5 border border-slate-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium tracking-wide">Score</h3>
        <div className="flex gap-4">
          {voices.map((voice, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: NOTE_COLORS[i] }}
              />
              <span className="text-xs text-white/90">{voice.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div 
        ref={gridRef}
        className="overflow-x-auto overflow-y-auto max-h-[400px]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
      >
        <div className="flex">
          {/* Pitch labels - fixed column */}
          <div className="sticky left-0 z-20 bg-slate-800 flex-shrink-0">
            <div className="h-7 border-b border-slate-600" /> {/* Header spacer */}
            {pitches.map((pitch) => (
              <div 
                key={pitch}
                className={`h-7 w-14 flex items-center justify-end pr-2 text-xs border-b border-slate-700 ${
                  pitch.startsWith('C') ? 'text-amber-400 font-semibold bg-slate-750' : 'text-white/80'
                }`}
                style={{ backgroundColor: pitch.startsWith('C') ? 'rgba(251, 191, 36, 0.1)' : undefined }}
              >
                {pitch}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="flex-1">
            {/* Beat numbers header */}
            <div className="flex h-7 border-b border-slate-600">
              {Array.from({ length: totalBeats }).map((_, beat) => (
                <div 
                  key={beat}
                  className={`w-12 flex-shrink-0 flex items-center justify-center text-xs font-medium border-r ${
                    beat % beatsPerMeasure === 0 
                      ? 'border-r-slate-500 bg-slate-700/50 text-amber-400' 
                      : 'border-r-slate-700 text-white/60'
                  }`}
                >
                  {beat + 1}
                </div>
              ))}
            </div>

            {/* Note grid rows */}
            {pitches.map((pitch, pitchIndex) => (
              <div key={pitch} className="flex h-7">
                {Array.from({ length: totalBeats }).map((_, beat) => {
                  const isBarLine = beat % beatsPerMeasure === 0;
                  const isCLine = pitch.startsWith('C');
                  
                  // Check if any voice has a note at this position
                  const notesAtPosition = voices.map((_, voiceIndex) => {
                    const note = getNoteAtBeat(voiceIndex, beat);
                    if (note && note.pitch === pitch) {
                      return { voiceIndex, note };
                    }
                    return null;
                  }).filter(Boolean);

                  const isCurrentBeat = currentBeat === beat;

                  return (
                    <div
                      key={beat}
                      onClick={() => handleCellClick(pitch, beat)}
                      className={`w-12 h-7 flex-shrink-0 border-r border-b relative cursor-pointer transition-colors
                        ${isBarLine ? 'border-r-slate-500' : 'border-r-slate-700'} 
                        ${isCLine ? 'border-b-slate-500 bg-amber-400/5' : 'border-b-slate-700'}
                        ${isCurrentBeat ? 'bg-amber-500/20' : 'hover:bg-slate-700/50'}
                      `}
                    >
                      {notesAtPosition.map(({ voiceIndex, note }) => (
                        <motion.div
                          key={voiceIndex}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0.5 rounded flex items-center justify-center shadow-md"
                          style={{ 
                            backgroundColor: NOTE_COLORS[voiceIndex],
                            boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${NOTE_COLORS[voiceIndex]}` : undefined
                          }}
                        >
                          <span className="text-[10px] font-bold text-slate-900">
                            {note.pitch.replace(/\d/, '')}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <p className="text-white/50 text-xs mt-3">
        Click on grid cells to add/remove notes in the Cantus Firmus
      </p>
    </div>
  );
}