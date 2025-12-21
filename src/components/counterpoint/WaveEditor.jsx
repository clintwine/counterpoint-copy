import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Save, Trash2, Plus } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initAudio, getAudioContext, playNoteWithCustomInstrument } from './audioEngine';

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

const DEFAULT_INSTRUMENT = {
  name: 'Custom 1',
  oscillators: [
    { waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1, phase: 0 }
  ],
  envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 },
  filter: { type: 'lowpass', frequency: 2000, Q: 1 },
  lfo: { rate: 0, amount: 0, target: 'pitch' },
  distortion: 0,
  bitcrush: 0
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
  onInstrumentChange,
  onVoiceInstrumentChange,
  onClose,
  currentInstrument = null,
  currentInstrumentConfig = null
}) {
  const [instrument, setInstrument] = useState({ ...DEFAULT_INSTRUMENT });
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isDraggingTimbre, setIsDraggingTimbre] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load current instrument when opening editor
  useEffect(() => {
    if (currentInstrumentConfig) {
      // Ensure all required fields exist
      const loadedInstrument = {
        ...DEFAULT_INSTRUMENT,
        ...currentInstrumentConfig,
        filter: { ...DEFAULT_INSTRUMENT.filter, ...currentInstrumentConfig.filter }
      };
      setInstrument(loadedInstrument);
      
      // Set editing index if it's a custom instrument
      if (currentInstrument?.startsWith('custom_')) {
        const index = parseInt(currentInstrument.split('_')[1]);
        setEditingIndex(index);
      } else {
        setEditingIndex(-1);
      }
    }
  }, [currentInstrument, currentInstrumentConfig]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewingPreset, setPreviewingPreset] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [livePreview, setLivePreview] = useState(false);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const liveNoteIdRef = useRef(null);

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    
    // Get actual display dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
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
        const y = v * height / 2;

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
    
    // Set canvas resolution for sharp rendering
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

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
    masterGain.gain.value = (inst.volume ?? 1) * 0.3;

    const filter = audioContext.createBiquadFilter();
    filter.type = inst.filter.type;
    filter.frequency.value = inst.filter.frequency;
    filter.Q.value = inst.filter.Q;

    const now = audioContext.currentTime;
    const { attack, decay, sustain, release } = inst.envelope;
    const duration = 1;

    // LFO setup
    let lfoNode = null;
    if (inst.lfo?.rate > 0 && inst.lfo?.amount > 0) {
      lfoNode = audioContext.createOscillator();
      lfoNode.frequency.value = inst.lfo.rate;
      lfoNode.type = 'sine';
      
      const lfoGain = audioContext.createGain();
      if (inst.lfo.target === 'pitch') {
        lfoGain.gain.value = inst.lfo.amount * 50;
      } else if (inst.lfo.target === 'filter') {
        lfoGain.gain.value = inst.lfo.amount * 1000;
      } else if (inst.lfo.target === 'volume') {
        lfoGain.gain.value = inst.lfo.amount * 0.3;
      }
      
      lfoNode.connect(lfoGain);
      if (inst.lfo.target === 'filter') {
        lfoGain.connect(filter.frequency);
      } else if (inst.lfo.target === 'volume') {
        lfoGain.connect(masterGain.gain);
      }
      lfoNode.start(now);
      lfoNode.stop(now + duration + release);
    }

    inst.oscillators.forEach(oscConfig => {
      const osc = audioContext.createOscillator();
      osc.type = oscConfig.waveform;
      osc.frequency.value = 440;
      osc.detune.value = oscConfig.detune;

      // Apply phase offset
      if (oscConfig.phase) {
        const phaseOffset = (oscConfig.phase / 360) * (1 / 440);
        osc.start(now + phaseOffset);
      }

      // Apply LFO to pitch if enabled
      if (lfoNode && inst.lfo?.target === 'pitch') {
        const lfoGain = audioContext.createGain();
        lfoGain.gain.value = inst.lfo.amount * 50;
        lfoNode.connect(lfoGain);
        lfoGain.connect(osc.detune);
      }

      const oscGain = audioContext.createGain();
      oscGain.gain.value = oscConfig.gain * 0.5;

      osc.connect(oscGain);
      oscGain.connect(filter);
      oscillatorsRef.current.push({ osc, gain: oscGain });
      if (!oscConfig.phase) {
        osc.start(now);
      }
    });

    // Chain effects
    let outputNode = filter;

    // Distortion
    if (inst.distortion > 0) {
      const distortion = audioContext.createWaveShaper();
      const amount = inst.distortion;
      const samples = 44100;
      const curve = new Float32Array(samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
      }
      distortion.curve = curve;
      outputNode.connect(distortion);
      outputNode = distortion;
    }

    // Bitcrush
    if (inst.bitcrush > 0) {
      const bitcrush = audioContext.createWaveShaper();
      const samples = 44100;
      const curve = new Float32Array(samples);
      const step = Math.pow(0.5, inst.bitcrush);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = step * Math.floor(x / step + 0.5);
      }
      bitcrush.curve = curve;
      outputNode.connect(bitcrush);
      outputNode = bitcrush;
    }

    outputNode.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioContext.destination);

    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime((inst.volume ?? 1) * 0.3, now + attack);
    masterGain.gain.linearRampToValueAtTime((inst.volume ?? 1) * 0.3 * sustain, now + attack + decay);
    masterGain.gain.setValueAtTime((inst.volume ?? 1) * 0.3 * sustain, now + duration - release);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    setTimeout(() => {
      stopPreview();
      if (onEnd) onEnd();
    }, duration * 1000 + 100);
  }, []);

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

  const playPreview = useCallback(() => {
    setIsPlaying(true);
    playPreviewForInstrument(instrument, () => {
      setIsPlaying(false);
    });
    drawWaveform();
  }, [instrument, drawWaveform, playPreviewForInstrument]);

  const playPresetPreview = useCallback((preset, index) => {
    if (previewingPreset !== null) return;
    setPreviewingPreset(index);
    playPreviewForInstrument(preset, () => setPreviewingPreset(null));
  }, [previewingPreset, playPreviewForInstrument]);

  const updateOscillator = (index, key, value) => {
    const newOscs = [...instrument.oscillators];
    newOscs[index] = { ...newOscs[index], [key]: value };
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
    const newOscs = instrument.oscillators.filter((_, i) => i !== index);
    setInstrument({ ...instrument, oscillators: newOscs });
  };

  const handleSave = () => {
    // Ensure instrument has all required fields before saving
    const instrumentToSave = {
      ...instrument,
      lfo: instrument.lfo || { rate: 0, amount: 0, target: 'pitch' },
      distortion: instrument.distortion ?? 0,
      bitcrush: instrument.bitcrush ?? 0
    };
    
    if (editingIndex >= 0) {
      // Updating existing instrument - keep editing it
      onSaveInstrument(instrumentToSave, editingIndex);
    } else {
      // Creating new instrument - set editing index to the new position
      const newIndex = customInstruments.length;
      onSaveInstrument(instrumentToSave, -1);
      setEditingIndex(newIndex);
    }
  };

  const recordingIntervalRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      setIsRecording(true);
      setRecordingTime(0);

      // Analyze audio in real-time
      const bufferLength = analyser.frequencyBinCount;
      const samples = [];
      
      const collectSamples = () => {
        analyser.getByteFrequencyData(dataArray);
        samples.push(new Uint8Array(dataArray));
      };
      
      const sampleInterval = setInterval(collectSamples, 50);
      const dataArray = new Uint8Array(bufferLength);

      // Update timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 0.1;
          if (next >= 2) {
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
            }
            return 2;
          }
          return next;
        });
      }, 100);

      // Record for 2 seconds then analyze
      setTimeout(() => {
        clearInterval(sampleInterval);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
        analyzeVoice(samples, analyser.frequencyBinCount);
      }, 2000);
    } catch (error) {
      console.error('Failed to access microphone:', error);
      alert('Could not access microphone. Please grant permission and try again.');
      setIsRecording(false);
    }
  };

  const analyzeVoice = (samples, binCount) => {
    if (samples.length === 0) {
      alert('No audio detected. Please try again.');
      return;
    }

    // Average all samples
    const avgSpectrum = new Float32Array(binCount);
    samples.forEach(sample => {
      for (let i = 0; i < binCount; i++) {
        avgSpectrum[i] += sample[i];
      }
    });
    
    for (let i = 0; i < binCount; i++) {
      avgSpectrum[i] /= samples.length;
    }

    // Find peaks - focus on musical frequency range (80Hz to 4000Hz)
    // Assuming 44.1kHz sample rate and FFT size 2048
    const sampleRate = 44100;
    const fftSize = 2048;
    const binToFreq = (bin) => (bin * sampleRate) / fftSize;
    
    const peaks = [];
    const minBin = Math.floor((80 * fftSize) / sampleRate); // ~80 Hz
    const maxBin = Math.floor((4000 * fftSize) / sampleRate); // ~4000 Hz
    
    for (let i = minBin; i < Math.min(maxBin, binCount - 2); i++) {
      if (avgSpectrum[i] > avgSpectrum[i - 1] && 
          avgSpectrum[i] > avgSpectrum[i + 1] &&
          avgSpectrum[i] > 30) {
        peaks.push({ 
          bin: i, 
          frequency: binToFreq(i),
          magnitude: avgSpectrum[i] 
        });
      }
    }

    if (peaks.length === 0) {
      alert('Could not detect voice. Please speak or sing louder and closer to the microphone.');
      return;
    }

    // Sort by magnitude and take top 4
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    const topPeaks = peaks.slice(0, 4);

    // Use the fundamental (strongest peak) as reference
    const fundamental = topPeaks[0].frequency;
    const maxMag = topPeaks[0].magnitude;

    // Create oscillators based on frequency ratios
    const oscillators = topPeaks.map((peak, idx) => {
      const ratio = peak.frequency / fundamental;
      const harmonic = Math.round(ratio);
      const detuneCents = 1200 * Math.log2(ratio / harmonic);
      
      return {
        waveform: idx === 0 ? 'sawtooth' : 'sine',
        detune: Math.round(detuneCents),
        gain: (peak.magnitude / maxMag) * (idx === 0 ? 0.8 : 0.5),
        harmonic: harmonic,
        phase: 0
      };
    });

    // Create instrument
    setInstrument({
      name: 'My Voice',
      oscillators,
      envelope: { attack: 0.08, decay: 0.15, sustain: 0.7, release: 0.35 },
      filter: { type: 'lowpass', frequency: 2800, Q: 0.8 },
      lfo: { rate: 0, amount: 0, target: 'pitch' },
      distortion: 0,
      bitcrush: 0,
      volume: 1
    });
    setEditingIndex(-1);
    
    console.log('Voice analysis complete:', { fundamental, oscillators });
  };

  const loadInstrument = (inst, index) => {
    // Load instrument with all required fields, preserving the name
    const loadedInstrument = {
      ...DEFAULT_INSTRUMENT,
      ...inst,
      name: inst.name,
      lfo: inst.lfo || { rate: 0, amount: 0, target: 'pitch' },
      distortion: inst.distortion ?? 0,
      bitcrush: inst.bitcrush ?? 0
    };
    setInstrument(loadedInstrument);
    setEditingIndex(index);
    // Update both the piano instrument selector and the voice instrument
    const instrumentValue = `custom_${index}`;
    if (onInstrumentChange) {
      onInstrumentChange(instrumentValue);
    }
    if (onVoiceInstrumentChange) {
      onVoiceInstrumentChange(0, instrumentValue);
    }
  };

  // Handle live preview toggle
  const toggleLivePreview = (enabled) => {
    setLivePreview(enabled);
    if (enabled) {
      // Play a short preview when enabled
      initAudio();
      playNoteWithCustomInstrument('C4', 0.8, 0.5, instrument);
    }
  };

  // Update live preview sound when instrument changes
  useEffect(() => {
    if (livePreview && !isDraggingTimbre) {
      // Play preview on each change with animation (but not while dragging)
      setIsPlaying(true);
      playPreviewForInstrument(instrument, () => {
        setIsPlaying(false);
      });
      drawWaveform();
    }
  }, [instrument, livePreview, isDraggingTimbre, playPreviewForInstrument, drawWaveform]);

  return (
    <div className="space-y-3">
      {/* Top Row: Presets + Name + Waveform Preview */}
      <div className="flex gap-3">
        {/* Left: Combined Library List */}
        <div className="w-40 flex-shrink-0 space-y-1.5">
          <Label className="text-white/70 text-xs uppercase tracking-wider">Library</Label>
          <div className="bg-slate-700/50 rounded-lg p-2 space-y-1 max-h-[140px] overflow-y-auto">
            {PRESET_LIBRARY.map((preset, i) => (
              <div key={`lib-${i}`} className="flex items-center gap-0.5 group">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPresetPreview(preset, `lib-${i}`);
                  }}
                  className="h-6 w-6 p-0 text-white/40 hover:text-amber-400 flex-shrink-0"
                  >
                  {previewingPreset === `lib-${i}` ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                  <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInstrument({ ...preset });
                    setEditingIndex(-1);
                    const instrumentValue = `preset_${i}`;
                    if (onInstrumentChange) {
                      onInstrumentChange(instrumentValue);
                    }
                    if (onVoiceInstrumentChange) {
                      onVoiceInstrumentChange(0, instrumentValue);
                    }
                  }}
                  className="flex-1 h-6 text-xs justify-start px-2 text-white/60 hover:text-white hover:bg-slate-600"
                  >
                  {preset.name}
                  </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Ensure all required fields are present
                    const clonedPreset = {
                      ...DEFAULT_INSTRUMENT,
                      ...preset,
                      name: `${preset.name} Copy`,
                      lfo: preset.lfo || { rate: 0, amount: 0, target: 'pitch' },
                      distortion: preset.distortion ?? 0,
                      bitcrush: preset.bitcrush ?? 0
                    };
                    setInstrument(clonedPreset);
                    setEditingIndex(-1);
                  }}
                  className="h-6 w-6 p-0 text-white/40 hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Clone"
                  >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </Button>
              </div>
            ))}
            {customInstruments.length > 0 && (
              <>
                <div className="h-px bg-slate-600 my-1" />
                {customInstruments.map((inst, i) => (
                  <div key={i} className="flex items-center gap-1 group">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPresetPreview(inst, `custom-${i}`);
                      }}
                      className="h-6 w-6 p-0 text-white/40 hover:text-amber-400 flex-shrink-0"
                    >
                      {previewingPreset === `custom-${i}` ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadInstrument(inst, i)}
                      className={`flex-1 h-6 text-xs justify-start px-2 ${editingIndex === i ? 'bg-amber-500/20 text-amber-400' : 'text-white/70 hover:text-white'}`}
                    >
                      {inst.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Ensure all required fields are present
                        const clonedInstrument = {
                          ...DEFAULT_INSTRUMENT,
                          ...inst,
                          name: `${inst.name} Copy`,
                          lfo: inst.lfo || { rate: 0, amount: 0, target: 'pitch' },
                          distortion: inst.distortion ?? 0,
                          bitcrush: inst.bitcrush ?? 0
                        };
                        setInstrument(clonedInstrument);
                        setEditingIndex(-1);
                      }}
                      className="h-6 w-6 p-0 text-white/40 hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100"
                      title="Clone"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Center: Name + Waveform */}
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-white/70 text-sm">Name</Label>
              <Input
                value={instrument.name}
                onChange={(e) => setInstrument({ ...instrument, name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white h-9 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                size="sm"
                onClick={startRecording}
                disabled={isRecording}
                className={`h-9 px-3 text-sm ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white mr-2" />
                    {recordingTime.toFixed(1)}s
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                    Record Voice
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const nextNumber = customInstruments.length + 1;
                  setInstrument({ ...DEFAULT_INSTRUMENT, name: `Custom ${nextNumber}` });
                  setEditingIndex(-1);
                }}
                className="h-9 px-3 bg-slate-600 text-white hover:bg-slate-500 text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-9 px-3 bg-amber-500 text-slate-900 hover:bg-amber-400 text-sm"
              >
                <Save className="w-4 h-4 mr-1.5" />
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
                  className="h-9 w-9 p-0 border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
           <canvas
             ref={canvasRef}
             className="w-full h-[80px] rounded border border-slate-600"
           />
            <Button
              variant="ghost"
              size="sm"
              onClick={isPlaying ? stopPreview : playPreview}
              className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-slate-900/80 text-white hover:bg-slate-900"
            >
              {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Right: ADSR Knobs + Live Preview */}
        <div className="flex-shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-white/70 text-xs uppercase tracking-wider">Envelope</Label>
            <div className="flex items-center gap-2">
              <Label className="text-white/50 text-xs">Live</Label>
              <Switch
                checked={livePreview}
                onCheckedChange={toggleLivePreview}
                className="data-[state=checked]:bg-amber-500 scale-75"
              />
            </div>
          </div>
          <div className="flex gap-3">
            {['attack', 'decay', 'sustain', 'release'].map(param => (
              <div key={param} className="text-center">
                <div
                  className="w-11 h-11 rounded-full bg-slate-700 border border-slate-600 relative flex items-center justify-center cursor-pointer"
                  style={{
                    background: `conic-gradient(from 225deg, #10b981 ${instrument.envelope[param] * (param === 'sustain' ? 270 : 135)}deg, #334155 0deg)`
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="text-[9px] text-white/70">{Math.round(instrument.envelope[param] * 100)}</span>
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
                <span className="text-[10px] text-white/50 uppercase">{param.charAt(0)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">Volume</span>
              <span className="text-white/60 text-xs">{Math.round((instrument.volume ?? 1) * 100)}%</span>
            </div>
            <Slider
              value={[instrument.volume ?? 1]}
              onValueChange={([v]) => setInstrument({ ...instrument, volume: v })}
              min={0}
              max={1}
              step={0.01}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Bottom Row: Tabbed Interface */}
      <Tabs defaultValue="oscillators" className="w-full">
        <TabsList className="bg-slate-700/50 mb-3">
          <TabsTrigger value="oscillators" className="text-sm">Oscillators</TabsTrigger>
          <TabsTrigger value="processing" className="text-sm">Filter & Effects</TabsTrigger>
        </TabsList>

        <TabsContent value="oscillators" className="mt-0">
          <div className="space-y-2.5">
            <Label className="text-white/70 text-sm uppercase tracking-wider">Oscillators</Label>
            <div className="grid grid-cols-4 gap-3">
              {/* Existing oscillators */}
              {instrument.oscillators.map((osc, i) => (
                <div key={i} className="bg-slate-700/50 rounded p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm font-medium">Oscillator {i + 1}</span>
                    {instrument.oscillators.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOscillator(i)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <Select value={osc.waveform} onValueChange={(v) => updateOscillator(i, 'waveform', v)}>
                    <SelectTrigger className="h-9 bg-slate-700 border-slate-600 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 z-[10000]">
                      {WAVEFORMS.map(w => (
                        <SelectItem key={w} value={w} className="text-white text-sm capitalize">{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <span className="text-white/40 text-xs">Timbre</span>
                    <div 
                      className="relative h-24 bg-slate-800 border border-slate-600 rounded cursor-crosshair"
                      onMouseDown={(e) => {
                        setIsDraggingTimbre(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const updateTimbre = (clientX, clientY) => {
                          const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                          const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
                          // X axis: phase (0 to 360 degrees) - affects timbre without changing pitch
                          const phase = x * 360;
                          // Y axis: detune (-50 to 50 cents) - fine pitch adjustment
                          const detune = (y - 0.5) * 100;

                          // Update both values together
                          const newOscs = [...instrument.oscillators];
                          newOscs[i] = { ...newOscs[i], phase, detune };
                          setInstrument({ ...instrument, oscillators: newOscs });
                        };

                        updateTimbre(e.clientX, e.clientY);

                        const handleMove = (e) => updateTimbre(e.clientX, e.clientY);
                        const handleUp = () => {
                          setIsDraggingTimbre(false);
                          document.removeEventListener('mousemove', handleMove);
                          document.removeEventListener('mouseup', handleUp);
                        };

                        document.addEventListener('mousemove', handleMove);
                        document.addEventListener('mouseup', handleUp);
                      }}
                    >
                      {/* Corner labels */}
                      <span className="absolute top-1 left-1 text-[9px] text-white/30">Soft</span>
                      <span className="absolute top-1 right-1 text-[9px] text-white/30">Bright</span>
                      <span className="absolute bottom-1 left-1 text-[9px] text-white/30">Warm</span>
                      <span className="absolute bottom-1 right-1 text-[9px] text-white/30">Metallic</span>

                      {/* Draggable dot */}
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
                    <Slider
                      value={[osc.gain]}
                      onValueChange={([v]) => updateOscillator(i, 'gain', v)}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">Phase</span>
                      <span className="text-white/60 text-xs">{Math.round(osc.phase || 0)}°</span>
                    </div>
                    <Slider
                      value={[osc.phase || 0]}
                      onValueChange={([v]) => updateOscillator(i, 'phase', v)}
                      min={0}
                      max={360}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
                ))}

                {/* Empty slots for remaining oscillators */}
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
                </TabsContent>

        <TabsContent value="processing" className="mt-0">
          <div className="space-y-2.5">
            <Label className="text-white/70 text-sm uppercase tracking-wider">Processing</Label>
            <div className="grid grid-cols-4 gap-3">
              {/* Filter */}
              <div className="bg-slate-700/50 rounded p-3 space-y-2.5">
                <span className="text-white/60 text-sm font-medium">Filter</span>
                <Select
                  value={instrument.filter.type}
                  onValueChange={(v) => setInstrument({ ...instrument, filter: { ...instrument.filter, type: v } })}
                >
                  <SelectTrigger className="h-9 bg-slate-700 border-slate-600 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-[10000]">
                    {['lowpass', 'highpass', 'bandpass', 'notch'].map(t => (
                      <SelectItem key={t} value={t} className="text-white text-sm capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Cutoff</span>
                    <span className="text-white/60 text-xs">{instrument.filter.frequency} Hz</span>
                  </div>
                  <Slider
                    value={[instrument.filter.frequency]}
                    onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, frequency: v } })}
                    min={100}
                    max={8000}
                    step={10}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Resonance</span>
                    <span className="text-white/60 text-xs">{instrument.filter.Q.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[instrument.filter.Q]}
                    onValueChange={([v]) => setInstrument({ ...instrument, filter: { ...instrument.filter, Q: v } })}
                    min={0.1}
                    max={20}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* LFO */}
              <div className="bg-slate-700/50 rounded p-3 space-y-2.5">
                <span className="text-white/60 text-sm font-medium">LFO</span>
                <Select
                  value={instrument.lfo?.target || 'pitch'}
                  onValueChange={(v) => setInstrument({ ...instrument, lfo: { ...(instrument.lfo || {}), target: v } })}
                >
                  <SelectTrigger className="h-9 bg-slate-700 border-slate-600 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-[10000]">
                    <SelectItem value="pitch" className="text-white text-sm">Pitch</SelectItem>
                    <SelectItem value="filter" className="text-white text-sm">Filter</SelectItem>
                    <SelectItem value="volume" className="text-white text-sm">Volume</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Rate</span>
                    <span className="text-white/60 text-xs">{(instrument.lfo?.rate || 0).toFixed(1)} Hz</span>
                  </div>
                  <Slider
                    value={[instrument.lfo?.rate || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, lfo: { ...(instrument.lfo || {}), rate: v } })}
                    min={0}
                    max={20}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Depth</span>
                    <span className="text-white/60 text-xs">{Math.round((instrument.lfo?.amount || 0) * 100)}%</span>
                  </div>
                  <Slider
                    value={[instrument.lfo?.amount || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, lfo: { ...(instrument.lfo || {}), amount: v } })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Effects */}
              <div className="bg-slate-700/50 rounded p-3 space-y-2.5">
                <span className="text-white/60 text-sm font-medium">Effects</span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Distortion</span>
                    <span className="text-white/60 text-xs">{Math.round(instrument.distortion || 0)}</span>
                  </div>
                  <Slider
                    value={[instrument.distortion || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, distortion: v })}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Bit Crush</span>
                    <span className="text-white/60 text-xs">{(instrument.bitcrush || 0).toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[instrument.bitcrush || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, bitcrush: v })}
                    min={0}
                    max={16}
                    step={0.5}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Width</span>
                    <span className="text-white/60 text-xs">{Math.round((instrument.width || 0) * 100)}%</span>
                  </div>
                  <Slider
                    value={[instrument.width || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, width: v })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Spread */}
              <div className="bg-slate-700/50 rounded p-3 space-y-2.5">
                <span className="text-white/60 text-sm font-medium">Spread</span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Unison</span>
                    <span className="text-white/60 text-xs">{Math.round(instrument.unison || 1)}</span>
                  </div>
                  <Slider
                    value={[instrument.unison || 1]}
                    onValueChange={([v]) => setInstrument({ ...instrument, unison: Math.round(v) })}
                    min={1}
                    max={7}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Detune</span>
                    <span className="text-white/60 text-xs">{Math.round(instrument.unisonDetune || 0)}</span>
                  </div>
                  <Slider
                    value={[instrument.unisonDetune || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, unisonDetune: v })}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">Stereo</span>
                    <span className="text-white/60 text-xs">{Math.round((instrument.stereoSpread || 0) * 100)}%</span>
                  </div>
                  <Slider
                    value={[instrument.stereoSpread || 0]}
                    onValueChange={([v]) => setInstrument({ ...instrument, stereoSpread: v })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}