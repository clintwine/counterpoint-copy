import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Square, Repeat } from 'lucide-react';

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
  onLoopToggle
}) {
  const formatTime = (beat) => {
    const measure = Math.floor(beat / 16) + 1;
    const sixteenth = (beat % 16) + 1;
    return `${measure}:${sixteenth.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/60 rounded-2xl p-5 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between gap-6">
        {/* Transport controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            className="text-cream/70 hover:text-cream hover:bg-slate-800"
            title="Go to start"
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
            className="text-cream/70 hover:text-cream hover:bg-slate-800"
            title="Stop and go to start"
          >
            <Square className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onLoopToggle}
            className={`${isLooping ? 'text-amber-400 bg-amber-400/20' : 'text-cream/70'} hover:text-cream hover:bg-slate-800`}
            title="Toggle loop"
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
              onValueChange={([value]) => onSeek(value)}
              max={totalBeats - 1}
              step={1}
              className="flex-1 [&_[role=slider]]:bg-gold [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
            />
            <span className="text-white text-sm font-mono w-10">
              {formatTime(totalBeats - 1)}
            </span>
          </div>
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <span className="text-white/90 text-xs uppercase tracking-wider font-medium">BPM</span>
          <Slider
            value={[tempo]}
            onValueChange={([value]) => onTempoChange(value)}
            min={40}
            max={200}
            step={1}
            className="flex-1 [&_[role=slider]]:bg-gold [&_[role=slider]]:border-0"
          />
          <span className="text-white font-mono text-sm w-8">{tempo}</span>
        </div>
      </div>
    </div>
  );
}