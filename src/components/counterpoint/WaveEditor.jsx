import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Save, Trash2, Plus } from 'lucide-react';
import { initAudio, getAudioContext } from './audioEngine';

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

const DEFAULT_INSTRUMENT = {
  name: 'Custom 1',
  oscillators: [
    { waveform: 'sine', detune: 0, gain: 1.0 }
  ],
  envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 },
  filter: { type: 'lowpass', frequency: 2000, Q: 1 },
  effects: { distortion: 0 }
};

const PRESET_LIBRARY = [
  {
    name: 'Warm Pad',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.5 },
      { waveform: 'sawtooth', detune: 7, gain: 0.5 }
    ],
    envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1200, Q: 0.5 }
  },
  {
    name: 'Bright Lead',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.7 },
      { waveform: 'square', detune: 12, gain: 0.3 }
    ],
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
    filter: { type: 'lowpass', frequency: 4000, Q: 2 }
  },
  {
    name: 'Sub Bass',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 1.0 }
    ],
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
    filter: { type: 'lowpass', frequency: 500, Q: 1 }
  },
  {
    name: 'Pluck',
    oscillators: [
      { waveform: 'triangle', detune: 0, gain: 0.8 },
      { waveform: 'square', detune: 0, gain: 0.2 }
    ],
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 },
    filter: { type: 'lowpass', frequency: 3000, Q: 1.5 }
  },
  {
    name: 'Bell',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.6 },
      { waveform: 'sine', detune: 700, gain: 0.3 },
      { waveform: 'sine', detune: 1200, gain: 0.1 }
    ],
    envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.8 },
    filter: { type: 'highpass', frequency: 500, Q: 0.5 }
  },
  {
    name: 'Choir',
    oscillators: [
      { waveform: 'sawtooth', detune: -5, gain: 0.4 },
      { waveform: 'sawtooth', detune: 5, gain: 0.4 },
      { waveform: 'sine', detune: 0, gain: 0.2 }
    ],
    envelope: { attack: 0.2, decay: 0.1, sustain: 0.7, release: 0.4 },
    filter: { type: 'bandpass', frequency: 1500, Q: 2 }
  },
  {
    name: 'Reese Bass',
    oscillators: [
      { waveform: 'sawtooth', detune: -10, gain: 0.5 },
      { waveform: 'sawtooth', detune: 10, gain: 0.5 }
    ],
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.15 },
    filter: { type: 'lowpass', frequency: 800, Q: 3 }
  },
  {
    name: 'Flutey',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 0.9 },
      { waveform: 'triangle', detune: 0, gain: 0.1 }
    ],
    envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.25 },
    filter: { type: 'lowpass', frequency: 3500, Q: 0.3 }
  }
];

export default function WaveEditor({ 
  customInstruments = [], 
  onSaveInstrument, 
  onDeleteInstrument,
  onClose 
}) {
  const [instrument, setInstrument] = useState({ ...DEFAULT_INSTRUMENT });
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewingPreset, setPreviewingPreset] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const oscillatorsRef = useRef([]);

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(30, 41, 59)';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#E8B885';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  // Generate static waveform preview
  const generateStaticWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = 'rgb(30, 41, 59)';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E8B885';
    ctx.beginPath();

    const samples = 200;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 4;
      let y = 0;

      instrument.oscillators.forEach(osc => {
        const detuneRatio = Math.pow(2, osc.detune / 1200);
        const phase = t * detuneRatio;
        let wave = 0;

        switch (osc.waveform) {
          case 'sine':
            wave = Math.sin(phase);
            break;
          case 'square':
            wave = Math.sin(phase) > 0 ? 1 : -1;
            break;
          case 'sawtooth':
            wave = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
            break;
          case 'triangle':
            wave = 2 * Math.abs(2 * ((phase / (2 * Math.PI)) % 1) - 1) - 1;
            break;
        }
        y += wave * osc.gain;
      });

      y = y / Math.max(1, instrument.oscillators.length);
      const px = (i / samples) * width;
      const py = height / 2 - (y * height * 0.4);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }, [instrument]);

  useEffect(() => {
    if (!isPlaying) {
      generateStaticWaveform();
    }
  }, [instrument, isPlaying, generateStaticWaveform]);

  const playPreviewForInstrument = useCallback((inst, onEnd) => {
    initAudio();
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3;

    const filter = audioContext.createBiquadFilter();
    filter.type = inst.filter.type;
    filter.frequency.value = inst.filter.frequency;
    filter.Q.value = inst.filter.Q;

    const now = audioContext.currentTime;
    const { attack, decay, sustain, release } = inst.envelope;
    const duration = 1;

    inst.oscillators.forEach(oscConfig => {
      const osc = audioContext.createOscillator();
      osc.type = oscConfig.waveform;
      osc.frequency.value = 440;
      osc.detune.value = oscConfig.detune;

      const oscGain = audioContext.createGain();
      oscGain.gain.value = oscConfig.gain * 0.5;

      osc.connect(oscGain);
      oscGain.connect(filter);
      oscillatorsRef.current.push({ osc, gain: oscGain });
      osc.start(now);
    });

    filter.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioContext.destination);

    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.3, now + attack);
    masterGain.gain.linearRampToValueAtTime(0.3 * sustain, now + attack + decay);
    masterGain.gain.setValueAtTime(0.3 * sustain, now + duration - release);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    setTimeout(() => {
      stopPreview();
      if (onEnd) onEnd();
    }, duration * 1000 + 100);
  }, []);

  const playPreview = useCallback(() => {
    setIsPlaying(true);
    playPreviewForInstrument(instrument, () => setIsPlaying(false));
    drawWaveform();
  }, [instrument, drawWaveform, playPreviewForInstrument]);

  const playPresetPreview = useCallback((preset, index) => {
    if (previewingPreset !== null) return;
    setPreviewingPreset(index);
    playPreviewForInstrument(preset, () => setPreviewingPreset(null));
  }, [previewingPreset, playPreviewForInstrument]);

  const stopPreview = useCallback(() => {
    oscillatorsRef.current.forEach(({ osc }) => {
      try { osc.stop(); } catch (e) {}
    });
    oscillatorsRef.current = [];
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsPlaying(false);
  }, []);

  const updateOscillator = (index, key, value) => {
    const newOscs = [...instrument.oscillators];
    newOscs[index] = { ...newOscs[index], [key]: value };
    setInstrument({ ...instrument, oscillators: newOscs });
  };

  const addOscillator = () => {
    if (instrument.oscillators.length >= 4) return;
    setInstrument({
      ...instrument,
      oscillators: [...instrument.oscillators, { waveform: 'sine', detune: 0, gain: 0.5 }]
    });
  };

  const removeOscillator = (index) => {
    if (instrument.oscillators.length <= 1) return;
    const newOscs = instrument.oscillators.filter((_, i) => i !== index);
    setInstrument({ ...instrument, oscillators: newOscs });
  };

  const handleSave = () => {
    if (editingIndex >= 0) {
      // Updating existing instrument - keep editing it
      onSaveInstrument(instrument, editingIndex);
    } else {
      // Creating new instrument - set editing index to the new position
      const newIndex = customInstruments.length;
      onSaveInstrument(instrument, -1);
      setEditingIndex(newIndex);
    }
  };

  const loadInstrument = (inst, index) => {
    setInstrument({ ...inst });
    setEditingIndex(index);
  };

  return (
    <div className="space-y-3">
      {/* Top Row: Presets + Name + Waveform Preview */}
      <div className="flex gap-3">
        {/* Left: Combined Library List */}
        <div className="w-36 flex-shrink-0 space-y-1">
          <Label className="text-white/70 text-[10px] uppercase tracking-wider">Library</Label>
          <div className="bg-slate-700/50 rounded-lg p-1.5 space-y-0.5 max-h-[120px] overflow-y-auto">
            {PRESET_LIBRARY.map((preset, i) => (
              <div key={`lib-${i}`} className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPresetPreview(preset, `lib-${i}`);
                  }}
                  className="h-5 w-5 p-0 text-white/40 hover:text-amber-400 flex-shrink-0"
                >
                  {previewingPreset === `lib-${i}` ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInstrument({ ...preset });
                    setEditingIndex(-1);
                  }}
                  className="flex-1 h-5 text-[9px] justify-start px-1 text-white/60 hover:text-white hover:bg-slate-600"
                >
                  {preset.name}
                </Button>
              </div>
            ))}
            {customInstruments.length > 0 && (
              <>
                <div className="h-px bg-slate-600 my-1" />
                {customInstruments.map((inst, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPresetPreview(inst, `custom-${i}`);
                      }}
                      className="h-5 w-5 p-0 text-white/40 hover:text-amber-400 flex-shrink-0"
                    >
                      {previewingPreset === `custom-${i}` ? <Square className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadInstrument(inst, i)}
                      className={`flex-1 h-5 text-[9px] justify-start px-1 ${editingIndex === i ? 'bg-amber-500/20 text-amber-400' : 'text-white/70 hover:text-white'}`}
                    >
                      {inst.name}
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Center: Name + Waveform */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-white/70 text-[10px]">Name</Label>
              <Input
                value={instrument.name}
                onChange={(e) => setInstrument({ ...instrument, name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white h-7 text-xs"
              />
            </div>
            <div className="flex items-end gap-1">
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 bg-amber-500 text-slate-900 hover:bg-amber-400 text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                {editingIndex >= 0 ? 'Update' : 'Save'}
              </Button>
              {editingIndex >= 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onDeleteInstrument(editingIndex);
                    setInstrument({ ...DEFAULT_INSTRUMENT });
                    setEditingIndex(-1);
                  }}
                  className="h-7 w-7 p-0 border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={300}
              height={60}
              className="w-full rounded border border-slate-600"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={isPlaying ? stopPreview : playPreview}
              className="absolute bottom-1 right-1 h-6 w-6 p-0 bg-slate-900/80 text-white hover:bg-slate-900"
            >
              {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Right: ADSR Knobs */}
        <div className="flex-shrink-0">
          <Label className="text-white/70 text-[10px] uppercase tracking-wider">Envelope</Label>
          <div className="flex gap-2 mt-1">
            {['attack', 'decay', 'sustain', 'release'].map(param => (
              <div key={param} className="text-center">
                <div
                  className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 relative flex items-center justify-center cursor-pointer"
                  style={{
                    background: `conic-gradient(from 225deg, #10b981 ${instrument.envelope[param] * (param === 'sustain' ? 270 : 135)}deg, #334155 0deg)`
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="text-[7px] text-white/70">{Math.round(instrument.envelope[param] * 100)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.01}
                    max={param === 'sustain' ? 1 : 2}
                    step="0.01"
                    value={instrument.envelope[param]}
                    onChange={(e) => setInstrument({
                      ...instrument,
                      envelope: { ...instrument.envelope, [param]: parseFloat(e.target.value) }
                    })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[8px] text-white/50 uppercase">{param.charAt(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Oscillators + Filter */}
      <div className="flex gap-3">
        {/* Oscillators */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-white/70 text-[10px] uppercase tracking-wider">Oscillators</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={addOscillator}
              disabled={instrument.oscillators.length >= 4}
              className="h-5 px-1 text-amber-400 hover:text-amber-300 text-[10px]"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {instrument.oscillators.map((osc, i) => (
              <div key={i} className="bg-slate-700/50 rounded p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-[10px]">Osc {i + 1}</span>
                  {instrument.oscillators.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOscillator(i)}
                      className="h-4 w-4 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-1">
                  <Select value={osc.waveform} onValueChange={(v) => updateOscillator(i, 'waveform', v)}>
                    <SelectTrigger className="h-6 bg-slate-700 border-slate-600 text-white text-[10px] flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {WAVEFORMS.map(w => (
                        <SelectItem key={w} value={w} className="text-white text-[10px] capitalize">{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={osc.detune}
                    onChange={(e) => updateOscillator(i, 'detune', parseFloat(e.target.value) || 0)}
                    className="h-6 w-14 bg-slate-700 border-slate-600 text-white text-[10px]"
                    placeholder="Detune"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white/40 text-[9px]">Gain</span>
                  <Slider
                    value={[osc.gain]}
                    onValueChange={([v]) => updateOscillator(i, 'gain', v)}
                    min={0}
                    max={1}
                    step={0.01}
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div className="w-44 flex-shrink-0 space-y-2">
          <Label className="text-white/70 text-[10px] uppercase tracking-wider">Filter</Label>
          <div className="bg-slate-700/50 rounded p-2 space-y-2">
            <Select
              value={instrument.filter.type}
              onValueChange={(v) => setInstrument({ ...instrument, filter: { ...instrument.filter, type: v } })}
            >
              <SelectTrigger className="h-6 bg-slate-700 border-slate-600 text-white text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                  <SelectItem key={t} value={t} className="text-white text-[10px] capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <span className="text-white/40 text-[9px] w-8">Freq</span>
              <Slider
                value={[instrument.filter.frequency]}
                onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, frequency: v } })}
                min={100}
                max={8000}
                step={10}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/40 text-[9px] w-8">Q</span>
              <Slider
                value={[instrument.filter.Q]}
                onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, Q: v } })}
                min={0.1}
                max={20}
                step={0.1}
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}