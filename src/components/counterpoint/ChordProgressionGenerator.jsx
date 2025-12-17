import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Music, Sparkles, Copy } from 'lucide-react';

const CHORD_PROGRESSIONS = {
  'I-IV-V-I': { name: 'Classic (I-IV-V-I)', chords: [0, 3, 4, 0] },
  'I-V-vi-IV': { name: 'Pop (I-V-vi-IV)', chords: [0, 4, 5, 3] },
  'ii-V-I': { name: 'Jazz (ii-V-I)', chords: [1, 4, 0] },
  'I-vi-IV-V': { name: '50s (I-vi-IV-V)', chords: [0, 5, 3, 4] },
  'vi-IV-I-V': { name: 'Sensitive (vi-IV-I-V)', chords: [5, 3, 0, 4] },
  'I-IV-vi-V': { name: 'Ballad (I-IV-vi-V)', chords: [0, 3, 5, 4] },
  'I-iii-IV-V': { name: 'Ascending (I-iii-IV-V)', chords: [0, 2, 3, 4] },
  'I-bVII-IV-I': { name: 'Mixolydian (I-bVII-IV-I)', chords: [0, 6, 3, 0] },
};

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
};

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getChordName(root, quality) {
  const qualities = { major: '', minor: 'm', diminished: 'dim', augmented: 'aug' };
  return `${NOTE_NAMES[root % 12]}${qualities[quality] || ''}`;
}

function buildChord(rootNote, quality, octave = 4) {
  const intervals = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
  };
  
  const baseNotes = intervals[quality] || intervals.major;
  return baseNotes.map(interval => {
    const noteIndex = (rootNote + interval) % 12;
    const noteOctave = octave + Math.floor((rootNote + interval) / 12);
    return `${NOTE_NAMES[noteIndex]}${noteOctave}`;
  });
}

function getScaleChords(key, mode) {
  const keyIndex = KEYS.indexOf(key);
  const scale = SCALES[mode] || SCALES.major;
  
  const chordQualities = mode === 'minor' || mode === 'harmonic_minor' || mode === 'melodic_minor'
    ? ['minor', 'diminished', 'major', 'minor', 'major', 'major', 'diminished']
    : ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
  
  return scale.map((degree, i) => ({
    root: (keyIndex + degree) % 12,
    quality: chordQualities[i],
    degree: i + 1,
  }));
}

export default function ChordProgressionGenerator({ onApplyProgression }) {
  const [key, setKey] = useState('C');
  const [mode, setMode] = useState('major');
  const [selectedPattern, setSelectedPattern] = useState('I-IV-V-I');
  const [voicing, setVoicing] = useState('close');
  const [generatedProgression, setGeneratedProgression] = useState(null);

  const handleGenerate = () => {
    const pattern = CHORD_PROGRESSIONS[selectedPattern];
    const scaleChords = getScaleChords(key, mode);
    
    const progression = pattern.chords.map((degreeIndex, i) => {
      const chord = scaleChords[degreeIndex];
      const octave = voicing === 'close' ? 4 : 3 + (i % 2);
      const notes = buildChord(chord.root, chord.quality, octave);
      
      return {
        name: getChordName(chord.root, chord.quality),
        quality: chord.quality,
        degree: chord.degree,
        notes: notes,
      };
    });
    
    setGeneratedProgression(progression);
  };

  const handleApply = () => {
    if (!generatedProgression || !onApplyProgression) return;
    
    const notes = [];
    let currentBeat = 0;
    const beatsPerChord = 4;
    
    generatedProgression.forEach(chord => {
      chord.notes.forEach((pitch, idx) => {
        notes.push({
          pitch: pitch,
          beat: currentBeat,
          duration: beatsPerChord,
          velocity: 0.7 - idx * 0.1,
        });
      });
      currentBeat += beatsPerChord;
    });
    
    onApplyProgression(notes);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/80 text-xs mb-1.5 block">Key</Label>
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
          <Label className="text-white/80 text-xs mb-1.5 block">Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="major" className="text-white">Major</SelectItem>
              <SelectItem value="minor" className="text-white">Minor</SelectItem>
              <SelectItem value="harmonic_minor" className="text-white">Harmonic Minor</SelectItem>
              <SelectItem value="melodic_minor" className="text-white">Melodic Minor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-white/80 text-xs mb-1.5 block">Progression Pattern</Label>
        <Select value={selectedPattern} onValueChange={setSelectedPattern}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {Object.entries(CHORD_PROGRESSIONS).map(([key, { name }]) => (
              <SelectItem key={key} value={key} className="text-white">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-white/80 text-xs mb-1.5 block">Voicing</Label>
        <Select value={voicing} onValueChange={setVoicing}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="close" className="text-white">Close</SelectItem>
            <SelectItem value="open" className="text-white">Open</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleGenerate}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Generate Progression
      </Button>

      {generatedProgression && (
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
          <h4 className="text-white/80 text-sm font-medium">Generated Progression</h4>
          <div className="flex flex-wrap gap-2">
            {generatedProgression.map((chord, i) => (
              <div
                key={i}
                className="bg-slate-700 px-3 py-2 rounded-lg border border-slate-600"
              >
                <div className="text-amber-400 font-semibold text-sm">{chord.name}</div>
                <div className="text-white/50 text-xs mt-0.5">
                  {chord.notes.join(', ')}
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={handleApply}
            variant="outline"
            className="w-full border-amber-500 text-amber-400 hover:bg-amber-500/10"
          >
            <Copy className="w-4 h-4 mr-2" />
            Apply to Canvas
          </Button>
        </div>
      )}
    </div>
  );
}