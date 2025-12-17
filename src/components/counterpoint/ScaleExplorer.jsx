import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Music2, Play, Copy } from 'lucide-react';
import { initAudio, playNote } from './audioEngine';

const SCALES = {
  major: { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], formula: 'W-W-H-W-W-W-H' },
  minor: { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], formula: 'W-H-W-W-H-W-W' },
  dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], formula: 'W-H-W-W-W-H-W' },
  phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], formula: 'H-W-W-W-H-W-W' },
  lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], formula: 'W-W-W-H-W-W-H' },
  mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], formula: 'W-W-H-W-W-H-W' },
  locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], formula: 'H-W-W-H-W-W-W' },
  harmonic_minor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], formula: 'W-H-W-W-H-A2-H' },
  melodic_minor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], formula: 'W-H-W-W-W-W-H' },
  pentatonic_major: { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9], formula: 'W-W-m3-W-m3' },
  pentatonic_minor: { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10], formula: 'm3-W-W-m3-W' },
  blues: { name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10], formula: 'm3-W-H-H-m3-W' },
  whole_tone: { name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10], formula: 'W-W-W-W-W-W' },
  chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], formula: 'H-H-H-H-H-H-H-H-H-H-H-H' },
};

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildScale(root, intervals, octave = 4) {
  const rootIndex = KEYS.indexOf(root);
  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
    return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
  });
}

export default function ScaleExplorer({ onApplyScale }) {
  const [key, setKey] = useState('C');
  const [selectedScale, setSelectedScale] = useState('major');
  const [octave, setOctave] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentScale = SCALES[selectedScale];
  const scaleNotes = buildScale(key, currentScale.intervals, octave);

  const playScale = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    initAudio();

    for (let i = 0; i < scaleNotes.length; i++) {
      playNote(scaleNotes[i], 0.4, 0.7, 0, 'organ');
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsPlaying(false);
  };

  const handleApply = () => {
    if (!onApplyScale) return;
    
    const notes = scaleNotes.map((pitch, i) => ({
      pitch: pitch,
      beat: i * 2,
      duration: 2,
      velocity: 0.8,
    }));
    
    onApplyScale(notes);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/80 text-xs mb-1.5 block">Root Note</Label>
          <Select value={key} onValueChange={setKey}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {KEYS.map(k => (
                <SelectItem key={k} value={k} className="text-white">{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-white/80 text-xs mb-1.5 block">Octave</Label>
          <Select value={String(octave)} onValueChange={(v) => setOctave(Number(v))}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {[2, 3, 4, 5, 6].map(o => (
                <SelectItem key={o} value={String(o)} className="text-white">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-white/80 text-xs mb-1.5 block">Scale/Mode</Label>
        <Select value={selectedScale} onValueChange={setSelectedScale}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
            {Object.entries(SCALES).map(([key, { name }]) => (
              <SelectItem key={key} value={key} className="text-white">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
        <div>
          <div className="text-white/60 text-xs mb-1">Scale Formula</div>
          <div className="text-amber-400 text-sm font-mono">{currentScale.formula}</div>
        </div>

        <div>
          <div className="text-white/60 text-xs mb-2">Scale Notes</div>
          <div className="flex flex-wrap gap-2">
            {scaleNotes.map((note, i) => (
              <div
                key={i}
                className="bg-slate-700 px-3 py-1.5 rounded border border-slate-600 text-white text-sm font-medium"
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={playScale}
          disabled={isPlaying}
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900"
        >
          <Play className="w-4 h-4 mr-2" />
          {isPlaying ? 'Playing...' : 'Play Scale'}
        </Button>
        <Button
          onClick={handleApply}
          variant="outline"
          className="flex-1 border-amber-500 text-amber-400 hover:bg-amber-500/10"
        >
          <Copy className="w-4 h-4 mr-2" />
          Apply to Canvas
        </Button>
      </div>
    </div>
  );
}