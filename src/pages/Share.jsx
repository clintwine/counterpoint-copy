import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Pause, Music2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Share() {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) { setError('No share ID provided.'); setLoading(false); return; }

    base44.entities.SharedAudio.filter({ id })
      .then(results => {
        if (!results?.length) { setError('Shared audio not found.'); return; }
        setRecord(results[0]);
      })
      .catch(() => setError('Failed to load shared audio.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [record]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center">
        <div className="text-center">
          <Music2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1E1E] via-[#232323] to-[#1A1A1A] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-[#2D2D2D] border border-[#3A3A3A] rounded-2xl p-8 shadow-2xl">
          {/* Logo / branding */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            <Music2 className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-semibold text-sm tracking-wide uppercase">Counterpoint Studio</span>
          </div>

          {/* Title */}
          <h1 className="text-white text-2xl font-bold text-center mb-1">{record.title}</h1>
          <p className="text-white/40 text-sm text-center mb-8">
            {record.instrument} · {record.tempo} BPM
          </p>

          {/* Hidden audio element */}
          {record.audio_url && (
            <audio ref={audioRef} src={record.audio_url} preload="metadata" />
          )}

          {/* Waveform visual (decorative bars) */}
          <div className="flex items-center justify-center gap-0.5 mb-6 h-12">
            {Array.from({ length: 48 }).map((_, i) => {
              const height = 20 + Math.sin(i * 0.7) * 15 + Math.sin(i * 1.3) * 10;
              const played = duration > 0 && (i / 48) < (progress / duration);
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-colors ${played ? 'bg-amber-400' : 'bg-white/15'}`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={progress}
              onChange={(e) => {
                const t = parseFloat(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = t;
                setProgress(t);
              }}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#F59E0B' }}
            />
            <div className="flex justify-between text-white/30 text-xs mt-1">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Play button */}
          <div className="flex justify-center">
            <Button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/30"
            >
              {isPlaying
                ? <Pause className="w-7 h-7" />
                : <Play className="w-7 h-7 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}