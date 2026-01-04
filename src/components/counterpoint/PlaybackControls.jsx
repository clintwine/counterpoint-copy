import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, SkipBack, Square, Repeat, Clock, Menu, Save, FolderOpen, Download, Sparkles, RefreshCw, FileText, FileAudio, Music, BookOpen, Layers, Circle, LogIn, LogOut } from 'lucide-react';
import VolumeSlider from './VolumeSlider';
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
import { FilePlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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
  onSaveProjectAs,
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
  onMasterVolumeChange,
  currentUser
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

  const getInitials = (email) => {
    if (!email) return '?';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Transport controls and tempo */}
      <div className="flex items-center gap-2 justify-center">
        {/* User avatar - positioned at far left */}
        {currentUser && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[#D4AF37] text-[#1E1E1E] font-semibold text-sm border-2 border-[#3A3A3A] hover:bg-[#E5BF47] transition-colors cursor-pointer" 
                  title={currentUser.email}
                >
                  {getInitials(currentUser.email)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#1E1E1E] border-[#3A3A3A]">
                <DropdownMenuItem disabled className="text-white/50 text-xs cursor-default">
                  {currentUser.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#3A3A3A]" />
                <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="w-px h-6 bg-[#3A3A3A]" />
          </>
        )}
        
        {/* Transport controls */}
        <div className="flex items-center bg-[#595959] rounded-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);
              const prevMeasure = Math.max(0, currentMeasure - 1);
              onSeek(prevMeasure * beatsPerMeasure);
            }}
            className="h-[38px] w-[38px] p-0 text-white/90 hover:text-white hover:bg-white/10 rounded"
            title="Previous measure"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 2l-8 10 8 10V2z" />
              <path d="M18 2l-8 10 8 10V2z" />
            </svg>
          </Button>

          <Button
            onClick={onPlayPause}
            variant="ghost"
            size="sm"
            className="h-[38px] w-[38px] p-0 text-white/90 hover:text-white hover:bg-white/10 rounded"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 ml-0.5 fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const currentMeasure = Math.floor(currentBeat / beatsPerMeasure);
              const nextMeasure = currentMeasure + 1;
              const nextBeat = Math.min(totalBeats - 1, nextMeasure * beatsPerMeasure);
              onSeek(nextBeat);
            }}
            className="h-[38px] w-[38px] p-0 text-white/90 hover:text-white hover:bg-white/10 rounded"
            title="Next measure"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 2l8 10-8 10V2z" />
              <path d="M14 2l8 10-8 10V2z" />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="h-[38px] w-[38px] p-0 text-white/90 hover:text-white hover:bg-white/10 rounded"
            title="Stop"
          >
            <Square className="w-4.5 h-4.5 fill-current" />
          </Button>

          <Button
            onClick={onRecordToggle}
            variant="ghost"
            size="sm"
            disabled={isPlaying && !isRecording}
            className={`h-[38px] w-[38px] p-0 rounded ${
              isRecording 
                ? 'text-red-500 hover:text-red-400 hover:bg-white/10' 
                : isCountingIn
                ? 'text-amber-500 hover:bg-white/10 animate-pulse'
                : 'text-red-500 hover:text-red-400 hover:bg-white/10'
            }`}
            title={isRecording ? 'Stop recording' : 'Record'}
          >
            {isCountingIn ? (
              <span className="text-sm font-bold">{countInBeats}</span>
            ) : (
              <Circle className="w-4.5 h-4.5 fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLoopToggle}
            className={`h-[38px] w-[38px] p-0 rounded ${isLooping ? 'text-[#D4AF37] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
            title="Loop"
          >
            <Repeat className="w-5 h-5" />
          </Button>
          </div>

        <div className="w-px h-6 bg-[#3A3A3A]" />

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
            <div className="w-16 flex flex-col items-start">
              <div className="w-16 flex items-center justify-center h-[28px]">
                <Select value={timeSignature} onValueChange={onTimeSignatureChange}>
                  <SelectTrigger className="h-auto w-full bg-transparent border-none text-white text-sm font-medium px-2 py-0.5 hover:bg-[#2D2D2D]">
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
              <span className="text-white/40 text-[9px] uppercase tracking-wider pl-2">SIG</span>
            </div>
          </div>
        </div>

        {/* Time display - Logic Pro style */}
        <div className="flex items-center bg-[#1A1A1A] rounded-md border border-[#3A3A3A] px-3 py-1">
          <div className="flex flex-col items-start">
            <div className="flex items-center h-[28px]">
              <span className="text-white font-mono text-sm tabular-nums">{formatTime(currentBeat)}</span>
              <span className="text-white/40 mx-1.5">/</span>
              <span className="text-white/60 font-mono text-sm tabular-nums">{formatTime(totalBeats - 1)}</span>
            </div>
            <span className="text-white/40 text-[9px] uppercase tracking-wider">TIME</span>
          </div>
        </div>

        <div className="w-px h-6 bg-[#3A3A3A]" />

        {/* Metronome */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onMetronomeToggle}
          className={`h-9 w-9 p-0 rounded border ${metronomeEnabled ? 'text-[#D4AF37] bg-[#D4AF37]/20 border-[#D4AF37]/30' : 'text-white/60 hover:text-white hover:bg-[#3A3A3A] border-[#3A3A3A]'}`}
          title="Metronome"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L8 22h8L12 2z" />
            <path d="M12 6v10" />
            <circle cx="12" cy="8" r="1" fill="currentColor" />
          </svg>
        </Button>

        <div className="w-px h-6 bg-[#3A3A3A]" />

        {/* Master Volume */}
        <div className="bg-[#1A1A1A] rounded-md border border-[#3A3A3A] px-3 h-[38px] flex items-center">
          <VolumeSlider
            value={masterVolume}
            onChange={onMasterVolumeChange}
          />
        </div>
      </div>
    </>
  );
}