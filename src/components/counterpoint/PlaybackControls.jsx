import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, SkipBack, Square, Repeat, Clock, Menu, Save, FolderOpen, Download, Sparkles, RefreshCw, FileText, FileAudio } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const TIME_SIGNATURES = [
  { value: '4/4', label: '4/4', beatsPerMeasure: 16, clicksPerMeasure: 4 },
  { value: '3/4', label: '3/4', beatsPerMeasure: 12, clicksPerMeasure: 3 },
  { value: '2/4', label: '2/4', beatsPerMeasure: 8, clicksPerMeasure: 2 },
  { value: '6/8', label: '6/8', beatsPerMeasure: 12, clicksPerMeasure: 2 },
  { value: '2/2', label: '2/2', beatsPerMeasure: 8, clicksPerMeasure: 2 },
];

export default function PlaybackControls({ 
  isPlaying, 
  onPlayPause, 
  tempo, 
  onTempoChange,
  currentBeat,
  totalBeats,
  onSeek,
  onReset,
  onStop,
  loopStart,
  loopEnd,
  onLoopChange,
  isLooping,
  onLoopToggle,
  timeSignature = '4/4',
  onTimeSignatureChange,
  metronomeEnabled,
  onMetronomeToggle,
  onScrollToBeat,
  onNewProject,
  onSaveProject,
  onLoadProject,
  onExport,
  onAIComposer,
  onGenerate,
  canGenerate,
  isGenerating,
  onExportMidi
}) {
  const timeSigConfig = TIME_SIGNATURES.find(t => t.value === timeSignature) || TIME_SIGNATURES[0];
  const beatsPerMeasure = timeSigConfig.beatsPerMeasure;
  
  const formatTime = (beat) => {
    const measure = Math.floor(beat / beatsPerMeasure) + 1;
    const sixteenth = (beat % beatsPerMeasure) + 1;
    return `${measure}:${sixteenth.toString().padStart(2, '0')}`;
  };

  // Scrubbable BPM input
  const bpmRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [bpmInputValue, setBpmInputValue] = useState(String(tempo));
  const dragStartRef = useRef({ x: 0, value: 0 });

  const handleBpmMouseDown = (e) => {
    if (isEditingBpm) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, value: tempo };
    document.body.style.cursor = 'ew-resize';
  };

  const handleBpmDoubleClick = () => {
    setBpmInputValue(String(tempo));
    setIsEditingBpm(true);
  };

  const handleBpmInputBlur = () => {
    const val = parseInt(bpmInputValue);
    if (!isNaN(val)) {
      onTempoChange(Math.max(20, Math.min(455, val)));
    }
    setIsEditingBpm(false);
  };

  const handleBpmInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBpmInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditingBpm(false);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - dragStartRef.current.x;
      const newTempo = Math.max(20, Math.min(455, dragStartRef.current.value + Math.round(delta / 3)));
      onTempoChange(newTempo);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onTempoChange]);

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-slate-900/80 border-b border-slate-700 flex-wrap">
      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-white/70 hover:text-white hover:bg-slate-700"
          >
            <Menu className="w-4 h-4 mr-1" />
            File
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-slate-800 border-slate-700">
          <DropdownMenuItem onClick={onNewProject} className="text-white cursor-pointer">
            <FileText className="w-4 h-4 mr-2" />
            New Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLoadProject} className="text-white cursor-pointer">
            <FolderOpen className="w-4 h-4 mr-2" />
            Load Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSaveProject} className="text-white cursor-pointer">
            <Save className="w-4 h-4 mr-2" />
            Save Project
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem onClick={onExport} className="text-white cursor-pointer">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportMidi} className="text-white cursor-pointer">
            <FileAudio className="w-4 h-4 mr-2" />
            Export MIDI
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem onClick={onAIComposer} className="text-white cursor-pointer">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Composer
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onGenerate} 
            disabled={!canGenerate || isGenerating}
            className="text-amber-400 cursor-pointer font-semibold"
          >
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate Counterpoint
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-5 bg-slate-700" />
      {/* Time Signature */}
      <Select value={timeSignature} onValueChange={onTimeSignatureChange}>
        <SelectTrigger className="w-14 h-7 bg-slate-800 border-slate-700 text-white text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {TIME_SIGNATURES.map(ts => (
            <SelectItem key={ts.value} value={ts.value} className="text-white text-xs">
              {ts.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* BPM */}
      <div className="flex items-center gap-1">
        {isEditingBpm ? (
          <input
            type="number"
            value={bpmInputValue}
            onChange={(e) => setBpmInputValue(e.target.value)}
            onBlur={handleBpmInputBlur}
            onKeyDown={handleBpmInputKeyDown}
            autoFocus
            className="bg-slate-800 border border-amber-500 rounded px-2 py-0.5 text-white font-mono text-xs font-medium w-12 text-center outline-none"
            min={20}
            max={455}
          />
        ) : (
          <div
            ref={bpmRef}
            onMouseDown={handleBpmMouseDown}
            onDoubleClick={handleBpmDoubleClick}
            className={`bg-slate-800 border border-slate-700 rounded px-2 py-0.5 cursor-ew-resize select-none hover:border-slate-600 transition-colors ${isDragging ? 'border-amber-500' : ''}`}
            title="Drag to change tempo"
          >
            <span className="text-white font-mono text-xs font-medium">{tempo}</span>
          </div>
        )}
        <span className="text-white/40 text-[10px] uppercase">bpm</span>
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Transport controls - centered */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-slate-700"
          title="Go to start"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>
        
        <Button
          onClick={onPlayPause}
          size="sm"
          className="h-8 w-8 p-0 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-slate-700"
          title="Stop"
        >
          <Square className="w-3 h-3 fill-current" />
        </Button>
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Time display */}
      <div className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1 font-mono text-xs">
        <span className="text-amber-400 font-medium">{formatTime(currentBeat)}</span>
        <span className="text-white/40">/</span>
        <span className="text-white/60">{formatTime(totalBeats - 1)}</span>
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Loop toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onLoopToggle}
        className={`h-7 w-7 p-0 ${isLooping ? 'text-amber-400 bg-amber-500/20' : 'text-white/50 hover:text-white'}`}
        title="Loop"
      >
        <Repeat className="w-3.5 h-3.5" />
      </Button>

      {/* Metronome */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onMetronomeToggle}
        className={`h-7 w-7 p-0 ${metronomeEnabled ? 'text-amber-400 bg-amber-500/20' : 'text-white/50 hover:text-white'}`}
        title="Metronome"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L8 22h8L12 2z" />
          <path d="M12 6v10" />
          <circle cx="12" cy="8" r="1" fill="currentColor" />
        </svg>
      </Button>

      <div className="w-px h-5 bg-slate-700 hidden sm:block" />

      {/* Timeline scrubber - hidden on mobile */}
      <div className="hidden sm:block flex-1 max-w-xs">
        <Slider
          value={[currentBeat]}
          onValueChange={([value]) => {
            onSeek(value);
            onScrollToBeat?.(value);
          }}
          min={0}
          max={totalBeats - 1}
          step={1}
          className="cursor-pointer [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
          aria-label="Playhead position"
        />
      </div>
    </div>
  );
}