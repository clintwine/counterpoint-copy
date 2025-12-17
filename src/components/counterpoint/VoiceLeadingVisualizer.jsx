import React, { useMemo } from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteInfo(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const [, note, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  return { note, octave: parseInt(octave), midiNumber: noteIndex + parseInt(octave) * 12 };
}

function analyzeMotion(note1, note2) {
  const info1 = getNoteInfo(note1);
  const info2 = getNoteInfo(note2);
  if (!info1 || !info2) return null;

  const diff = info2.midiNumber - info1.midiNumber;
  
  return {
    type: diff > 0 ? 'ascending' : diff < 0 ? 'descending' : 'static',
    semitones: Math.abs(diff),
    stepwise: Math.abs(diff) <= 2,
  };
}

export default function VoiceLeadingVisualizer({ cantusFirmus, voices }) {
  const analysis = useMemo(() => {
    if (!cantusFirmus || cantusFirmus.length < 2) return null;

    const sortedNotes = [...cantusFirmus].sort((a, b) => a.beat - b.beat);
    
    const movements = [];
    for (let i = 0; i < sortedNotes.length - 1; i++) {
      const motion = analyzeMotion(sortedNotes[i].pitch, sortedNotes[i + 1].pitch);
      if (motion) {
        movements.push({
          from: sortedNotes[i],
          to: sortedNotes[i + 1],
          motion,
        });
      }
    }

    // Calculate statistics
    const stepwise = movements.filter(m => m.motion.stepwise).length;
    const leaps = movements.filter(m => !m.motion.stepwise).length;
    const ascending = movements.filter(m => m.motion.type === 'ascending').length;
    const descending = movements.filter(m => m.motion.type === 'descending').length;
    const static_ = movements.filter(m => m.motion.type === 'static').length;

    return {
      movements,
      stats: {
        total: movements.length,
        stepwise,
        leaps,
        ascending,
        descending,
        static: static_,
        stepwisePercent: movements.length > 0 ? (stepwise / movements.length * 100).toFixed(1) : 0,
      },
    };
  }, [cantusFirmus]);

  if (!analysis) {
    return (
      <div className="text-center py-8 text-white/50">
        <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Add at least 2 notes to visualize voice leading</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
          <div className="text-white/60 text-[10px] mb-0.5">Stepwise</div>
          <div className="text-green-400 text-lg font-bold">{analysis.stats.stepwise}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
          <div className="text-white/60 text-[10px] mb-0.5">Leaps</div>
          <div className="text-amber-400 text-lg font-bold">{analysis.stats.leaps}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
          <div className="text-white/60 text-[10px] mb-0.5">Stepwise %</div>
          <div className="text-white text-lg font-bold">{analysis.stats.stepwisePercent}%</div>
        </div>
      </div>

      {/* Motion type distribution */}
      <div className="flex gap-2 text-xs">
        <div className="flex items-center gap-1 text-white/60">
          <TrendingUp className="w-3 h-3 text-blue-400" />
          {analysis.stats.ascending} up
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <TrendingDown className="w-3 h-3 text-red-400" />
          {analysis.stats.descending} down
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <Minus className="w-3 h-3 text-gray-400" />
          {analysis.stats.static} static
        </div>
      </div>

      {/* Movement visualization */}
      <div>
        <div className="text-white/80 text-sm font-medium mb-2">Voice Movements</div>
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
          {analysis.movements.slice(0, 30).map((movement, i) => {
            const { from, to, motion } = movement;
            const Icon = motion.type === 'ascending' ? TrendingUp : motion.type === 'descending' ? TrendingDown : Minus;
            const color = motion.stepwise ? 'text-green-400' : 'text-amber-400';
            
            return (
              <div
                key={i}
                className="flex items-center gap-2 p-2 bg-slate-800/30 rounded border border-slate-700/50"
              >
                <span className="text-white/70 text-xs w-12">
                  Beat {from.beat}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-white text-xs font-mono bg-slate-700 px-2 py-0.5 rounded">
                    {from.pitch}
                  </span>
                  <Icon className={`w-3 h-3 ${color}`} />
                  <span className="text-white text-xs font-mono bg-slate-700 px-2 py-0.5 rounded">
                    {to.pitch}
                  </span>
                </div>
                <span className={`text-xs ${color}`}>
                  {motion.semitones > 0 ? `${motion.semitones}st` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}