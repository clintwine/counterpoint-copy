import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, SkipBack, Square, Repeat, Clock } from 'lucide-react';

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
  onScrollToBeat
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
    <div className="bg-slate-900/60 rounded-2xl p-5 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between gap-6">
        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            className="text-white hover:text-white hover:bg-slate-700 border border-slate-600"
            title="Go to start"
            aria-label="Go to start of track"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          
          <Button
            onClick={onPlayPause}
            className="w-14 h-14 rounded-full bg-gold hover:bg-gold/90 text-slate-900"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onStop}
            className="text-white hover:text-white hover:bg-slate-700 border border-slate-600"
            title="Stop and go to start"
            aria-label="Stop playback and return to start"
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onLoopToggle}
            className={`${isLooping ? 'text-amber-400 bg-amber-500/30 border-amber-500' : 'text-white border-slate-600'} hover:text-white hover:bg-slate-700 border`}
            title="Toggle loop"
            aria-label={isLooping ? "Disable loop" : "Enable loop"}
          >
            <Repeat className="w-4 h-4" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-mono w-10">
              {formatTime(currentBeat)}
            </span>
            <Slider
                                value={[currentBeat]}
                                onValueChange={([value]) => {
                                  onSeek(value);
                                  onScrollToBeat?.(value);
                                }}
                                min={0}
                                max={totalBeats - 1}
                                step={1}
                                className="flex-1 cursor-pointer [&_[role=slider]]:bg-gold [&_[role=slider]]:border-0 [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:cursor-grab [&_[role=slider]:active]:cursor-grabbing"
                                aria-label="Playhead position"
                              />
            <span className="text-white text-sm font-mono w-10">
              {formatTime(totalBeats - 1)}
            </span>
          </div>
        </div>

        {/* Time Signature & Tempo */}
        <div className="flex items-center gap-4">
          {/* Time Signature */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/60" />
            <Select value={timeSignature} onValueChange={onTimeSignatureChange}>
              <SelectTrigger className="w-16 h-8 bg-slate-800 border-slate-600 text-white text-xs">
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
          </div>

          {/* Scrubbable BPM */}
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-xs uppercase tracking-wider">BPM</span>
                            {isEditingBpm ? (
                              <input
                                type="number"
                                value={bpmInputValue}
                                onChange={(e) => setBpmInputValue(e.target.value)}
                                onBlur={handleBpmInputBlur}
                                onKeyDown={handleBpmInputKeyDown}
                                autoFocus
                                className="bg-slate-800 border border-amber-500 rounded-lg px-3 py-1.5 text-white font-mono text-sm font-medium w-16 text-center outline-none"
                                min={20}
                                max={455}
                              />
                            ) : (
                              <div
                                ref={bpmRef}
                                onMouseDown={handleBpmMouseDown}
                                onDoubleClick={handleBpmDoubleClick}
                                className={`bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 cursor-ew-resize select-none hover:border-amber-500/50 transition-colors ${isDragging ? 'border-amber-500 bg-slate-700' : ''}`}
                                title="Drag left/right to change tempo, double-click to type"
                              >
                                <span className="text-white font-mono text-sm font-medium">{tempo}</span>
                              </div>
                            )}
                          </div>

          {/* Metronome */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMetronomeToggle}
            className={`h-8 px-2 ${metronomeEnabled ? 'text-amber-400 bg-amber-500/20' : 'text-white/60'} hover:text-white`}
            title="Toggle metronome"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L8 22h8L12 2z" />
              <path d="M12 6v10" />
              <circle cx="12" cy="8" r="1" fill="currentColor" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}