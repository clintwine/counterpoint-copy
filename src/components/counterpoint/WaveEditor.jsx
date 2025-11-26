import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Save, Trash2, Plus, Volume2 } from 'lucide-react';
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

export default function WaveEditor({ 
  customInstruments = [], 
  onSaveInstrument, 
  onDeleteInstrument,
  onClose 
}) {
  const [instrument, setInstrument] = useState({ ...DEFAULT_INSTRUMENT });
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const playPreview = useCallback(() => {
    initAudio();
    const audioContext = getAudioContext();
    if (!audioContext) return;

    // Create analyser
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3;

    // Create filter
    const filter = audioContext.createBiquadFilter();
    filter.type = instrument.filter.type;
    filter.frequency.value = instrument.filter.frequency;
    filter.Q.value = instrument.filter.Q;

    const now = audioContext.currentTime;
    const { attack, decay, sustain, release } = instrument.envelope;
    const duration = 1;

    // Create oscillators
    instrument.oscillators.forEach(oscConfig => {
      const osc = audioContext.createOscillator();
      osc.type = oscConfig.waveform;
      osc.frequency.value = 440; // A4
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

    // Envelope
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.3, now + attack);
    masterGain.gain.linearRampToValueAtTime(0.3 * sustain, now + attack + decay);
    masterGain.gain.setValueAtTime(0.3 * sustain, now + duration - release);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    setIsPlaying(true);
    drawWaveform();

    setTimeout(() => {
      stopPreview();
    }, duration * 1000 + 100);
  }, [instrument, drawWaveform]);

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
      onSaveInstrument(instrument, editingIndex);
    } else {
      onSaveInstrument(instrument, -1);
    }
    setInstrument({ ...DEFAULT_INSTRUMENT, name: `Custom ${customInstruments.length + 2}` });
    setEditingIndex(-1);
  };

  const loadInstrument = (inst, index) => {
    setInstrument({ ...inst });
    setEditingIndex(index);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Wave Editor</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:text-white">
          ×
        </Button>
      </div>

      {/* Saved Instruments */}
      {customInstruments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {customInstruments.map((inst, i) => (
            <Button
              key={i}
              variant={editingIndex === i ? 'default' : 'outline'}
              size="sm"
              onClick={() => loadInstrument(inst, i)}
              className={editingIndex === i ? 'bg-amber-500 text-slate-900' : 'border-slate-600 text-white'}
            >
              {inst.name}
            </Button>
          ))}
        </div>
      )}

      {/* Name */}
      <div>
        <Label className="text-white/70 text-xs">Instrument Name</Label>
        <Input
          value={instrument.name}
          onChange={(e) => setInstrument({ ...instrument, name: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white mt-1 h-8"
        />
      </div>

      {/* Waveform Preview */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={100}
          className="w-full rounded-lg border border-slate-600"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={isPlaying ? stopPreview : playPreview}
          className="absolute bottom-2 right-2 bg-slate-900/80 text-white hover:bg-slate-900"
        >
          {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {/* Oscillators */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-white/70 text-xs uppercase tracking-wider">Oscillators</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addOscillator}
            disabled={instrument.oscillators.length >= 4}
            className="h-6 px-2 text-amber-400 hover:text-amber-300"
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        {instrument.oscillators.map((osc, i) => (
          <div key={i} className="bg-slate-700/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Oscillator {i + 1}</span>
              {instrument.oscillators.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOscillator(i)}
                  className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-white/50 text-[10px]">Waveform</Label>
                <Select value={osc.waveform} onValueChange={(v) => updateOscillator(i, 'waveform', v)}>
                  <SelectTrigger className="h-7 bg-slate-700 border-slate-600 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {WAVEFORMS.map(w => (
                      <SelectItem key={w} value={w} className="text-white text-xs capitalize">{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-white/50 text-[10px]">Detune (cents)</Label>
                <Input
                  type="number"
                  value={osc.detune}
                  onChange={(e) => updateOscillator(i, 'detune', parseFloat(e.target.value) || 0)}
                  className="h-7 bg-slate-700 border-slate-600 text-white text-xs"
                />
              </div>

              <div>
                <Label className="text-white/50 text-[10px]">Gain</Label>
                <Slider
                  value={[osc.gain]}
                  onValueChange={([v]) => updateOscillator(i, 'gain', v)}
                  min={0}
                  max={1}
                  step={0.01}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Envelope */}
      <div className="space-y-2">
        <Label className="text-white/70 text-xs uppercase tracking-wider">Envelope (ADSR)</Label>
        <div className="grid grid-cols-4 gap-3">
          {['attack', 'decay', 'sustain', 'release'].map(param => (
            <div key={param} className="text-center">
              <div
                className="w-10 h-10 mx-auto rounded-full bg-slate-700 border-2 border-slate-600 relative flex items-center justify-center cursor-pointer"
                style={{
                  background: `conic-gradient(from 225deg, #10b981 ${instrument.envelope[param] * (param === 'sustain' ? 270 : 135)}deg, #334155 0deg)`
                }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-[8px] text-white/70">{Math.round(instrument.envelope[param] * 100)}</span>
                </div>
                <input
                  type="range"
                  min={param === 'attack' ? 0.01 : 0.01}
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
              <span className="text-[9px] text-white/50 uppercase mt-1 block">{param.charAt(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="space-y-2">
        <Label className="text-white/70 text-xs uppercase tracking-wider">Filter</Label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-white/50 text-[10px]">Type</Label>
            <Select
              value={instrument.filter.type}
              onValueChange={(v) => setInstrument({ ...instrument, filter: { ...instrument.filter, type: v } })}
            >
              <SelectTrigger className="h-7 bg-slate-700 border-slate-600 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                  <SelectItem key={t} value={t} className="text-white text-xs capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white/50 text-[10px]">Frequency</Label>
            <Slider
              value={[instrument.filter.frequency]}
              onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, frequency: v } })}
              min={100}
              max={8000}
              step={10}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="text-white/50 text-[10px]">Resonance (Q)</Label>
            <Slider
              value={[instrument.filter.Q]}
              onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, Q: v } })}
              min={0.1}
              max={20}
              step={0.1}
              className="mt-2"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          className="flex-1 bg-amber-500 text-slate-900 hover:bg-amber-400"
        >
          <Save className="w-4 h-4 mr-2" />
          {editingIndex >= 0 ? 'Update' : 'Save'} Instrument
        </Button>
        {editingIndex >= 0 && (
          <Button
            variant="outline"
            onClick={() => {
              onDeleteInstrument(editingIndex);
              setInstrument({ ...DEFAULT_INSTRUMENT });
              setEditingIndex(-1);
            }}
            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}