import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, SkipBack, Square, Repeat, Clock, Menu, Save, FolderOpen, Download, Sparkles, RefreshCw, FileText, FileAudio, Music, BookOpen, Grid3x3 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
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
  onSaveSong,
  onLoadProject,
  onBrowseSongs,
  onExport,
  onAIComposer,
  onGenerate,
  canGenerate,
  isGenerating,
  onExportMidi,
  onImportMidi,
  onTheoryTools,
  showPiano = true,
  onTogglePiano
}) {
  const timeSigConfig = TIME_SIGNATURES.find(t => t.value === timeSignature) || TIME_SIGNATURES[0];
  const beatsPerMeasure = timeSigConfig.beatsPerMeasure;
  
  const formatTime = (beat) => {
    // Convert beat (16th note) to actual time in seconds
    const sixteenthNoteDuration = (60 / tempo) / 4; // Duration of one 16th note in seconds
    const totalSeconds = beat * sixteenthNoteDuration;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 bg-[#2D2D2D] border-b border-[#3A3A3A]">
      {/* Left section - File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-white/80 hover:text-white hover:bg-[#3A3A3A] text-xs"
          >
            <Menu className="w-3.5 h-3.5 mr-1.5" />
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
          {onSaveSong && (
            <DropdownMenuItem onClick={onSaveSong} className="text-amber-400 cursor-pointer font-semibold">
              <Save className="w-4 h-4 mr-2" />
              Save as Song (Admin)
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem onClick={onBrowseSongs} className="text-amber-400 cursor-pointer">
            <Music className="w-4 h-4 mr-2" />
            Browse Songs
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
          <DropdownMenuItem onClick={onImportMidi} className="text-white cursor-pointer">
            <FileAudio className="w-4 h-4 mr-2" />
            Import MIDI
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white cursor-pointer">
              <Grid3x3 className="w-4 h-4 mr-2" />
              Panels
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-slate-800 border-slate-700">
              <DropdownMenuCheckboxItem
                checked={showPiano}
                onCheckedChange={onTogglePiano}
                className="text-white cursor-pointer"
              >
                Piano Keyboard
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem onClick={onTheoryTools} className="text-amber-400 cursor-pointer font-semibold">
            <BookOpen className="w-4 h-4 mr-2" />
            Music Theory Tools
          </DropdownMenuItem>
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

      {/* Center section - Transport controls and tempo */}
      <div className="flex items-center gap-1.5">
        {/* Transport controls */}
        <div className="flex items-center bg-[#1A1A1A] rounded border border-[#3A3A3A] p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-[#2D2D2D] rounded"
            title="Go to start"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>
          
          <Button
            onClick={onPlayPause}
            size="sm"
            className="h-7 w-7 p-0 rounded bg-[#D4AF37] hover:bg-[#E5C158] text-[#1E1E1E] mx-0.5"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="h-7 w-7 p-0 text-white/70 hover:text-white hover:bg-[#2D2D2D] rounded"
            title="Stop"
          >
            <Square className="w-3 h-3 fill-current" />
          </Button>
        </div>

        {/* Combined info display - Logic Pro style single box */}
        <div className="flex items-center bg-[#1A1A1A] rounded border border-[#3A3A3A] h-8 divide-x divide-[#3A3A3A]">
          {/* Measures */}
          <div className="px-2 flex items-center gap-1">
            <span className="text-white font-mono text-sm font-medium tabular-nums">{Math.ceil(currentBeat / timeSigConfig.beatsPerMeasure) + 1}</span>
            <span className="text-white/40 font-mono text-xs">{Math.ceil(totalBeats / timeSigConfig.beatsPerMeasure)}</span>
          </div>
          
          {/* Beat position */}
          <div className="px-2 flex items-center">
            <span className="text-white font-mono text-sm tabular-nums">{(currentBeat % timeSigConfig.beatsPerMeasure) + 1}</span>
          </div>
          
          {/* Sub-beat */}
          <div className="px-2 flex items-center">
            <span className="text-white font-mono text-sm tabular-nums">1</span>
          </div>
          
          {/* BPM */}
          <div className="px-2 flex items-center">
            {isEditingBpm ? (
              <input
                type="number"
                value={bpmInputValue}
                onChange={(e) => setBpmInputValue(e.target.value)}
                onBlur={handleBpmInputBlur}
                onKeyDown={handleBpmInputKeyDown}
                autoFocus
                className="bg-transparent border-0 text-white font-mono text-sm font-medium w-11 text-center outline-none"
                min={20}
                max={455}
              />
            ) : (
              <div
                ref={bpmRef}
                onMouseDown={handleBpmMouseDown}
                onDoubleClick={handleBpmDoubleClick}
                className={`cursor-ew-resize select-none ${isDragging ? 'text-[#D4AF37]' : ''}`}
                title="Drag to change tempo"
              >
                <span className="text-white font-mono text-sm font-medium tabular-nums">{tempo}</span>
              </div>
            )}
          </div>
          
          {/* Time */}
          <div className="px-2 flex items-center">
            <span className="text-white font-mono text-xs tabular-nums">{formatTime(currentBeat)}</span>
          </div>
          
          {/* Key - placeholder */}
          <div className="px-2 flex items-center">
            <span className="text-white text-xs">Cmin</span>
          </div>
          
          {/* Time Signature */}
          <div className="px-1.5 flex items-center">
            <Select value={timeSignature} onValueChange={onTimeSignatureChange}>
              <SelectTrigger className="h-full w-10 bg-transparent border-0 text-white text-xs font-medium px-0 hover:bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2D2D2D] border-[#3A3A3A]">
                {TIME_SIGNATURES.map(ts => (
                  <SelectItem key={ts.value} value={ts.value} className="text-white text-sm">
                    {ts.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Metronome icon */}
          <button
            onClick={onMetronomeToggle}
            className={`px-2 h-full flex items-center justify-center transition-colors ${metronomeEnabled ? 'text-[#D4AF37]' : 'text-white/50 hover:text-white/70'}`}
            title="Metronome"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4L12 2L16 4" />
              <path d="M12 4V20" />
              <path d="M8 20L12 22L16 20" />
              <path d="M6 8L12 10L18 8" />
              <path d="M6 16L12 14L18 16" />
            </svg>
          </button>
          
          {/* Loop icon */}
          <button
            onClick={onLoopToggle}
            className={`px-2 h-full flex items-center justify-center transition-colors ${isLooping ? 'text-[#D4AF37]' : 'text-white/50 hover:text-white/70'}`}
            title="Loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          
          {/* Settings icon */}
          <button
            className="px-2 h-full flex items-center justify-center text-white/50 hover:text-white/70 transition-colors"
            title="Settings"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="M1 12h6m6 0h6" />
            </svg>
          </button>
          
          {/* User icon */}
          <button
            className="px-2 h-full flex items-center justify-center text-white/50 hover:text-white/70 transition-colors"
            title="User"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right section - Timeline scrubber */}
      <div className="hidden sm:block flex-1 max-w-md">
        <Slider
          value={[currentBeat]}
          onValueChange={([value]) => {
            onSeek(value);
            onScrollToBeat?.(value);
          }}
          min={0}
          max={totalBeats - 1}
          step={1}
          className="cursor-pointer [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5 [&>span:first-child]:bg-[#4A4A4A]"
          aria-label="Playhead position"
        />
      </div>
    </div>
  );
}