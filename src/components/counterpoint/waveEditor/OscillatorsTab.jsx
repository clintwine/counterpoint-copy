import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from 'lucide-react';

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

export default function OscillatorsTab({ instrument, setInstrument }) {
  const updateOscillator = (index, key, value) => {
    const newOscs = [...instrument.oscillators];
    newOscs[index] = {
      waveform: newOscs[index]?.waveform || 'sine',
      detune: newOscs[index]?.detune ?? 0,
      gain: newOscs[index]?.gain ?? 0.5,
      harmonic: newOscs[index]?.harmonic ?? 1,
      phase: newOscs[index]?.phase ?? 0,
      [key]: value
    };
    setInstrument({ ...instrument, oscillators: newOscs });
  };

  const addOscillator = () => {
    if (instrument.oscillators.length >= 4) return;
    setInstrument({
      ...instrument,
      oscillators: [...instrument.oscillators, { waveform: 'sine', detune: 0, gain: 0.5, harmonic: 1, phase: 0 }]
    });
  };

  const removeOscillator = (index) => {
    if (instrument.oscillators.length <= 1) return;
    setInstrument({ ...instrument, oscillators: instrument.oscillators.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-4 gap-3">
        {instrument.oscillators.map((osc, i) => (
          <div key={i} className="bg-slate-700/50 rounded p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm font-medium">Oscillator {i + 1}</span>
              {instrument.oscillators.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeOscillator(i)} className="h-6 w-6 p-0 text-red-400 hover:text-red-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <Select value={osc.waveform} onValueChange={(v) => updateOscillator(i, 'waveform', v)}>
              <SelectTrigger className="h-9 bg-slate-700 border-slate-600 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 z-[200000]">
                {WAVEFORMS.map(w => (
                  <SelectItem key={w} value={w} className="text-white text-sm capitalize">{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-1">
              <span className="text-white/40 text-xs">Timbre</span>
              <div
                className="relative h-24 bg-slate-800 border border-slate-600 rounded cursor-crosshair select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const update = (clientX, clientY) => {
                    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
                    const newOscs = [...instrument.oscillators];
                    newOscs[i] = { ...newOscs[i], phase: x * 360, detune: (y - 0.5) * 100 };
                    setInstrument({ ...instrument, oscillators: newOscs });
                  };
                  update(e.clientX, e.clientY);
                  const onMove = (e) => update(e.clientX, e.clientY);
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
              >
                <span className="absolute top-1 left-1 text-[9px] text-white/30">Soft</span>
                <span className="absolute top-1 right-1 text-[9px] text-white/30">Bright</span>
                <span className="absolute bottom-1 left-1 text-[9px] text-white/30">Warm</span>
                <span className="absolute bottom-1 right-1 text-[9px] text-white/30">Metallic</span>
                <div
                  className="absolute w-3 h-3 bg-amber-400 rounded-full border-2 border-white shadow-lg pointer-events-none"
                  style={{
                    left: `${((osc.phase || 0) / 360) * 100}%`,
                    top: `${(1 - ((osc.detune || 0) / 100 + 0.5)) * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Gain</span>
                <span className="text-white/60 text-xs">{Math.round(osc.gain * 100)}%</span>
              </div>
              <Slider value={[osc.gain]} onValueChange={([v]) => updateOscillator(i, 'gain', v)} min={0} max={1} step={0.01} className="w-full" />
            </div>
          </div>
        ))}

        {[...Array(4 - instrument.oscillators.length)].map((_, i) => (
          <button
            key={`empty-${i}`}
            onClick={addOscillator}
            className="bg-slate-700/30 border-2 border-dashed border-slate-600 rounded p-3 flex items-center justify-center min-h-[200px] hover:border-amber-500/50 hover:bg-slate-700/40 transition-colors group"
          >
            <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-amber-400/70">
              <Plus className="w-6 h-6" />
              <span className="text-xs">Add Oscillator</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}