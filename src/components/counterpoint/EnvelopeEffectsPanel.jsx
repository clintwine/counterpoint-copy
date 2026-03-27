import React from 'react';
import { Button } from "@/components/ui/button";
import { Waves } from 'lucide-react';

export default function EnvelopeEffectsPanel({
  envelope = { attack: 0.02, sustain: 0.7, release: 0.3 },
  effects = { reverb: 0.3, delay: 0, chorus: 0 },
  onEnvelopeChange,
  onEffectChange,
  showWaveEditor,
  onToggleWaveEditor,
  onOpenWaveEditor
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ADSR Envelope Knobs - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Attack</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #10b981 ${(envelope?.attack ?? 0.02) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((envelope?.attack ?? 0.02) * 100)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={envelope?.attack ?? 0.02}
              onChange={(e) => onEnvelopeChange?.('attack', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Sustain</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #10b981 ${(envelope?.sustain ?? 0.7) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((envelope?.sustain ?? 0.7) * 100)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={envelope?.sustain ?? 0.7}
              onChange={(e) => onEnvelopeChange?.('sustain', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Release</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #10b981 ${(envelope?.release ?? 0.3) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((envelope?.release ?? 0.3) * 100)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.01"
              value={envelope?.release ?? 0.3}
              onChange={(e) => onEnvelopeChange?.('release', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-600 hidden sm:block" />

      {/* Effect Knobs - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Reverb</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #f59e0b ${(effects?.reverb ?? 0.3) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((effects?.reverb ?? 0.3) * 100)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.reverb ?? 0.3}
              onChange={(e) => onEffectChange?.('reverb', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Delay</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #f59e0b ${(effects?.delay ?? 0) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((effects?.delay ?? 0) * 100)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.delay ?? 0}
              onChange={(e) => onEffectChange?.('delay', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-white/50 uppercase">Chorus</span>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
            style={{
              background: `conic-gradient(from 225deg, #f59e0b ${(effects?.chorus ?? 0) * 270}deg, #334155 0deg)`
            }}>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-[8px] text-white/70">{Math.round((effects?.chorus ?? 0) * 100)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.chorus ?? 0}
              onChange={(e) => onEffectChange?.('chorus', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-600 hidden sm:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onOpenWaveEditor) {
              onOpenWaveEditor();
            } else {
              onToggleWaveEditor(!showWaveEditor);
            }
          }}
          className={`h-7 px-2 text-xs ${showWaveEditor ? 'bg-amber-500/20 text-amber-400' : 'text-white/60 hover:text-white hover:bg-slate-700'}`}>
          <Waves className="w-3.5 h-3.5 mr-1" />
          Instrument Editor
        </Button>
      </div>
    </div>
  );
}