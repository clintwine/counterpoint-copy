import React, { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Music, TrendingUp, AlertCircle } from 'lucide-react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteInfo(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const [, note, octave] = match;
  return { note, octave: parseInt(octave) };
}

function getInterval(pitch1, pitch2) {
  const info1 = getNoteInfo(pitch1);
  const info2 = getNoteInfo(pitch2);
  if (!info1 || !info2) return null;

  const note1 = NOTE_NAMES.indexOf(info1.note);
  const note2 = NOTE_NAMES.indexOf(info2.note);
  const octave1 = info1.octave;
  const octave2 = info2.octave;

  const semitones = Math.abs((note2 + octave2 * 12) - (note1 + octave1 * 12));
  
  const intervalNames = [
    'Unison', 'm2', 'M2', 'm3', 'M3', 'P4', 'Tritone', 'P5',
    'm6', 'M6', 'm7', 'M7', 'Octave', 'm9', 'M9', 'Minor 10th', 'Major 10th'
  ];
  
  return {
    semitones,
    name: intervalNames[semitones % 12] || `+${semitones}`,
    consonant: [0, 3, 4, 5, 7, 8, 9, 12].includes(semitones % 12),
  };
}

function analyzeChord(notes) {
  if (!notes || notes.length < 2) return null;

  const sortedNotes = [...notes].sort((a, b) => {
    const infoA = getNoteInfo(a.pitch);
    const infoB = getNoteInfo(b.pitch);
    if (!infoA || !infoB) return 0;
    return (NOTE_NAMES.indexOf(infoA.note) + infoA.octave * 12) - 
           (NOTE_NAMES.indexOf(infoB.note) + infoB.octave * 12);
  });

  const intervals = [];
  for (let i = 0; i < sortedNotes.length - 1; i++) {
    const interval = getInterval(sortedNotes[i].pitch, sortedNotes[i + 1].pitch);
    if (interval) intervals.push(interval);
  }

  const rootInterval = sortedNotes.length >= 2 ? 
    getInterval(sortedNotes[0].pitch, sortedNotes[sortedNotes.length - 1].pitch) : null;

  return {
    notes: sortedNotes,
    intervals,
    rootInterval,
    consonance: intervals.every(i => i.consonant) ? 'consonant' : 'dissonant',
  };
}

export default function HarmonicAnalyzer({ cantusFirmus, voices }) {
  const analysis = useMemo(() => {
    if (!cantusFirmus || cantusFirmus.length === 0) return null;

    // Group notes by beat
    const notesByBeat = new Map();
    
    cantusFirmus.forEach(note => {
      if (!notesByBeat.has(note.beat)) {
        notesByBeat.set(note.beat, []);
      }
      notesByBeat.get(note.beat).push({ ...note, voiceIndex: 0 });
    });

    voices?.forEach((voice, idx) => {
      voice.notes?.forEach(note => {
        if (!notesByBeat.has(note.beat)) {
          notesByBeat.set(note.beat, []);
        }
        notesByBeat.get(note.beat).push({ ...note, voiceIndex: idx + 1 });
      });
    });

    // Analyze each beat
    const beatAnalysis = Array.from(notesByBeat.entries())
      .sort(([a], [b]) => a - b)
      .slice(0, 20) // Limit to first 20 beats for performance
      .map(([beat, notes]) => ({
        beat,
        chord: analyzeChord(notes),
      }));

    // Calculate overall statistics
    const totalChords = beatAnalysis.filter(b => b.chord).length;
    const consonantChords = beatAnalysis.filter(b => b.chord?.consonance === 'consonant').length;
    const dissonantChords = totalChords - consonantChords;

    return {
      beatAnalysis,
      stats: {
        totalChords,
        consonantChords,
        dissonantChords,
        consonanceRate: totalChords > 0 ? (consonantChords / totalChords * 100).toFixed(1) : 0,
      },
    };
  }, [cantusFirmus, voices]);

  if (!analysis) {
    return (
      <div className="text-center py-8 text-white/50">
        <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Add notes to the canvas to see harmonic analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="text-white/60 text-xs mb-1">Consonance Rate</div>
          <div className="text-amber-400 text-2xl font-bold">{analysis.stats.consonanceRate}%</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="text-white/60 text-xs mb-1">Total Chords</div>
          <div className="text-white text-2xl font-bold">{analysis.stats.totalChords}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
          {analysis.stats.consonantChords} Consonant
        </Badge>
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
          {analysis.stats.dissonantChords} Dissonant
        </Badge>
      </div>

      {/* Beat-by-beat analysis */}
      <div>
        <div className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Harmonic Timeline
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {analysis.beatAnalysis.map(({ beat, chord }) => {
            if (!chord) return null;
            
            return (
              <div
                key={beat}
                className={`p-3 rounded-lg border ${
                  chord.consonance === 'consonant'
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-xs">Beat {beat}</span>
                  <Badge
                    className={
                      chord.consonance === 'consonant'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }
                  >
                    {chord.consonance}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {chord.notes.map((note, i) => (
                    <span key={i} className="text-white text-xs bg-slate-700 px-2 py-0.5 rounded">
                      {note.pitch}
                    </span>
                  ))}
                </div>
                {chord.intervals.length > 0 && (
                  <div className="text-xs text-white/50">
                    Intervals: {chord.intervals.map(i => i.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}