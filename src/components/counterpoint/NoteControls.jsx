import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from 'lucide-react';
import { initAudio, playNote, playNoteWithCustomInstrument } from './audioEngine';

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
                <span role="button" onClick={(e) => { e.stopPropagation();
                  if (firstSelected) {
                    initAudio(); const instrument = voices[0]?.instrument || 'organ'; const customConfig = getInstrumentConfig(instrument);
                    const sixteenthNoteDuration = (60 / tempo) / 4; const actualDuration = (firstSelected.duration || 1) * sixteenthNoteDuration;
                    if (customConfig) { playNoteWithCustomInstrument(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, customConfig, s.value, tempo, 0); }
                    else { import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => { playNoteWithArticulation(firstSelected.pitch, actualDuration, firstSelected.velocity ?? 0.7, 0, instrument, s.value, tempo, 0); }); }
                  }}}
                  className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity cursor-pointer">▶</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}