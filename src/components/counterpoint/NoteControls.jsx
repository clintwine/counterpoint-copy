import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';
import { initAudio, playNote, playNoteWithCustomInstrument } from './audioEngine';

// Semitone offsets for arpeggio patterns (relative to root)
const ARPEGGIO_PATTERNS = {
  none:        { label: 'None',           desc: 'No arpeggio',              intervals: [] },
  up_maj:      { label: '▲ Major Up',     desc: 'Root→3rd→5th',            intervals: [0, 4, 7] },
  up_min:      { label: '▲ Minor Up',     desc: 'Root→3rd♭→5th',          intervals: [0, 3, 7] },
  up_dom7:     { label: '▲ Dom7 Up',      desc: 'Root→3rd→5th→7th♭',      intervals: [0, 4, 7, 10] },
  up_maj7:     { label: '▲ Maj7 Up',      desc: 'Root→3rd→5th→7th',       intervals: [0, 4, 7, 11] },
  up_oct:      { label: '▲ Octave Up',    desc: 'Root→5th→Oct',            intervals: [0, 7, 12] },
  down_maj:    { label: '▼ Major Down',   desc: '5th→3rd→Root',            intervals: [7, 4, 0] },
  down_min:    { label: '▼ Minor Down',   desc: '5th→3rd♭→Root',          intervals: [7, 3, 0] },
  updown_maj:  { label: '↑↓ Maj Bounce',  desc: 'Root→5th→3rd→Root',      intervals: [0, 7, 4, 0] },
  updown_oct:  { label: '↑↓ Oct Bounce',  desc: 'Root→Oct→5th→Root',      intervals: [0, 12, 7, 0] },
  strum_maj:   { label: '≈ Maj Strum',    desc: 'Root+3rd+5th quick',      intervals: [0, 4, 7],  strum: true },
  strum_min:   { label: '≈ Min Strum',    desc: 'Root+3rd♭+5th quick',    intervals: [0, 3, 7],  strum: true },
};

// Get a pitch shifted by semitones
function shiftPitch(pitch, semitones) {
  const ALL_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return pitch;
  const [, note, oct] = match;
  const idx = ALL_NOTES.indexOf(note);
  const total = idx + parseInt(oct) * 12 + semitones;
  const newNote = ALL_NOTES[((total % 12) + 12) % 12];
  const newOct = Math.floor(total / 12);
  if (newOct < 0 || newOct > 8) return null;
  return `${newNote}${newOct}`;
}

function playArpeggioPreview(note, pattern, instrument, customConfig, tempo) {
  if (!pattern || !pattern.intervals || pattern.intervals.length === 0) return;
  initAudio();
  const sixteenthDur = (60 / tempo) / 4;
  const noteDur = (note.duration || 1) * sixteenthDur;
  const stepDur = pattern.strum ? 0.04 : Math.min(noteDur / pattern.intervals.length, 0.35);

  pattern.intervals.forEach((semis, i) => {
    const shiftedPitch = shiftPitch(note.pitch, semis);
    if (!shiftedPitch) return;
    const delay = pattern.strum ? i * 0.04 : i * stepDur;
    setTimeout(() => {
      const dur = pattern.strum ? noteDur : stepDur * 0.85;
      if (customConfig) {
        playNoteWithCustomInstrument(shiftedPitch, dur, note.velocity ?? 0.7, customConfig, 'normal', tempo, 0);
      } else {
        playNote(shiftedPitch, dur, note.velocity ?? 0.7, 0, instrument, 0);
      }
    }, delay * 1000);
  });
}

export default function NoteControls({ selectedNotes, cantusFirmus, getNoteKey, onNotesUpdate, saveToHistory, voices, tempo, getInstrumentConfig, onVelocityChange }) {
  if (selectedNotes.size === 0) return null;

  const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
  const velocity = (firstSelected?.velocity ?? 0.8) * 125;

  const playPreview = (note, overrides = {}) => {
    if (!note) return;
    initAudio();
    const instrument = voices[0]?.instrument || 'organ';
    const customConfig = getInstrumentConfig(instrument);
    const sixteenthNoteDuration = (60 / tempo) / 4;
    const actualDuration = (note.duration || 1) * sixteenthNoteDuration;
    const hasBend = note.bendStart !== undefined || note.bendEnd !== undefined;
    const pitchBend = hasBend ? { start: note.bendStart ?? 0, end: note.bendEnd ?? 0, startTime: note.bendStartTime ?? 0, endTime: note.bendEndTime ?? 1 } : 0;
    const merged = { ...note, ...overrides };
    const pb = overrides.bendStart !== undefined ? { start: overrides.bendStart, end: overrides.bendEnd ?? 0, startTime: note.bendStartTime ?? 0, endTime: note.bendEndTime ?? 1 } : pitchBend;
    if (customConfig) {
      playNoteWithCustomInstrument(note.pitch, actualDuration, note.velocity ?? 0.7, customConfig, merged.articulation || 'normal', tempo, pb);
    } else {
      playNote(note.pitch, actualDuration, note.velocity ?? 0.7, 0, instrument, pb);
    }
  };

  const bendOptions = [
    { label: 'None', start: 0, end: 0 },
    { label: '↗ Up +½', start: 0, end: 0.5 }, { label: '↗ Up +1', start: 0, end: 1 },
    { label: '↗ Up +2', start: 0, end: 2 }, { label: '↗ Up +3', start: 0, end: 3 },
    { label: '↘ Down -½', start: 0, end: -0.5 }, { label: '↘ Down -1', start: 0, end: -1 },
    { label: '↘ Down -2', start: 0, end: -2 }, { label: '↘ Down -3', start: 0, end: -3 },
    { label: '↗↘ Ret +1', start: -1, end: 0 }, { label: '↗↘ Ret +2', start: -2, end: 0 },
    { label: '↘↗ Ret -1', start: 1, end: 0 }, { label: '↘↗ Ret -2', start: 2, end: 0 },
  ];

  const getBendLabel = () => {
    const s = firstSelected?.bendStart ?? 0, e = firstSelected?.bendEnd ?? 0;
    const found = bendOptions.find(b => b.start === s && b.end === e);
    return found ? found.label : 'None';
  };

  const styleOptions = [
    { value: 'normal', label: 'Normal', desc: 'Standard' },
    { value: 'staccato', label: 'Staccato', desc: 'Short & detached' },
    { value: 'legato', label: 'Legato', desc: 'Smooth & connected' },
    { value: 'accent', label: 'Accent', desc: 'Emphasized' },
    { value: 'trill', label: 'Trill', desc: 'Rapid alternation' },
    { value: 'grace', label: 'Grace Note', desc: 'Quick ornament' },
    { value: 'tremolo-slow', label: 'Tremolo Slow', desc: '16th picks' },
    { value: 'tremolo-medium', label: 'Tremolo Medium', desc: '32nd picks' },
    { value: 'tremolo-fast', label: 'Tremolo Fast', desc: '64th picks' },
    { value: 'tremolo-ultra', label: 'Tremolo Ultra', desc: '128th picks' },
  ];

  const currentArticulation = firstSelected?.articulation || 'normal';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-amber-400 text-xs flex-shrink-0">{selectedNotes.size} selected</span>

      {/* Velocity */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Vel</span>
        <Slider
          value={[velocity]}
          onValueChange={([value]) => {
            const v = value / 125;
            onNotesUpdate(cantusFirmus.map(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)) ? { ...n, velocity: v } : n));
          }}
          onValueCommit={([value]) => {
            const v = value / 125;
            saveToHistory(cantusFirmus);
            onVelocityChange?.(v);
            if (firstSelected) { initAudio(); playNote(firstSelected.pitch, 0.3, v, 0, voices[0]?.instrument || 'organ'); }
          }}
          min={25} max={125} step={5}
          className="w-16 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
        />
        <span className="text-white/70 text-[10px] w-6">{Math.round(velocity)}</span>
      </div>

      <div className="w-px h-3 bg-slate-600" />

      {/* Bend */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Bend</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-24 justify-between bg-slate-700 border-slate-600 text-white text-[10px] px-2">
              {getBendLabel()} <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700 w-44">
            {bendOptions.map(b => (
              <DropdownMenuItem key={b.label} className="text-white text-xs cursor-pointer flex items-center justify-between group"
                onSelect={() => {
                  const newNotes = cantusFirmus.map(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)) ? { ...n, bendStart: b.start, bendEnd: b.end } : n);
                  saveToHistory(newNotes); onNotesUpdate(newNotes);
                  playPreview(firstSelected, { bendStart: b.start, bendEnd: b.end });
                }}>
                <span>{b.label}</span>
                <span role="button" onClick={(e) => { e.stopPropagation(); playPreview(firstSelected, { bendStart: b.start, bendEnd: b.end }); }}
                  className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity cursor-pointer">▶</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Arpeggio */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Arp</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-28 justify-between bg-slate-700 border-slate-600 text-white text-[10px] px-2">
              {ARPEGGIO_PATTERNS[firstSelected?.arpeggio || 'none']?.label || 'None'} <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700 w-52">
            {Object.entries(ARPEGGIO_PATTERNS).map(([key, pattern]) => (
              <DropdownMenuItem key={key} className="text-white text-xs cursor-pointer flex items-center justify-between group"
                onSelect={() => {
                  const newNotes = cantusFirmus.map(n => selectedNotes.has(getNoteKey(n.pitch, n.beat))
                    ? { ...n, arpeggio: key === 'none' ? undefined : key }
                    : n);
                  saveToHistory(newNotes); onNotesUpdate(newNotes);
                  if (key !== 'none' && firstSelected) {
                    const instrument = voices[0]?.instrument || 'organ';
                    const customConfig = getInstrumentConfig(instrument);
                    playArpeggioPreview(firstSelected, pattern, instrument, customConfig, tempo);
                  }
                }}>
                <div>
                  <div className="font-medium">{pattern.label}</div>
                  <div className="text-[10px] text-white/50">{pattern.desc}</div>
                </div>
                {key !== 'none' && (
                  <span role="button" onClick={(e) => {
                    e.stopPropagation();
                    if (firstSelected) {
                      const instrument = voices[0]?.instrument || 'organ';
                      const customConfig = getInstrumentConfig(instrument);
                      playArpeggioPreview(firstSelected, pattern, instrument, customConfig, tempo);
                    }
                  }} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity cursor-pointer">▶</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="w-px h-3 bg-slate-600" />

      {/* Style */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Style</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-24 justify-between bg-slate-700 border-slate-600 text-white text-[10px] px-2">
              {currentArticulation.charAt(0).toUpperCase() + currentArticulation.slice(1)} <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700 w-48">
            {styleOptions.map(s => (
              <DropdownMenuItem key={s.value} className="text-white text-xs cursor-pointer flex items-center justify-between group"
                onSelect={() => {
                  const newNotes = cantusFirmus.map(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)) ? { ...n, articulation: s.value } : n);
                  saveToHistory(newNotes); onNotesUpdate(newNotes);
                  if (firstSelected) {
                    initAudio();
                    const instrument = voices[0]?.instrument || 'organ';
                    const customConfig = getInstrumentConfig(instrument);
                    const sixteenthNoteDuration = (60 / tempo) / 4;
                    const actualDuration = (firstSelected.duration || 1) * sixteenthNoteDuration;
                    if (customConfig) { playNoteWithCustomInstrument(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, customConfig, s.value, tempo, 0); }
                    else { import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => { playNoteWithArticulation(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, 0, instrument, s.value, tempo, 0); }); }
                  }
                }}>
                <div><div className="font-medium">{s.label}</div><div className="text-[10px] text-white/50">{s.desc}</div></div>
                <span role="button" onClick={(e) => {
                  e.stopPropagation();
                  if (firstSelected) {
                    initAudio();
                    const instrument = voices[0]?.instrument || 'organ';
                    const customConfig = getInstrumentConfig(instrument);
                    const sixteenthNoteDuration = (60 / tempo) / 4;
                    const actualDuration = (firstSelected.duration || 1) * sixteenthNoteDuration;
                    if (customConfig) { playNoteWithCustomInstrument(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, customConfig, s.value, tempo, 0); }
                    else { import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => { playNoteWithArticulation(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, 0, instrument, s.value, tempo, 0); }); }
                  }
                }} className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity cursor-pointer">▶</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}