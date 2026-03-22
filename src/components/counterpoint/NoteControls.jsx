import React from 'react';
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from 'lucide-react';
import { initAudio, playNote, playNoteWithCustomInstrument } from './audioEngine';

export default function NoteControls({ 
  selectedNotes, 
  cantusFirmus, 
  getNoteKey, 
  onNotesUpdate, 
  saveToHistory, 
  voices, 
  getInstrumentConfig, 
  tempo 
}) {
  if (selectedNotes.size === 0) return null;

  const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
  const velocity = (firstSelected?.velocity ?? 0.8) * 125;
  const articulation = firstSelected?.articulation || 'normal';
  const bendStart = firstSelected?.bendStart ?? 0;
  const bendEnd = firstSelected?.bendEnd ?? 0;

  const getBendLabel = () => {
    if (bendStart === 0 && bendEnd === 0) return 'None';
    if (bendStart === 0 && bendEnd === 1) return '↗ +1';
    if (bendStart === 0 && bendEnd === 2) return '↗ +2';
    if (bendStart === 0 && bendEnd === -1) return '↘ -1';
    if (bendStart === 0 && bendEnd === -2) return '↘ -2';
    if (bendStart === -1 && bendEnd === 0) return '↗↘ +1';
    if (bendStart === -2 && bendEnd === 0) return '↗↘ +2';
    if (bendStart === 1 && bendEnd === 0) return '↘↗ -1';
    if (bendStart === 2 && bendEnd === 0) return '↘↗ -2';
    if (bendStart === 0 && bendEnd === 0.5) return '↗ +½';
    if (bendStart === 0 && bendEnd === -0.5) return '↘ -½';
    if (bendStart === 0 && bendEnd === 3) return '↗ +3';
    if (bendStart === 0 && bendEnd === -3) return '↘ -3';
    return 'None';
  };

  const playPreview = (note, articulationOverride, bendOverride) => {
    if (!note) return;
    initAudio();
    const instrument = voices[0]?.instrument || 'organ';
    const customConfig = getInstrumentConfig(instrument);
    const hasBend = bendOverride || (note.bendStart !== undefined || note.bendEnd !== undefined);
    const pitchBend = hasBend ? {
      start: bendOverride?.start ?? note.bendStart ?? 0,
      end: bendOverride?.end ?? note.bendEnd ?? 0,
      startTime: note.bendStartTime ?? 0,
      endTime: note.bendEndTime ?? 1
    } : 0;
    const sixteenthNoteDuration = (60 / tempo) / 4;
    const actualDuration = (note.duration || 1) * sixteenthNoteDuration;
    if (customConfig) {
      playNoteWithCustomInstrument(note.pitch, actualDuration, note.velocity ?? 0.7, customConfig, articulationOverride || note.articulation || 'normal', tempo, pitchBend);
    } else {
      playNote(note.pitch, actualDuration, note.velocity ?? 0.7, 0, instrument, pitchBend);
    }
  };

  const BEND_TYPES = [
    { label: 'None', start: 0, end: 0 },
    { label: '↗ Up +½ semitone', start: 0, end: 0.5 },
    { label: '↗ Up +1 semitone', start: 0, end: 1 },
    { label: '↗ Up +2 semitones', start: 0, end: 2 },
    { label: '↗ Up +3 semitones', start: 0, end: 3 },
    { label: '↘ Down -½ semitone', start: 0, end: -0.5 },
    { label: '↘ Down -1 semitone', start: 0, end: -1 },
    { label: '↘ Down -2 semitones', start: 0, end: -2 },
    { label: '↘ Down -3 semitones', start: 0, end: -3 },
    { label: '↗↘ Return from +1', start: -1, end: 0 },
    { label: '↗↘ Return from +2', start: -2, end: 0 },
    { label: '↘↗ Return from -1', start: 1, end: 0 },
    { label: '↘↗ Return from -2', start: 2, end: 0 },
  ];

  const ARTICULATION_TYPES = [
    { value: 'normal', label: 'Normal', desc: 'Standard articulation' },
    { value: 'staccato', label: 'Staccato', desc: 'Short & detached' },
    { value: 'legato', label: 'Legato', desc: 'Smooth & connected' },
    { value: 'accent', label: 'Accent', desc: 'Emphasized' },
    { value: 'trill', label: 'Trill', desc: 'Rapid alternation' },
    { value: 'grace', label: 'Grace Note', desc: 'Quick ornament' },
    { value: 'tremolo-slow', label: 'Tremolo Slow', desc: '16th note picks' },
    { value: 'tremolo-medium', label: 'Tremolo Medium', desc: '32nd note picks' },
    { value: 'tremolo-fast', label: 'Tremolo Fast', desc: '64th note picks' },
    { value: 'tremolo-ultra', label: 'Tremolo Ultra', desc: '128th note picks' },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-amber-400 text-xs flex-shrink-0">{selectedNotes.size} selected</span>

      {/* Velocity */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Vel</span>
        <Slider
          value={[velocity]}
          onValueChange={([value]) => {
            const newNotes = cantusFirmus.map(n =>
              selectedNotes.has(getNoteKey(n.pitch, n.beat)) ? { ...n, velocity: value / 125 } : n
            );
            onNotesUpdate(newNotes);
          }}
          onValueCommit={() => saveToHistory(cantusFirmus)}
          min={25}
          max={125}
          step={5}
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
              {getBendLabel()}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700 w-48">
            {BEND_TYPES.map((bendType) => (
              <DropdownMenuItem
                key={bendType.label}
                className="text-white text-xs cursor-pointer flex items-center justify-between group"
                onSelect={() => {
                  const newNotes = cantusFirmus.map(n =>
                    selectedNotes.has(getNoteKey(n.pitch, n.beat))
                      ? { ...n, bendStart: bendType.start, bendEnd: bendType.end }
                      : n
                  );
                  saveToHistory(newNotes);
                  onNotesUpdate(newNotes);
                  playPreview(firstSelected, null, bendType);
                }}
              >
                <span>{bendType.label}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); playPreview(firstSelected, null, bendType); }}
                  className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity"
                  title="Preview"
                >▶</button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Articulation */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-white/50 text-[10px]">Style</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-24 justify-between bg-slate-700 border-slate-600 text-white text-[10px] px-2">
              {articulation.charAt(0).toUpperCase() + articulation.slice(1)}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700 w-48">
            {ARTICULATION_TYPES.map((style) => (
              <DropdownMenuItem
                key={style.value}
                className="text-white text-xs cursor-pointer flex items-center justify-between group"
                onSelect={() => {
                  const newNotes = cantusFirmus.map(n =>
                    selectedNotes.has(getNoteKey(n.pitch, n.beat))
                      ? { ...n, articulation: style.value }
                      : n
                  );
                  saveToHistory(newNotes);
                  onNotesUpdate(newNotes);
                  playPreview(firstSelected, style.value, null);
                }}
              >
                <div>
                  <div className="font-medium">{style.label}</div>
                  <div className="text-[10px] text-white/50">{style.desc}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); playPreview(firstSelected, style.value, null); }}
                  className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity"
                  title="Preview"
                >▶</button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}