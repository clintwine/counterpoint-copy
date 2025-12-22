import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Save, Trash2, Plus, RefreshCw, FileText, MoreVertical, Edit2 } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from 'lucide-react';
import { initAudio, getAudioContext, playNoteWithCustomInstrument, getAnalyser } from './audioEngine';

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

const DEFAULT_INSTRUMENT = {
  name: 'Custom 1',
  oscillators: [
    { waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1, phase: 0 }
  ],
  envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.3 },
  effects: [
    { type: 'filter', config: { filterType: 'lowpass', frequency: 2000, Q: 1 } }
  ],
  eq: [
    { frequency: 60, gain: 0, Q: 1, type: 'lowshelf' },
    { frequency: 250, gain: 0, Q: 1, type: 'peaking' },
    { frequency: 1000, gain: 0, Q: 1, type: 'peaking' },
    { frequency: 4000, gain: 0, Q: 1, type: 'peaking' },
    { frequency: 12000, gain: 0, Q: 1, type: 'highshelf' }
  ]
};

// Built-in instrument configurations for editing
const BUILTIN_INSTRUMENTS = {
  organ: {
    name: 'Organ',
    oscillators: [
      { waveform: 'sine', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.8, harmonic: 2 },
      { waveform: 'sine', detune: -2, gain: 0.6, harmonic: 3 },
      { waveform: 'sine', detune: 2, gain: 0.4, harmonic: 5 }
    ],
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.3 },
    filter: { type: 'lowpass', frequency: 3000, Q: 1.2 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 0,
    bitcrush: 0
  },
  piano: {
    name: 'Piano',
    oscillators: [
      { waveform: 'triangle', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.8, harmonic: 2 },
      { waveform: 'triangle', detune: -1, gain: 0.5, harmonic: 3 },
      { waveform: 'sine', detune: 1, gain: 0.3, harmonic: 4 }
    ],
    envelope: { attack: 0.003, decay: 0.1, sustain: 0.6, release: 0.4 },
    filter: { type: 'lowpass', frequency: 4500, Q: 0.8 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 2,
    bitcrush: 0
  },
  strings: {
    name: 'Strings',
    oscillators: [
      { waveform: 'sawtooth', detune: -5, gain: 0.5, harmonic: 1 },
      { waveform: 'sawtooth', detune: 5, gain: 0.5, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.3, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.2, harmonic: 3 }
    ],
    envelope: { attack: 0.2, decay: 0.1, sustain: 0.8, release: 0.5 },
    filter: { type: 'lowpass', frequency: 3200, Q: 1.2 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 0,
    bitcrush: 0
  },
  harpsichord: {
    name: 'Harpsichord',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 1.0, harmonic: 1 },
      { waveform: 'sawtooth', detune: 0, gain: 0.7, harmonic: 2 }
    ],
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.3, release: 0.2 },
    filter: { type: 'lowpass', frequency: 4000, Q: 1.5 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 0,
    bitcrush: 0
  },
  cello: {
    name: 'Cello',
    oscillators: [
      { waveform: 'sawtooth', detune: -3, gain: 0.6, harmonic: 1 },
      { waveform: 'sawtooth', detune: 3, gain: 0.6, harmonic: 1 },
      { waveform: 'triangle', detune: 0, gain: 0.4, harmonic: 2 },
      { waveform: 'sine', detune: 0, gain: 0.25, harmonic: 3 }
    ],
    envelope: { attack: 0.15, decay: 0.1, sustain: 0.8, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1800, Q: 1.5 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 1,
    bitcrush: 0
  },
  brass: {
    name: 'Brass',
    oscillators: [
      { waveform: 'sawtooth', detune: 0, gain: 0.8, harmonic: 1 },
      { waveform: 'square', detune: -4, gain: 0.5, harmonic: 2 },
      { waveform: 'sawtooth', detune: 4, gain: 0.6, harmonic: 3 }
    ],
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.3 },
    filter: { type: 'lowpass', frequency: 3000, Q: 3 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 8,
    bitcrush: 0
  },
  choir: {
    name: 'Choir',
    oscillators: [
      { waveform: 'sawtooth', detune: -7, gain: 0.4, harmonic: 1 },
      { waveform: 'sawtooth', detune: 0, gain: 0.4, harmonic: 1 },
      { waveform: 'sawtooth', detune: 7, gain: 0.4, harmonic: 1 },
      { waveform: 'sine', detune: 0, gain: 0.3, harmonic: 2 }
    ],
    envelope: { attack: 0.25, decay: 0.1, sustain: 0.7, release: 0.4 },
    filter: { type: 'lowpass', frequency: 2200, Q: 0.7 },
    lfo: { rate: 0, amount: 0, target: 'pitch' },
    distortion: 0,
    bitcrush: 0
  }
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
  currentInstrumentConfig = null,
  presetLibrary = [],
  onNew
}) {
  const handleNew = () => {
    const nextNumber = customInstruments.length + 1;
    setInstrument({ ...DEFAULT_INSTRUMENT, name: `Custom ${nextNumber}` });
    setEditingIndex(-1);
    setEditingBuiltin(null);
    if (onNew) onNew();
  };
  const [instrument, setInstrument] = useState(() => ({ ...DEFAULT_INSTRUMENT, eq: [...DEFAULT_INSTRUMENT.eq] }));
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingBuiltin, setEditingBuiltin] = useState(null);
  const [isDraggingTimbre, setIsDraggingTimbre] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingName, setRenamingName] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load current instrument when opening editor - only run once on mount
  useEffect(() => {
    if (currentInstrumentConfig) {
      // Custom or preset with config provided
      const loadedInstrument = {
        ...DEFAULT_INSTRUMENT,
        ...currentInstrumentConfig,
        effects: currentInstrumentConfig.effects || DEFAULT_INSTRUMENT.effects,
        volume: currentInstrumentConfig.volume ?? 1
      };
      setInstrument(loadedInstrument);
      
      if (currentInstrument?.startsWith('custom_')) {
        const index = parseInt(currentInstrument.split('_')[1]);
        setEditingIndex(index);
        setEditingBuiltin(null);
      } else if (currentInstrument?.startsWith('preset_')) {
        setEditingIndex(-1);
        setEditingBuiltin(null);
      } else {
        setEditingIndex(-1);
        setEditingBuiltin(null);
      }
    } else if (currentInstrument?.startsWith('preset_')) {
      // Load preset instrument
      const index = parseInt(currentInstrument.split('_')[1]);
      const presetToLoad = presetLibrary[index] || PRESET_LIBRARY[index];
      if (presetToLoad) {
        const loadedInstrument = {
          ...DEFAULT_INSTRUMENT,
          ...presetToLoad,
          effects: presetToLoad.effects || [{ type: 'filter', config: { filterType: presetToLoad.filter?.type || 'lowpass', frequency: presetToLoad.filter?.frequency || 2000, Q: presetToLoad.filter?.Q || 1 } }]
        };
        setInstrument(loadedInstrument);
      }
      setEditingIndex(-1);
      setEditingBuiltin(null);
    } else if (currentInstrument && BUILTIN_INSTRUMENTS[currentInstrument]) {
      // Load built-in instrument for editing
      const builtinConfig = BUILTIN_INSTRUMENTS[currentInstrument];
      const loadedInstrument = {
        ...DEFAULT_INSTRUMENT,
        ...builtinConfig,
        effects: builtinConfig.effects || [{ type: 'filter', config: { filterType: builtinConfig.filter?.type || 'lowpass', frequency: builtinConfig.filter?.frequency || 2000, Q: builtinConfig.filter?.Q || 1 } }]
      };
      setInstrument(loadedInstrument);
      setEditingIndex(-1);
      setEditingBuiltin(currentInstrument);
    } else {
      // No instrument - create new
      const nextNumber = customInstruments.length + 1;
      setInstrument({ ...DEFAULT_INSTRUMENT, name: `Custom ${nextNumber}` });
      setEditingIndex(-1);
      setEditingBuiltin(null);
    }
  }, []);
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
    const { attack, decay, sustain, release } = instrument.envelope;
    
    // Calculate envelope phases in sample space
    const totalTime = attack + decay + 0.3 + release; // 0.3s for sustain display
    const attackSamples = (attack / totalTime) * samples;
    const decaySamples = (decay / totalTime) * samples;
    const sustainSamples = (0.3 / totalTime) * samples;
    const releaseSamples = (release / totalTime) * samples;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 4;
      let y = 0;

      instrument.oscillators.forEach(osc => {
        const detuneRatio = Math.pow(2, (osc.detune || 0) / 1200);
        const phase = t * detuneRatio;
        let wave = 0;

        switch (osc.waveform || 'sine') {
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
        y += wave * (osc.gain ?? 0.5);
        });

        y = y / Math.max(1, instrument.oscillators.length);
      
      // Apply envelope shaping
      let envelope = 1;
      if (i < attackSamples) {
        // Attack phase
        envelope = i / attackSamples;
      } else if (i < attackSamples + decaySamples) {
        // Decay phase
        const decayProgress = (i - attackSamples) / decaySamples;
        envelope = 1 - (1 - sustain) * decayProgress;
      } else if (i < attackSamples + decaySamples + sustainSamples) {
        // Sustain phase
        envelope = sustain;
      } else {
        // Release phase
        const releaseProgress = (i - attackSamples - decaySamples - sustainSamples) / releaseSamples;
        envelope = sustain * (1 - releaseProgress);
      }
      
      y *= envelope;
      
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

  const playPreviewForInstrument = useCallback(async (inst, onEnd) => {
    initAudio();
    const audioContext = getAudioContext();
    if (!audioContext) return;

    // For sampled instruments, load and play the audio
    if (inst.audioSampleUrl) {
      try {
        // Convert data URL back to AudioBuffer
        const response = await fetch(inst.audioSampleUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create a temporary instrument with the decoded buffer
        const tempInst = { ...inst, audioSample: audioBuffer };
        playNoteWithCustomInstrument('C4', 0.8, 0.5, tempInst);
        
        const analyser = getAnalyser();
        if (analyser) {
          analyserRef.current = analyser;
          drawWaveform();
        }
        setTimeout(() => {
          if (onEnd) onEnd();
        }, 1000);
        return;
      } catch (error) {
        console.error('Failed to load audio sample:', error);
      }
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const masterGain = audioContext.createGain();
    masterGain.gain.value = (inst.volume ?? 1) * 0.3;

    // Get filter config from effects array or fall back to old filter property
    const filterEffect = inst.effects?.find(e => e.type === 'filter');
    const filterConfig = filterEffect?.config || inst.filter || { filterType: 'lowpass', frequency: 2000, Q: 1 };
    
    const filter = audioContext.createBiquadFilter();
    filter.type = filterConfig.filterType || filterConfig.type || 'lowpass';
    filter.frequency.value = filterConfig.frequency || 2000;
    filter.Q.value = filterConfig.Q || 1;

    // Create EQ chain if present
    const eqNodes = [];
    if (inst.eq && inst.eq.length > 0) {
      inst.eq.forEach(band => {
        const eqFilter = audioContext.createBiquadFilter();
        eqFilter.type = band.type || 'peaking';
        eqFilter.frequency.value = band.frequency || 1000;
        eqFilter.Q.value = band.Q || 1;
        eqFilter.gain.value = band.gain || 0;
        eqNodes.push(eqFilter);
      });
    }

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

    // Chain effects: filter -> EQ -> distortion -> bitcrush -> master
    let outputNode = filter;

    // Apply EQ after filter
    if (eqNodes.length > 0) {
      eqNodes.forEach(eqNode => {
        outputNode.connect(eqNode);
        outputNode = eqNode;
      });
    }

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
    // Ensure oscillator always has all required properties
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
    const newOsc = { waveform: 'sine', detune: 0, gain: 0.5, harmonic: 1, phase: 0 };
    setInstrument({
      ...instrument,
      oscillators: [...instrument.oscillators, newOsc]
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
      effects: instrument.effects || DEFAULT_INSTRUMENT.effects,
      volume: instrument.volume ?? 1
    };
    
    if (editingIndex >= 0) {
      // Updating existing custom instrument
      onSaveInstrument(instrumentToSave, editingIndex);
    } else {
      // Creating new instrument - set editing index to the new position
      const newIndex = customInstruments.length;
      onSaveInstrument(instrumentToSave, -1);
      setEditingIndex(newIndex);
      setEditingBuiltin(null);
    }
  };

  const handleRevert = () => {
    if (editingBuiltin && BUILTIN_INSTRUMENTS[editingBuiltin]) {
      const builtinConfig = BUILTIN_INSTRUMENTS[editingBuiltin];
      const loadedInstrument = {
        ...DEFAULT_INSTRUMENT,
        ...builtinConfig,
        effects: builtinConfig.effects || [{ type: 'filter', config: { filterType: builtinConfig.filter?.type || 'lowpass', frequency: builtinConfig.filter?.frequency || 2000, Q: builtinConfig.filter?.Q || 1 } }]
      };
      setInstrument(loadedInstrument);
    }
  };

  const recordingIntervalRef = useRef(null);
  const audioSampleRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processRecording(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

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

      // Stop recording after 2 seconds
      setTimeout(() => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        setIsRecording(false);
        mediaRecorder.stop();
      }, 2000);
    } catch (error) {
      console.error('Failed to access microphone:', error);
      alert('Could not access microphone. Please grant permission and try again.');
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert AudioBuffer to data URL for storage
      const wavBlob = await audioBufferToWav(audioBuffer);
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(wavBlob);
      });
      
      // Create instrument with audio sample data URL
      const voiceInstrument = {
        name: 'My Voice',
        audioSampleUrl: dataUrl, // Store as data URL for persistence
        oscillators: [
          { waveform: 'sawtooth', detune: 0, gain: 0.6, harmonic: 1, phase: 0 },
          { waveform: 'sine', detune: 7, gain: 0.4, harmonic: 2, phase: 0 }
        ],
        envelope: { attack: 0.08, decay: 0.15, sustain: 0.7, release: 0.35 },
        filter: { type: 'lowpass', frequency: 2800, Q: 0.8 },
        lfo: { rate: 0, amount: 0, target: 'pitch' },
        distortion: 0,
        bitcrush: 0,
        volume: 1
      };
      
      setInstrument(voiceInstrument);
      setEditingIndex(-1);
      
      console.log('Voice recorded successfully:', audioBuffer.duration + 's');
    } catch (error) {
      console.error('Failed to process recording:', error);
      alert('Failed to process the recording. Please try again.');
    }
  };

  // Helper function to convert AudioBuffer to WAV blob
  const audioBufferToWav = (buffer) => {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Audio data
    const channelData = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };



  const loadInstrument = (inst, index) => {
    // Load instrument with all required fields, preserving the name
    const loadedInstrument = {
      ...DEFAULT_INSTRUMENT,
      ...inst,
      name: inst.name,
      effects: inst.effects || (inst.filter ? [{ type: 'filter', config: { filterType: inst.filter.type, frequency: inst.filter.frequency, Q: inst.filter.Q } }] : DEFAULT_INSTRUMENT.effects),
      volume: inst.volume ?? 1
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
    if (livePreview && !isDraggingTimbre && !isPlaying) {
      // Play preview on each change with animation (but not while dragging or already playing)
      const timeoutId = setTimeout(() => {
        setIsPlaying(true);
        playPreviewForInstrument(instrument, () => {
          setIsPlaying(false);
        });
        drawWaveform();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [instrument.envelope.attack, instrument.envelope.decay, instrument.envelope.sustain, instrument.envelope.release, instrument.effects, livePreview, isDraggingTimbre, isPlaying]);

  return (
    <div className="space-y-4">
      {/* Top Row: Buttons + Library */}
      <div className="flex items-end gap-3">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {editingIndex >= 0 ? 'Update' : 'Save'}
          </Button>
          {editingBuiltin && (
            <Button
              size="sm"
              onClick={handleRevert}
              className="h-9 px-3 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          )}
          {editingIndex >= 0 && (
            <Button
              size="sm"
              onClick={() => {
                if (confirm(`Delete "${instrument.name}"?`)) {
                  onDeleteInstrument(editingIndex);
                  setInstrument({ ...DEFAULT_INSTRUMENT });
                  setEditingIndex(-1);
                  setEditingBuiltin(null);
                }
              }}
              className="h-9 px-3 bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Instrument Library Dropdown + Rename */}
        <div className="flex-1 space-y-1.5">
          <Label className="text-white/70 text-xs uppercase tracking-wider">INSTRUMENT</Label>
          <div className="flex gap-2">
            <Popover open={libraryOpen} onOpenChange={setLibraryOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="flex-1 justify-between bg-slate-700 border-slate-600 text-white text-sm hover:bg-slate-600 h-9"
              >
                <span className="truncate">
                  {editingBuiltin ? BUILTIN_INSTRUMENTS[editingBuiltin]?.name : 
                   editingIndex >= 0 ? customInstruments[editingIndex]?.name :
                   'Browse...'}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0 bg-slate-800 border-slate-700 z-[9999]" align="start">
              <Command className="bg-slate-800">
                <CommandInput placeholder="Search instruments..." className="h-9 text-sm text-white [&_svg]:text-white" />
                <CommandList 
                  ref={(el) => {
                    if (el) {
                      // Force scroll by manually handling wheel events
                      const wheelHandler = (e) => {
                        e.stopPropagation();
                        el.scrollTop += e.deltaY;
                      };
                      el.addEventListener('wheel', wheelHandler, { passive: true });
                      
                      return () => {
                        el.removeEventListener('wheel', wheelHandler);
                      };
                    }
                  }}
                  style={{ 
                    maxHeight: '320px', 
                    overflowY: 'auto',
                    overscrollBehavior: 'contain'
                  }}
                >
                  <CommandEmpty className="text-white/50 text-sm py-4 text-center">
                    No instrument found.
                  </CommandEmpty>
                  
                  {/* Built-in Instruments */}
                  <CommandGroup heading="Built-in Instruments">
                    {Object.entries(BUILTIN_INSTRUMENTS).map(([key, config]) => (
                      <CommandItem
                        key={`builtin-${key}`}
                        value={config.name}
                        onSelect={() => {
                          const loadedInstrument = {
                            ...DEFAULT_INSTRUMENT,
                            ...config,
                            effects: config.effects || [{ type: 'filter', config: { filterType: config.filter?.type || 'lowpass', frequency: config.filter?.frequency || 2000, Q: config.filter?.Q || 1 } }]
                          };
                          setInstrument(loadedInstrument);
                          setEditingIndex(-1);
                          setEditingBuiltin(key);
                          setLibraryOpen(false);
                        }}
                        className="text-white text-sm cursor-pointer flex items-center justify-between group"
                      >
                        <span>{config.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const builtinToPreview = { ...DEFAULT_INSTRUMENT, ...config };
                            playPresetPreview(builtinToPreview, `builtin-${key}`);
                          }}
                          className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700"
                          title="Preview"
                        >
                          ▶
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  
                  <CommandSeparator />
                  
                  {/* Presets */}
                  <CommandGroup heading="Presets">
                    {(presetLibrary.length > 0 ? presetLibrary : PRESET_LIBRARY).map((preset, i) => (
                      <CommandItem
                        key={`preset-${i}`}
                        value={preset.name}
                        onSelect={() => {
                          setInstrument({ ...preset });
                          setEditingIndex(-1);
                          setEditingBuiltin(null);
                          const instrumentValue = `preset_${i}`;
                          if (onInstrumentChange) {
                            onInstrumentChange(instrumentValue);
                          }
                          if (onVoiceInstrumentChange) {
                            onVoiceInstrumentChange(0, instrumentValue);
                          }
                          setLibraryOpen(false);
                        }}
                        className="text-white text-sm cursor-pointer flex items-center justify-between group"
                      >
                        <span>{preset.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playPresetPreview(preset, `lib-${i}`);
                          }}
                          className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700"
                          title="Preview"
                        >
                          ▶
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  
                  {/* Custom Instruments */}
                  {customInstruments.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Custom">
                        {customInstruments.map((inst, i) => (
                          <CommandItem
                            key={`custom-${i}`}
                            value={inst.name}
                            onSelect={() => {
                              loadInstrument(inst, i);
                              setLibraryOpen(false);
                            }}
                            className="text-white text-sm cursor-pointer flex items-center justify-between group"
                          >
                            <span>{inst.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playPresetPreview(inst, `custom-${i}`);
                              }}
                              className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700"
                              title="Preview"
                            >
                              ▶
                            </button>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRenamingName(instrument.name);
                setRenameDialogOpen(true);
              }}
              className="h-9 w-9 p-0 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-[#2D2D2D] border-[#3A3A3A] [&>button]:text-white/70 [&>button]:hover:text-white z-[10001]">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Instrument</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            setInstrument({ ...instrument, name: renamingName });
            setRenameDialogOpen(false);
          }} className="space-y-4">
            <Input
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Instrument name..."
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Rename
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Second Row: Waveform Preview + ADSR Controls */}
      <div className="flex gap-3">
        {/* Waveform Preview */}
        <div className="flex-1 space-y-1.5">
          <Label className="text-white/70 text-xs uppercase tracking-wider">Waveform</Label>
          <div className="relative">
           <canvas
             ref={canvasRef}
             className="w-full h-[100px] rounded border border-slate-600"
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

        {/* ADSR Envelope Controls */}
        <div className="w-80 flex-shrink-0 space-y-1.5">
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
          <div className="flex gap-3 justify-between">
            {['attack', 'decay', 'sustain', 'release'].map(param => (
              <div key={param} className="text-center">
                <div
                  className="w-14 h-14 rounded-full bg-slate-700 border border-slate-600 relative flex items-center justify-center cursor-pointer"
                  style={{
                    background: `conic-gradient(from 225deg, #10b981 ${instrument.envelope[param] * (param === 'sustain' ? 270 : 135)}deg, #334155 0deg)`
                  }}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center">
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
                <span className="text-[10px] text-white/50 uppercase mt-1 block">{param.charAt(0)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 pt-2">
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
      <Tabs 
        defaultValue="oscillators" 
        className="w-full"
        onValueChange={(value) => {
          console.log('[WaveEditor] Tab changed to:', value);
        }}
      >
        <TabsList className="bg-slate-700/50 mb-3" onClick={(e) => e.stopPropagation()}>
          <TabsTrigger 
            value="oscillators" 
            className="text-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            Oscillators
          </TabsTrigger>
          <TabsTrigger 
            value="processing" 
            className="text-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            Filter & Effects
          </TabsTrigger>
          <TabsTrigger 
            value="eq" 
            className="text-sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            EQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oscillators" className="mt-0 min-h-[280px]">
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
                      className="relative h-24 bg-slate-800 border border-slate-600 rounded cursor-crosshair select-none"
                      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
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

        <TabsContent value="processing" className="mt-0 min-h-[280px]">
          <div className="space-y-2.5">
            <Label className="text-white/70 text-sm uppercase tracking-wider">Effects Chain</Label>
            <div className="grid grid-cols-4 gap-3">
              {/* Existing effects */}
              {(instrument.effects || []).map((effect, i) => (
                <div key={i} className="bg-slate-700/50 rounded p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm font-medium capitalize">{effect.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newEffects = instrument.effects.filter((_, idx) => idx !== i);
                        setInstrument({ ...instrument, effects: newEffects });
                      }}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Filter effect */}
                  {effect.type === 'filter' && (
                    <>
                      <Select
                        value={effect.config.filterType}
                        onValueChange={(v) => {
                          const newEffects = [...instrument.effects];
                          newEffects[i] = { ...effect, config: { ...effect.config, filterType: v } };
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
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
                          <span className="text-white/60 text-xs">{effect.config.frequency} Hz</span>
                        </div>
                        <Slider
                          value={[effect.config.frequency]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, frequency: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={100}
                          max={8000}
                          step={10}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Resonance</span>
                          <span className="text-white/60 text-xs">{effect.config.Q.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[effect.config.Q]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, Q: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0.1}
                          max={20}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Distortion effect */}
                  {effect.type === 'distortion' && (
                    <>
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Amount</span>
                          <span className="text-white/60 text-xs">{Math.round(effect.config.amount || 0)}</span>
                        </div>
                        <Slider
                          value={[effect.config.amount || 0]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, amount: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Reverb effect */}
                  {effect.type === 'reverb' && (
                    <>
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Size</span>
                          <span className="text-white/60 text-xs">{Math.round((effect.config.size || 0.5) * 100)}%</span>
                        </div>
                        <Slider
                          value={[effect.config.size || 0.5]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, size: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Mix</span>
                          <span className="text-white/60 text-xs">{Math.round((effect.config.mix || 0.3) * 100)}%</span>
                        </div>
                        <Slider
                          value={[effect.config.mix || 0.3]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, mix: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Delay effect */}
                  {effect.type === 'delay' && (
                    <>
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Time</span>
                          <span className="text-white/60 text-xs">{(effect.config.time || 0.25).toFixed(2)}s</span>
                        </div>
                        <Slider
                          value={[effect.config.time || 0.25]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, time: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0.01}
                          max={2}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Feedback</span>
                          <span className="text-white/60 text-xs">{Math.round((effect.config.feedback || 0.3) * 100)}%</span>
                        </div>
                        <Slider
                          value={[effect.config.feedback || 0.3]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, feedback: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0}
                          max={0.9}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Chorus effect */}
                  {effect.type === 'chorus' && (
                    <>
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Rate</span>
                          <span className="text-white/60 text-xs">{(effect.config.rate || 1.5).toFixed(1)} Hz</span>
                        </div>
                        <Slider
                          value={[effect.config.rate || 1.5]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, rate: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0.1}
                          max={10}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Depth</span>
                          <span className="text-white/60 text-xs">{Math.round((effect.config.depth || 0.5) * 100)}%</span>
                        </div>
                        <Slider
                          value={[effect.config.depth || 0.5]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, depth: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Bitcrusher effect */}
                  {effect.type === 'bitcrusher' && (
                    <>
                      <div className="space-y-1 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/40 text-xs">Bit Depth</span>
                          <span className="text-white/60 text-xs">{(effect.config.bits || 8).toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[effect.config.bits || 8]}
                          onValueChange={([v]) => {
                            const newEffects = [...instrument.effects];
                            newEffects[i] = { ...effect, config: { ...effect.config, bits: v } };
                            setInstrument({ ...instrument, effects: newEffects });
                          }}
                          min={1}
                          max={16}
                          step={0.5}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add Effect placeholders */}
              {[...Array(Math.max(0, 4 - (instrument.effects?.length || 0)))].map((_, i) => (
                <Popover key={`add-${i}`}>
                  <PopoverTrigger asChild>
                    <button className="bg-slate-700/30 border-2 border-dashed border-slate-600 rounded p-3 flex items-center justify-center min-h-[200px] hover:border-amber-500/50 hover:bg-slate-700/40 transition-colors group">
                      <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-amber-400/70">
                        <Plus className="w-6 h-6" />
                        <span className="text-xs">Add Effect</span>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2 bg-slate-800 border-slate-700 z-[10000]">
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'filter', config: { filterType: 'lowpass', frequency: 2000, Q: 1 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Filter
                      </button>
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'distortion', config: { amount: 50 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Distortion
                      </button>
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'reverb', config: { size: 0.5, mix: 0.3 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Reverb
                      </button>
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'delay', config: { time: 0.25, feedback: 0.3 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Delay
                      </button>
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'chorus', config: { rate: 1.5, depth: 0.5 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Chorus
                      </button>
                      <button
                        onClick={() => {
                          const newEffects = [...(instrument.effects || []), { type: 'bitcrusher', config: { bits: 8 } }];
                          setInstrument({ ...instrument, effects: newEffects });
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                      >
                        Bitcrusher
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="eq" className="mt-0 min-h-[280px]">
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              {/* EQ Frequency Display */}
              <div className="relative h-48 bg-slate-900 rounded border border-slate-600 mb-4 flex">
                {/* Y-axis gain labels */}
                <div className="absolute top-0 bottom-0 flex flex-col justify-between py-1 text-[9px] text-white/50 pointer-events-none z-10" style={{ left: '50px' }}>
                  <span>+15</span>
                  <span>+5</span>
                  <span>0</span>
                  <span>-5</span>
                  <span>-15</span>
                </div>
                <svg className="w-full h-full" viewBox="0 0 400 192">
                  {/* Grid lines */}
                  {[0, 48, 96, 144, 192].map((y) => (
                    <line key={`h-${y}`} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  ))}
                  {[0, 80, 160, 240, 320, 400].map((x) => (
                    <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="192" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  ))}

                  {/* Frequency labels */}
                  <text x="10" y="185" fill="rgba(255,255,255,0.5)" fontSize="10">20Hz</text>
                  <text x="80" y="185" fill="rgba(255,255,255,0.5)" fontSize="10">200Hz</text>
                  <text x="160" y="185" fill="rgba(255,255,255,0.5)" fontSize="10">2kHz</text>
                  <text x="240" y="185" fill="rgba(255,255,255,0.5)" fontSize="10">5kHz</text>
                  <text x="350" y="185" fill="rgba(255,255,255,0.5)" fontSize="10">20kHz</text>
                  
                  {/* EQ Curve */}
                  <path
                    d={(() => {
                      const eqBands = instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq;
                      
                      const freqToX = (freq) => {
                        const logMin = Math.log10(20);
                        const logMax = Math.log10(20000);
                        const logFreq = Math.log10(freq);
                        return ((logFreq - logMin) / (logMax - logMin)) * 400;
                      };
                      
                      const gainToY = (gain) => 96 - (gain * 3.2); // -15dB to +15dB range
                      
                      let path = 'M 0,96';
                      for (let x = 0; x <= 400; x += 2) {
                        const freq = Math.pow(10, Math.log10(20) + (x / 400) * (Math.log10(20000) - Math.log10(20)));
                        let totalGain = 0;
                        
                        eqBands.forEach(band => {
                          const Q = band.Q || 1;
                          const octaves = Math.log2(freq / band.frequency);
                          const bandwidth = 1 / Q;
                          const response = 1 / (1 + Math.pow(octaves / (bandwidth / 2), 2));
                          totalGain += band.gain * response;
                        });
                        
                        const y = gainToY(totalGain);
                        path += ` L ${x},${y}`;
                      }
                      
                      return path;
                    })()}
                    fill="none"
                    stroke="#E8B885"
                    strokeWidth="2"
                  />
                  
                  {/* EQ Band Markers */}
                  {(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq).map((band, i) => {
                    const freqToX = (freq) => {
                      const logMin = Math.log10(20);
                      const logMax = Math.log10(20000);
                      const logFreq = Math.log10(freq);
                      return ((logFreq - logMin) / (logMax - logMin)) * 400;
                    };
                    const gainToY = (gain) => 96 - (gain * 3.2);
                    const xToFreq = (x) => {
                      const logMin = Math.log10(20);
                      const logMax = Math.log10(20000);
                      const logFreq = logMin + (x / 400) * (logMax - logMin);
                      return Math.round(Math.pow(10, logFreq));
                    };
                    const yToGain = (y) => (96 - y) / 3.2;
                    
                    return (
                      <circle
                        key={i}
                        cx={freqToX(band.frequency)}
                        cy={gainToY(band.gain)}
                        r="6"
                        fill="#E8B885"
                        stroke="#1E293B"
                        strokeWidth="2"
                        className="cursor-move"
                        style={{ userSelect: 'none' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const svg = e.currentTarget.ownerSVGElement;
                          
                          const handleMove = (moveEvent) => {
                            const pt = svg.createSVGPoint();
                            pt.x = moveEvent.clientX;
                            pt.y = moveEvent.clientY;
                            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                            
                            const x = Math.max(0, Math.min(400, svgP.x));
                            const y = Math.max(0, Math.min(192, svgP.y));
                            
                            const newFreq = xToFreq(x);
                            const newGain = Math.max(-15, Math.min(15, yToGain(y)));
                            
                            const newEq = [...(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq)];
                            newEq[i] = { ...newEq[i], frequency: newFreq, gain: parseFloat(newGain.toFixed(1)) };
                            setInstrument({ ...instrument, eq: newEq });
                          };
                          
                          const handleUp = () => {
                            document.removeEventListener('mousemove', handleMove);
                            document.removeEventListener('mouseup', handleUp);
                          };
                          
                          document.addEventListener('mousemove', handleMove);
                          document.addEventListener('mouseup', handleUp);
                        }}
                      />
                    );
                  })}
                </svg>
                </div>
              
              {/* EQ Band Controls */}
              <div className="grid grid-cols-5 gap-3">
                {(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq).map((band, i) => (
                  <div key={i} className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                    <div className="text-center">
                      <span className="text-white/60 text-xs font-medium">
                        {i === 0 ? 'Low' : i === 4 ? 'High' : `Band ${i}`}
                      </span>
                    </div>
                    
                    {/* Type selector for middle bands */}
                    {i > 0 && i < 4 && (
                      <Select
                        value={band.type || 'peaking'}
                        onValueChange={(v) => {
                          const newEq = [...(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq)];
                          newEq[i] = { ...newEq[i], type: v };
                          setInstrument({ ...instrument, eq: newEq });
                        }}
                      >
                        <SelectTrigger className="h-7 bg-slate-700 border-slate-600 text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 z-[10000]">
                          <SelectItem value="peaking" className="text-white text-xs">Peak</SelectItem>
                          <SelectItem value="notch" className="text-white text-xs">Notch</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Knobs in 2-column grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Frequency knob */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-12 h-12 rounded-full bg-slate-700 border border-slate-600 relative flex items-center justify-center cursor-pointer mb-1 select-none"
                          style={{
                            background: `conic-gradient(from 225deg, #3b82f6 ${((Math.log10(band.frequency) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * 270}deg, #334155 0deg)`,
                            userSelect: 'none',
                            WebkitUserSelect: 'none'
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center pointer-events-none">
                            <span className="text-[8px] text-white/70 pointer-events-none">{band.frequency > 1000 ? `${(band.frequency/1000).toFixed(1)}k` : band.frequency}</span>
                          </div>
                          <input
                            type="range"
                            min={Math.log10(20)}
                            max={Math.log10(20000)}
                            step="0.01"
                            value={Math.log10(band.frequency)}
                            onChange={(e) => {
                              const newEq = [...(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq)];
                              newEq[i] = { ...newEq[i], frequency: Math.round(Math.pow(10, parseFloat(e.target.value))) };
                              setInstrument({ ...instrument, eq: newEq });
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <span className="text-[9px] text-white/40 uppercase">Freq</span>
                      </div>
                      
                      {/* Q knob (only for middle bands) */}
                      {i > 0 && i < 4 && (
                        <div className="flex flex-col items-center">
                          <div
                            className="w-12 h-12 rounded-full bg-slate-700 border border-slate-600 relative flex items-center justify-center cursor-pointer mb-1 select-none"
                            style={{
                              background: `conic-gradient(from 225deg, #f59e0b ${(band.Q / 10) * 270}deg, #334155 0deg)`,
                              userSelect: 'none',
                              WebkitUserSelect: 'none'
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center pointer-events-none">
                              <span className="text-[8px] text-white/70 pointer-events-none">{band.Q.toFixed(1)}</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="10"
                              step="0.1"
                              value={band.Q}
                              onChange={(e) => {
                                const newEq = [...(instrument.eq?.length ? instrument.eq : DEFAULT_INSTRUMENT.eq)];
                                newEq[i] = { ...newEq[i], Q: parseFloat(e.target.value) };
                                setInstrument({ ...instrument, eq: newEq });
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          <span className="text-[9px] text-white/40 uppercase">Q</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* EQ Presets */}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setInstrument({
                      ...instrument,
                      eq: [
                        { frequency: 60, gain: 0, Q: 1, type: 'lowshelf' },
                        { frequency: 250, gain: 0, Q: 1, type: 'peaking' },
                        { frequency: 1000, gain: 0, Q: 1, type: 'peaking' },
                        { frequency: 4000, gain: 0, Q: 1, type: 'peaking' },
                        { frequency: 12000, gain: 0, Q: 1, type: 'highshelf' }
                      ]
                    });
                  }}
                  className="text-xs h-7 bg-slate-700 text-white border border-slate-600 hover:bg-slate-600"
                >
                  Flat
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setInstrument({
                      ...instrument,
                      eq: [
                        { frequency: 60, gain: 4, Q: 1, type: 'lowshelf' },
                        { frequency: 250, gain: -2, Q: 1.5, type: 'peaking' },
                        { frequency: 1000, gain: 1, Q: 1, type: 'peaking' },
                        { frequency: 4000, gain: 3, Q: 1.5, type: 'peaking' },
                        { frequency: 12000, gain: 2, Q: 1, type: 'highshelf' }
                      ]
                    });
                  }}
                  className="text-xs h-7 bg-slate-700 text-white border border-slate-600 hover:bg-slate-600"
                >
                  Bright
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setInstrument({
                      ...instrument,
                      eq: [
                        { frequency: 60, gain: 6, Q: 1, type: 'lowshelf' },
                        { frequency: 250, gain: 2, Q: 1, type: 'peaking' },
                        { frequency: 1000, gain: -1, Q: 1, type: 'peaking' },
                        { frequency: 4000, gain: -2, Q: 1, type: 'peaking' },
                        { frequency: 12000, gain: -3, Q: 1, type: 'highshelf' }
                      ]
                    });
                  }}
                  className="text-xs h-7 bg-slate-700 text-white border border-slate-600 hover:bg-slate-600"
                >
                  Warm
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setInstrument({
                      ...instrument,
                      eq: [
                        { frequency: 60, gain: -3, Q: 1, type: 'lowshelf' },
                        { frequency: 250, gain: -2, Q: 1.5, type: 'peaking' },
                        { frequency: 1000, gain: 4, Q: 2, type: 'peaking' },
                        { frequency: 4000, gain: 2, Q: 1.5, type: 'peaking' },
                        { frequency: 12000, gain: -2, Q: 1, type: 'highshelf' }
                      ]
                    });
                  }}
                  className="text-xs h-7 bg-slate-700 text-white border border-slate-600 hover:bg-slate-600"
                >
                  Vocal
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}