import { Button } from "@/components/ui/button";
import { Waves, Keyboard } from 'lucide-react';

export default function EnvelopeEffectsPanel({
  envelope = { attack: 0.02, sustain: 0.7, release: 0.3 },
  effects = { reverb: 0.3, delay: 0, chorus: 0 },
  onEnvelopeChange,
  onEffectChange,
  showWaveEditor,
  onToggleWaveEditor,
  onOpenWaveEditor,
  onTogglePianoPanel
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-3">
      {/* ADSR Knobs - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Attack */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (envelope?.attack ?? 0.02) / 0.3} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] text-white/70">A</span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={envelope?.attack ?? 0.02}
              onChange={(e) => onEnvelopeChange?.('attack', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((envelope?.attack ?? 0.02) * 1000)}ms</span>
        </div>

        {/* Sustain */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (envelope?.sustain ?? 0.7)} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] text-white/70">S</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={envelope?.sustain ?? 0.7}
              onChange={(e) => onEnvelopeChange?.('sustain', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((envelope?.sustain ?? 0.7) * 100)}%</span>
        </div>

        {/* Release */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (envelope?.release ?? 0.3) / 1} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] text-white/70">R</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={envelope?.release ?? 0.3}
              onChange={(e) => onEnvelopeChange?.('release', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((envelope?.release ?? 0.3) * 1000)}ms</span>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-600 hidden sm:block" />

      {/* Effects */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Reverb */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (effects?.reverb ?? 0.3)} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] text-white/70">R</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.reverb ?? 0.3}
              onChange={(e) => onEffectChange?.('reverb', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((effects?.reverb ?? 0.3) * 100)}</span>
        </div>

        {/* Delay */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (effects?.delay ?? 0)} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[8px] text-white/70">D</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.delay ?? 0}
              onChange={(e) => onEffectChange?.('delay', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((effects?.delay ?? 0) * 100)}</span>
        </div>

        {/* Chorus */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="2" />
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 40 * (effects?.chorus ?? 0)} ${2 * Math.PI * 40}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[8px] text-white/70">C</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effects?.chorus ?? 0}
              onChange={(e) => onEffectChange?.('chorus', parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[8px] text-white/70 absolute bottom-0 left-1/2 -translate-x-1/2">{Math.round((effects?.chorus ?? 0) * 100)}</span>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePianoPanel}
          className="h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-slate-700">
          <Keyboard className="w-3.5 h-3.5 mr-1" />
          Keys
        </Button>
      </div>
    </div>
  );
}