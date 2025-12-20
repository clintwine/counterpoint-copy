import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { initAudio, playNote } from './audioEngine';

// Musical constants
const STAFF_LINE_SPACING = 12;
const MEASURE_WIDTH = 200;
const STAFF_TOP_MARGIN = 60;
const CLEF_WIDTH = 40;
const KEY_SIG_WIDTH = 20;
const TIME_SIG_WIDTH = 40;

// Note name to staff position mapping (middle C = 0)
const NOTE_TO_STAFF_POS = {
  'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6
};

// Chromatic scale
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Key signature sharp/flat configurations
const KEY_SIGNATURES = {
  'C': { sharps: 0, flats: 0, accidentals: [] },
  'G': { sharps: 1, flats: 0, accidentals: ['F#'] },
  'D': { sharps: 2, flats: 0, accidentals: ['F#', 'C#'] },
  'A': { sharps: 3, flats: 0, accidentals: ['F#', 'C#', 'G#'] },
  'E': { sharps: 4, flats: 0, accidentals: ['F#', 'C#', 'G#', 'D#'] },
  'F': { sharps: 0, flats: 1, accidentals: ['Bb'] },
  'Bb': { sharps: 0, flats: 2, accidentals: ['Bb', 'Eb'] },
  'Eb': { sharps: 0, flats: 3, accidentals: ['Bb', 'Eb', 'Ab'] },
};

function parseNote(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const [, note, octave] = match;
  return { note, octave: parseInt(octave) };
}

function getStaffPosition(pitch, clef = 'treble') {
  const parsed = parseNote(pitch);
  if (!parsed) return 0;
  
  const { note, octave } = parsed;
  const noteName = note.replace('#', '');
  const basePos = NOTE_TO_STAFF_POS[noteName];
  
  if (clef === 'treble') {
    // Treble clef: middle C (C4) is below the staff
    const c4Pos = 6; // Position below the staff
    const octaveDiff = octave - 4;
    return c4Pos - (basePos + octaveDiff * 7);
  } else {
    // Bass clef: middle C (C4) is above the staff
    const c4Pos = -6;
    const octaveDiff = octave - 4;
    return c4Pos - (basePos + octaveDiff * 7);
  }
}

function needsAccidental(pitch, keySignature) {
  const parsed = parseNote(pitch);
  if (!parsed) return null;
  
  const keySig = KEY_SIGNATURES[keySignature] || KEY_SIGNATURES['C'];
  const hasSharp = pitch.includes('#');
  
  // Check if this accidental is in the key signature
  if (hasSharp && !keySig.accidentals.includes(pitch.replace(/\d+$/, ''))) {
    return 'sharp';
  }
  
  // Natural if key signature has it but note doesn't
  const naturalName = pitch.replace('#', '').match(/^[A-G]/)[0];
  const keyHasSharp = keySig.accidentals.some(a => a.startsWith(naturalName));
  if (keyHasSharp && !hasSharp) {
    return 'natural';
  }
  
  return null;
}

function determineClef(notes) {
  if (notes.length === 0) return 'treble';
  
  // Calculate average pitch
  const avgOctave = notes.reduce((sum, n) => {
    const parsed = parseNote(n.pitch);
    return sum + (parsed ? parsed.octave : 4);
  }, 0) / notes.length;
  
  return avgOctave < 4 ? 'bass' : 'treble';
}

export default function ScoreView({
  cantusFirmus = [],
  onNotesUpdate,
  measures = 8,
  timeSignature = '4/4',
  keySignature = 'C',
  tempo = 80,
  currentBeat,
  isPlaying,
  playheadPosition,
  onSeek,
  voices = [],
  pianoInstrument = 'organ'
}) {
  const svgRef = useRef(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [dragState, setDragState] = useState(null);
  
  const smoothPlayhead = playheadPosition !== undefined ? playheadPosition : currentBeat;
  
  // Determine clef based on note range
  const clef = useMemo(() => determineClef(cantusFirmus), [cantusFirmus]);
  
  // Get beats per measure from time signature
  const beatsPerMeasure = useMemo(() => {
    const map = { '4/4': 16, '3/4': 12, '2/4': 8, '6/8': 12, '2/2': 8 };
    return map[timeSignature] || 16;
  }, [timeSignature]);
  
  const totalBeats = measures * beatsPerMeasure;
  
  // Calculate measure for a given beat
  const getMeasure = (beat) => Math.floor(beat / beatsPerMeasure);
  
  // Get beat within measure (0-based)
  const getBeatInMeasure = (beat) => beat % beatsPerMeasure;
  
  // Convert mouse position to note
  const getPositionFromMouse = useCallback((clientX, clientY) => {
    if (!svgRef.current) return null;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Determine measure
    const measureStart = CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH;
    if (x < measureStart) return null;
    
    const measure = Math.floor((x - measureStart) / MEASURE_WIDTH);
    if (measure < 0 || measure >= measures) return null;
    
    // Determine beat within measure (simplified - just divide measure width)
    const xInMeasure = (x - measureStart) % MEASURE_WIDTH;
    const beatInMeasure = Math.floor((xInMeasure / MEASURE_WIDTH) * beatsPerMeasure);
    const beat = measure * beatsPerMeasure + beatInMeasure;
    
    // Determine pitch from y position
    const yInStaff = y - STAFF_TOP_MARGIN;
    const staffPos = Math.round(yInStaff / (STAFF_LINE_SPACING / 2));
    
    // Convert staff position to pitch
    const pitchMap = clef === 'treble' 
      ? ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'B3', 'A3', 'G3', 'F3', 'E3']
      : ['E3', 'D3', 'C3', 'B2', 'A2', 'G2', 'F2', 'E2', 'D2', 'C2', 'B1', 'A1'];
    
    const pitch = pitchMap[staffPos] || (clef === 'treble' ? 'C4' : 'C3');
    
    return { pitch, beat };
  }, [clef, measures, beatsPerMeasure]);
  
  const handleMouseDown = useCallback((e) => {
    const pos = getPositionFromMouse(e.clientX, e.clientY);
    if (!pos) return;
    
    // Check if clicking on existing note
    const existingNote = cantusFirmus.find(n => n.pitch === pos.pitch && n.beat === pos.beat);
    if (existingNote) {
      // Select or start drag
      setSelectedNotes(new Set([`${pos.pitch}-${pos.beat}`]));
      setDragState({ startX: e.clientX, startY: e.clientY, note: existingNote });
    } else {
      // Add new note
      const newNotes = [...cantusFirmus, { pitch: pos.pitch, beat: pos.beat, duration: 1, velocity: 0.8 }]
        .sort((a, b) => a.beat - b.beat);
      onNotesUpdate(newNotes);
      
      // Play sound
      initAudio();
      playNote(pos.pitch, 0.3, 0.7, 0, pianoInstrument);
    }
  }, [cantusFirmus, onNotesUpdate, getPositionFromMouse, pianoInstrument]);
  
  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;
    
    const pos = getPositionFromMouse(e.clientX, e.clientY);
    if (!pos || !dragState.note) return;
    
    // Update note position
    const newNotes = cantusFirmus.map(n => 
      n.pitch === dragState.note.pitch && n.beat === dragState.note.beat
        ? { ...n, pitch: pos.pitch, beat: pos.beat }
        : n
    ).sort((a, b) => a.beat - b.beat);
    
    onNotesUpdate(newNotes);
    setDragState({ ...dragState, note: { ...dragState.note, pitch: pos.pitch, beat: pos.beat } });
  }, [dragState, cantusFirmus, onNotesUpdate, getPositionFromMouse]);
  
  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);
  
  const handleNoteRightClick = useCallback((e, note) => {
    e.preventDefault();
    // Delete note
    const newNotes = cantusFirmus.filter(n => !(n.pitch === note.pitch && n.beat === note.beat));
    onNotesUpdate(newNotes);
  }, [cantusFirmus, onNotesUpdate]);
  
  const totalWidth = CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + (measures * MEASURE_WIDTH) + 50;
  const staffHeight = STAFF_LINE_SPACING * 8;
  
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-600 p-4 overflow-x-auto">
      <svg
        ref={svgRef}
        width={totalWidth}
        height={STAFF_TOP_MARGIN + staffHeight + 40}
        className="select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Staff lines */}
        {[0, 1, 2, 3, 4].map(line => (
          <line
            key={line}
            x1={0}
            y1={STAFF_TOP_MARGIN + line * STAFF_LINE_SPACING}
            x2={totalWidth - 50}
            y2={STAFF_TOP_MARGIN + line * STAFF_LINE_SPACING}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        ))}
        
        {/* Clef */}
        <text
          x={10}
          y={STAFF_TOP_MARGIN + 30}
          fontSize={48}
          fill="#e2e8f0"
          fontFamily="serif"
        >
          {clef === 'treble' ? '𝄞' : '𝄢'}
        </text>
        
        {/* Key signature */}
        {KEY_SIGNATURES[keySignature]?.accidentals.map((acc, i) => (
          <text
            key={i}
            x={CLEF_WIDTH + i * 12 + 5}
            y={STAFF_TOP_MARGIN + 25}
            fontSize={24}
            fill="#fbbf24"
            fontFamily="serif"
          >
            {acc.includes('#') ? '♯' : '♭'}
          </text>
        ))}
        
        {/* Time signature */}
        <text
          x={CLEF_WIDTH + KEY_SIG_WIDTH + 10}
          y={STAFF_TOP_MARGIN + 15}
          fontSize={20}
          fill="#e2e8f0"
          fontFamily="serif"
          textAnchor="middle"
        >
          {timeSignature.split('/')[0]}
        </text>
        <text
          x={CLEF_WIDTH + KEY_SIG_WIDTH + 10}
          y={STAFF_TOP_MARGIN + 35}
          fontSize={20}
          fill="#e2e8f0"
          fontFamily="serif"
          textAnchor="middle"
        >
          {timeSignature.split('/')[1]}
        </text>
        
        {/* Measure lines */}
        {Array.from({ length: measures + 1 }).map((_, i) => (
          <line
            key={i}
            x1={CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + i * MEASURE_WIDTH}
            y1={STAFF_TOP_MARGIN}
            x2={CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + i * MEASURE_WIDTH}
            y2={STAFF_TOP_MARGIN + 4 * STAFF_LINE_SPACING}
            stroke={i === measures ? '#475569' : '#64748b'}
            strokeWidth={i === 0 || i === measures ? 3 : 1.5}
          />
        ))}
        
        {/* Notes */}
        {cantusFirmus.map((note, idx) => {
          const measure = getMeasure(note.beat);
          const beatInMeasure = getBeatInMeasure(note.beat);
          const staffPos = getStaffPosition(note.pitch, clef);
          const accidental = needsAccidental(note.pitch, keySignature);
          
          const x = CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + measure * MEASURE_WIDTH + 
                    (beatInMeasure / beatsPerMeasure) * MEASURE_WIDTH + 20;
          const y = STAFF_TOP_MARGIN + staffPos * (STAFF_LINE_SPACING / 2);
          
          const isSelected = selectedNotes.has(`${note.pitch}-${note.beat}`);
          const isCurrentNote = Math.floor(smoothPlayhead) === note.beat && isPlaying;
          
          return (
            <g key={idx} onContextMenu={(e) => handleNoteRightClick(e, note)}>
              {/* Ledger lines for notes outside staff */}
              {staffPos < 0 && Array.from({ length: Math.ceil(Math.abs(staffPos) / 2) }).map((_, i) => (
                <line
                  key={`ledger-above-${i}`}
                  x1={x - 8}
                  y1={STAFF_TOP_MARGIN - (i + 1) * STAFF_LINE_SPACING}
                  x2={x + 8}
                  y2={STAFF_TOP_MARGIN - (i + 1) * STAFF_LINE_SPACING}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              ))}
              {staffPos > 8 && Array.from({ length: Math.ceil((staffPos - 8) / 2) }).map((_, i) => (
                <line
                  key={`ledger-below-${i}`}
                  x1={x - 8}
                  y1={STAFF_TOP_MARGIN + 4 * STAFF_LINE_SPACING + (i + 1) * STAFF_LINE_SPACING}
                  x2={x + 8}
                  y2={STAFF_TOP_MARGIN + 4 * STAFF_LINE_SPACING + (i + 1) * STAFF_LINE_SPACING}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              ))}
              
              {/* Accidental */}
              {accidental && (
                <text
                  x={x - 12}
                  y={y + 6}
                  fontSize={18}
                  fill="#fbbf24"
                  fontFamily="serif"
                >
                  {accidental === 'sharp' ? '♯' : '♮'}
                </text>
              )}
              
              {/* Note head */}
              <ellipse
                cx={x}
                cy={y}
                rx={6}
                ry={5}
                fill={isCurrentNote ? '#ef4444' : isSelected ? '#fbbf24' : '#e8b885'}
                stroke={isSelected ? '#fff' : 'none'}
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
              />
              
              {/* Note stem */}
              {note.duration && note.duration >= 0.5 && (
                <line
                  x1={x + 5.5}
                  y1={y}
                  x2={x + 5.5}
                  y2={y - 28}
                  stroke={isCurrentNote ? '#ef4444' : isSelected ? '#fbbf24' : '#e8b885'}
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
        
        {/* Playhead */}
        {isPlaying && (
          <line
            x1={CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + (smoothPlayhead / beatsPerMeasure) * MEASURE_WIDTH}
            y1={STAFF_TOP_MARGIN - 10}
            x2={CLEF_WIDTH + KEY_SIG_WIDTH + TIME_SIG_WIDTH + (smoothPlayhead / beatsPerMeasure) * MEASURE_WIDTH}
            y2={STAFF_TOP_MARGIN + staffHeight + 10}
            stroke="#ef4444"
            strokeWidth={2}
            opacity={0.7}
          />
        )}
      </svg>
      
      <p className="text-white/50 text-xs mt-3">
        Click to add notes • Drag notes to move • Right-click to delete
      </p>
    </div>
  );
}