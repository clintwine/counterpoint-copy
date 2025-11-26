import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [5, 4, 3, 2];

const NOTE_COLORS = {
  0: '#D4A574', // Voice 1 - Gold
  1: '#7B9E89', // Voice 2 - Sage
  2: '#9B8AA6', // Voice 3 - Lavender
  3: '#A68B7B', // Voice 4 - Warm brown
};

export default function NoteGrid({ voices, currentBeat, isPlaying, measures = 8 }) {
  const gridRef = useRef(null);
  const beatsPerMeasure = 4;
  const totalBeats = measures * beatsPerMeasure;

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

  return (
    <div className="bg-slate-900/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cream/90 font-medium tracking-wide">Score</h3>
        <div className="flex gap-4">
          {voices.map((voice, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: NOTE_COLORS[i] }}
              />
              <span className="text-xs text-cream/60">{voice.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div 
        ref={gridRef}
        className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        <div className="relative min-w-max">
          {/* Pitch labels */}
          <div className="sticky left-0 z-10 flex flex-col bg-slate-900/90 backdrop-blur">
            <div className="h-6" /> {/* Header spacer */}
            {pitches.map((pitch, i) => (
              <div 
                key={pitch}
                className={`h-6 w-12 flex items-center justify-end pr-2 text-xs border-b border-slate-800/50 ${
                  pitch.includes('C') ? 'text-cream/80 font-medium' : 'text-cream/40'
                }`}
              >
                {pitch}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="absolute left-12 top-0">
            {/* Beat numbers */}
            <div className="flex h-6">
              {Array.from({ length: totalBeats }).map((_, beat) => (
                <div 
                  key={beat}
                  className={`w-12 flex items-center justify-center text-xs border-r ${
                    beat % beatsPerMeasure === 0 
                      ? 'border-slate-600 text-cream/60 font-medium' 
                      : 'border-slate-800/30 text-cream/30'
                  }`}
                >
                  {beat % beatsPerMeasure === 0 ? beat / beatsPerMeasure + 1 : ''}
                </div>
              ))}
            </div>

            {/* Note grid */}
            {pitches.map((pitch, pitchIndex) => (
              <div key={pitch} className="flex h-6">
                {Array.from({ length: totalBeats }).map((_, beat) => {
                  const isBarLine = beat % beatsPerMeasure === 0;
                  const isCLine = pitch.includes('C');
                  
                  // Check if any voice has a note at this position
                  const notesAtPosition = voices.map((_, voiceIndex) => {
                    const note = getNoteAtBeat(voiceIndex, beat);
                    if (note && note.pitch === pitch) {
                      return { voiceIndex, note };
                    }
                    return null;
                  }).filter(Boolean);

                  return (
                    <div
                      key={beat}
                      className={`w-12 h-6 border-r border-b relative ${
                        isBarLine ? 'border-r-slate-600' : 'border-r-slate-800/30'
                      } ${isCLine ? 'border-b-slate-700' : 'border-b-slate-800/30'} ${
                        currentBeat === beat ? 'bg-gold/10' : ''
                      }`}
                    >
                      {notesAtPosition.map(({ voiceIndex, note }) => (
                        <motion.div
                          key={voiceIndex}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-1 rounded-md flex items-center justify-center"
                          style={{ 
                            backgroundColor: NOTE_COLORS[voiceIndex],
                            opacity: currentBeat === beat && isPlaying ? 1 : 0.8
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
    </div>
  );
}