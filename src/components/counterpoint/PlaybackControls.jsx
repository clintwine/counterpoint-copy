import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, SkipBack, Square, Repeat, Clock, Menu, Save, FolderOpen, Download, Sparkles, RefreshCw, FileText, FileAudio, Music, BookOpen, Layers, Circle, Volume2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  onTogglePanels,
  showPianoPanel,
  isRecording,
  onRecordToggle,
  isCountingIn,
  countInBeats,
  masterVolume = 80,
  onMasterVolumeChange
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
    <>
      {/* Transport controls and tempo */}
      <div className="flex items-center gap-2 justify-center">
        {/* Transport controls */}
        <div className="flex items-center bg-[#1A1A1A] rounded-md border border-[#3A3A3A] p-0.5">
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

          <div className="w-px h-5 bg-[#3A3A3A] mx-0.5" />

          <Button
            onClick={onRecordToggle}
            size="sm"
            disabled={isPlaying && !isRecording}
            className={`h-7 w-7 p-0 rounded ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : isCountingIn
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-red-600/20 hover:bg-red-600/30 text-red-600 hover:text-red-600'
            }`}
            title={isRecording ? 'Stop recording' : 'Record'}
          >
            {isCountingIn ? (
              <span className="text-xs font-bold">{countInBeats}</span>
            ) : (
              <Circle className="w-3 h-3 fill-current" />
            )}
          </Button>
        </div>

        {/* BPM and Time Signature container */}
        <div className="flex items-center bg-[#1A1A1A] rounded-md border border-[#3A3A3A] p-0.5 gap-1">
          {/* BPM - Large Logic Pro style */}
          <div className="flex items-center">
            <div className="w-16 flex flex-col items-center">
              {isEditingBpm ? (
                <input
                  type="number"
                  value={bpmInputValue}
                  onChange={(e) => setBpmInputValue(e.target.value)}
                  onBlur={handleBpmInputBlur}
                  onKeyDown={handleBpmInputKeyDown}
                  autoFocus
                  className="bg-[#0A0A0A] border border-[#D4AF37] rounded px-2 py-0.5 text-white font-mono text-xl font-bold w-16 text-center outline-none"
                  min={20}
                  max={455}
                />
              ) : (
                <div
                  ref={bpmRef}
                  onMouseDown={handleBpmMouseDown}
                  onDoubleClick={handleBpmDoubleClick}
                  className="bg-transparent border-none rounded px-2 py-0.5 cursor-ew-resize select-none hover:bg-[#2D2D2D] transition-colors w-16 flex items-center justify-center"
                  title="Drag to change tempo"
                >
                  <span className="text-white font-mono text-xl font-bold tabular-nums">{tempo}</span>
                </div>
              )}
              <span className="text-white/40 text-[9px] uppercase tracking-wider">BPM</span>
            </div>
          </div>

          <div className="w-px h-6 bg-[#3A3A3A]" />

          {/* Time Signature */}
          <div className="flex items-center">
            <div className="w-12 flex flex-col items-center">
              <div className="w-12 flex items-center justify-center">
                <Select value={timeSignature} onValueChange={onTimeSignatureChange}>
                  <SelectTrigger className="h-auto w-12 bg-transparent border-none text-white text-sm font-medium px-2 py-0.5 hover:bg-[#2D2D2D]">
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
              <span className="text-white/40 text-[9px] uppercase tracking-wider">SIG</span>
            </div>
          </div>
        </div>

        {/* Time display - Logic Pro style */}
        <div className="flex items-center bg-[#1A1A1A] rounded-md border border-[#3A3A3A] px-3 py-1">
          <span className="text-white font-mono text-sm tabular-nums">{formatTime(currentBeat)}</span>
          <span className="text-white/40 mx-1.5">/</span>
          <span className="text-white/60 font-mono text-sm tabular-nums">{formatTime(totalBeats - 1)}</span>
        </div>

        <div className="w-px h-6 bg-[#3A3A3A]" />

        {/* Metronome */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMetronomeToggle}
          className={`h-8 w-8 p-0 rounded ${metronomeEnabled ? 'text-[#D4AF37] bg-[#D4AF37]/20' : 'text-white/60 hover:text-white hover:bg-[#3A3A3A]'}`}
          title="Metronome"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L8 22h8L12 2z" />
            <path d="M12 6v10" />
            <circle cx="12" cy="8" r="1" fill="currentColor" />
          </svg>
        </Button>

        {/* Loop toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLoopToggle}
          className={`h-8 w-8 p-0 rounded ${isLooping ? 'text-[#D4AF37] bg-[#D4AF37]/20' : 'text-white/60 hover:text-white hover:bg-[#3A3A3A]'}`}
          title="Loop"
        >
          <Repeat className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#3A3A3A]" />

        {/* Master Volume */}
        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md border border-[#3A3A3A] px-3 py-1">
          <Volume2 className="w-4 h-4 text-white/60" />
          <Slider
            value={[Math.round(masterVolume)]}
            onValueChange={([value]) => onMasterVolumeChange?.(Math.round(value))}
            max={100}
            step={1}
            className="w-20 [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
          />
          <span className="text-white/70 text-xs font-mono w-6 text-right">{Math.round(masterVolume)}</span>
        </div>
      </div>
    </>
  );
}