import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

export default function PlaybackControls({ 
  isPlaying, 
  onPlayPause, 
  tempo, 
  onTempoChange,
  currentBeat,
  totalBeats,
  onSeek,
  onReset
}) {
  const formatTime = (beat) => {
    const measure = Math.floor(beat / 4) + 1;
    const beatInMeasure = (beat % 4) + 1;
    return `${measure}:${beatInMeasure}`;
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
            onClick={() => onSeek(Math.min(currentBeat + 4, totalBeats - 1))}
            className="text-cream/70 hover:text-cream hover:bg-slate-800"
          >
            <SkipForward className="w-5 h-5" />
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