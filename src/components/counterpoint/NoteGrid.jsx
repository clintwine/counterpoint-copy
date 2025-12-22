import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MousePointer2, Square, Trash2, Copy, ClipboardPaste, Undo, Redo, Pencil, FileAudio, ZoomIn, ZoomOut, Guitar, ChevronDown, Keyboard, Grid3x3, MoreVertical, FileText, FolderOpen, Save, Download, Sparkles, RefreshCw, Music, ExternalLink, Volume2, Check, FilePlus, Menu } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { initAudio, playNote, getAnalyser } from './audioEngine';
import ScoreMinimap from './ScoreMinimap';


// Full 88-key piano range: A0 to C8
const NOTE_NAMES_CHROMATIC = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
const OCTAVES = [8, 7, 6, 5, 4, 3, 2, 1, 0];

// Pre-generate all 88 pitches (static)
const ALL_PITCHES = (() => {
  const p = ['C8'];
  for (let octave = 7; octave >= 1; octave--) {
    NOTE_NAMES_CHROMATIC.forEach(note => p.push(`${note}${octave}`));
  }
  p.push('B0', 'A#0', 'A0');
  return p;
})();

const TIME_SIGNATURES = [
  { value: '4/4', label: '4/4', beatsPerMeasure: 16 },
  { value: '3/4', label: '3/4', beatsPerMeasure: 12 },
  { value: '2/4', label: '2/4', beatsPerMeasure: 8 },
  { value: '6/8', label: '6/8', beatsPerMeasure: 12 },
  { value: '2/2', label: '2/2', beatsPerMeasure: 8 },
];

const NOTE_COLORS = {
  0: '#D4AF37', // Voice 1 - Logic Pro Gold
  1: '#5F9EA0', // Voice 2 - Logic Pro Teal
  2: '#9370DB', // Voice 3 - Logic Pro Purple
  3: '#CD853F', // Voice 4 - Logic Pro Bronze
};

// Velocity to color gradient: blue → green → yellow → red (0-125 scale)
const getVelocityColor = (velocity) => {
  const v = Math.max(0, Math.min(1, velocity)); // Clamp between 0 and 1 (0-125 internally)
  
  if (v < 0.4) {
    // Blue to Green
    const t = v / 0.4;
    const r = Math.round(0 + t * 0);
    const g = Math.round(100 + t * 155);
    const b = Math.round(255 - t * 55);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (v < 0.7) {
    // Green to Yellow
    const t = (v - 0.4) / 0.3;
    const r = Math.round(0 + t * 255);
    const g = Math.round(255);
    const b = Math.round(200 - t * 200);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red - reaches pure red at v=1.0 (velocity 125)
    const t = (v - 0.7) / 0.3;
    const r = Math.round(255);
    const g = Math.round(255 - t * 255);
    const b = Math.round(0);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const BASE_CELL_WIDTH = 48;
const BASE_CELL_HEIGHT = 28;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const MIN_DURATION = 0.125; // Eighth of a beat (128th note)
const DEFAULT_DURATION = 1; // 1 beat (16th note by default)

const NOTE_DURATIONS = [
  { value: 0.125, label: '128th', beats: '1/8' },
  { value: 0.25, label: '64th', beats: '1/4' },
  { value: 0.5, label: '32nd', beats: '1/2' },
  { value: 1, label: '16th', beats: '1' },
  { value: 2, label: '8th', beats: '2' },
  { value: 3, label: '8th Trip', beats: '2.67' },
  { value: 4, label: '1/4', beats: '4' },
  { value: 6, label: '1/4 Trip', beats: '5.33' },
  { value: 8, label: '1/2', beats: '8' },
  { value: 12, label: '1/2 Trip', beats: '10.67' },
  { value: 16, label: 'Whole', beats: '16' },
];

const DEFAULT_INSTRUMENTS = [
  { value: 'organ', label: 'Organ' },
  { value: 'piano', label: 'Piano' },
  { value: 'harpsichord', label: 'Harpsichord' },
  { value: 'strings', label: 'Strings' },
  { value: 'cello', label: 'Cello' },
  { value: 'harp', label: 'Harp' },
  { value: 'flute', label: 'Flute' },
  { value: 'clarinet', label: 'Clarinet' },
  { value: 'oboe', label: 'Oboe' },
  { value: 'saxophone', label: 'Saxophone' },
  { value: 'trumpet', label: 'Trumpet' },
  { value: 'brass', label: 'Brass' },
  { value: 'choir', label: 'Choir' },
  { value: 'pad', label: 'Pad' },
  { value: 'bells', label: 'Bells' },
  { value: 'celeste', label: 'Celeste' },
  { value: 'vibraphone', label: 'Vibraphone' },
  { value: 'marimba', label: 'Marimba' },
  { value: 'pluck', label: 'Pluck' },
  { value: 'bass', label: 'Bass' },
  { value: 'clean', label: 'Clean' },
  { value: 'electric', label: 'Electric' },
  { value: 'distortion', label: 'Distortion' },
  { value: 'synth', label: 'Synth' },
];

const PRESET_LIBRARY = [
  { value: 'preset_0', label: 'Warm Pad' },
  { value: 'preset_1', label: 'Bright Lead' },
  { value: 'preset_2', label: 'Sub Bass' },
  { value: 'preset_3', label: 'Pluck' },
  { value: 'preset_4', label: 'Bell' },
  { value: 'preset_5', label: 'Choir' },
  { value: 'preset_6', label: 'Reese Bass' },
  { value: 'preset_7', label: 'Flutey' },
];



function InstrumentSelect({ value, onChange, instruments, onCreateNew }) {
  const [open, setOpen] = React.useState(false);
  const selected = instruments.find(i => i.value === value);
  
  const handlePreview = (instrumentValue, e) => {
    e.stopPropagation();
    initAudio();
    playNote('C4', 0.5, 0.7, 0, instrumentValue);
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-40 h-8 justify-between bg-slate-700 border-slate-600 text-white text-xs hover:bg-slate-600"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Guitar className="w-4 h-4 text-white/60 flex-shrink-0" />
            <span className="truncate">{selected?.label || 'Select...'}</span>
          </div>
          <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
        <PopoverContent className="w-52 p-0 bg-slate-800 border-slate-700">
          <Command className="bg-slate-800">
            <CommandInput placeholder="Search instrument..." className="h-8 text-xs text-white" />
            <CommandList>
              <CommandEmpty className="text-white/50 text-xs py-2 text-center">
                No instrument found.
                {onCreateNew && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                    className="block w-full mt-2 text-amber-400 hover:text-amber-300 underline"
                  >
                    Create new instrument
                  </button>
                )}
              </CommandEmpty>
              <CommandGroup>
                {instruments.map(inst => (
                  <CommandItem
                    key={inst.value}
                    value={inst.label}
                    onSelect={() => {
                      onChange(inst.value);
                      setOpen(false);
                    }}
                    className="text-white text-xs cursor-pointer flex items-center justify-between group"
                  >
                    <span>{inst.label}</span>
                    <button
                      onClick={(e) => handlePreview(inst.value, e)}
                      className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-700 transition-opacity"
                      title="Preview sound"
                    >
                      ▶
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  );
}

export default function NoteGrid({ 
          voices, 
          currentBeat, 
          playheadPosition,
          isPlaying, 
          measures = 8, 
          onNoteClick,
          onNotesUpdate,
          cantusFirmus = [],
          onExportMidi,
          onSeek,
          activeVoice = 0,
          onActiveVoiceChange,
          onVoiceInstrumentChange,
          onSelectionChange,
          tempo = 80,
          timeSignature = '4/4',
          scrollToBeatRef,
          pressedPianoNotes = new Set(),
          pianoInstrument = 'organ',
          playbackControls,
          onOpenWaveEditor,
          loopStart = null,
          loopEnd = null,
          isLooping = false,
          onLoopChange,
          settings = {},
          onTogglePianoPanel,
          showPianoPanel = true,
          onPopOut,
          onNewProject,
          onSaveProject,
          onSaveProjectAs,
          onSaveSong,
          onLoadProject,
          onBrowseSongs,
          onExport,
          onAIComposer,
          onGenerate,
          canGenerate,
          isGenerating,
          onImportMidi,
          onTheoryTools,
          onPressedNotesChange,
          customInstruments = [],
          snapToGrid: snapToGridProp = true,
          onSnapToGridChange,
          chatbotActive = false
        }) {
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const timeSigConfig = TIME_SIGNATURES.find(t => t.value === timeSignature) || TIME_SIGNATURES[0];
  const beatsPerMeasure = timeSigConfig.beatsPerMeasure;
  const totalBeats = measures * beatsPerMeasure;

  // Combined instruments list with custom instruments
  const allInstruments = [
    ...DEFAULT_INSTRUMENTS, 
    ...PRESET_LIBRARY,
    ...customInstruments.map((inst, i) => ({ value: `custom_${i}`, label: inst.name }))
  ];

  const [zoom, setZoom] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const CELL_WIDTH = BASE_CELL_WIDTH * zoom;
  const CELL_HEIGHT = BASE_CELL_HEIGHT * zoomY;

  const [tool, setTool] = useState('select'); // 'select', 'marquee', 'draw'
    const [paintMode, setPaintMode] = useState(false); // When false, draw tool only adds one note per click
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [marquee, setMarquee] = useState(null);

  const getNoteKey = useCallback((pitch, beat) => `${pitch}-${Math.round(beat * 1000) / 1000}`, []);
  
  // Memoize notes lookup for performance - filter duplicates
  // Group notes by pitch and integer beat (notes can have fractional beats)
  const notesMap = useMemo(() => {
    const map = new Map();
    const seen = new Set();
    
    cantusFirmus.forEach(note => {
      const uniqueKey = `0-${note.pitch}-${note.beat}`;
      if (seen.has(uniqueKey)) return; // Skip duplicates
      seen.add(uniqueKey);
      
      const intBeat = Math.floor(note.beat);
      const key = `${note.pitch}-${intBeat}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ voiceIndex: 0, note });
    });
    
    voices.forEach((voice, voiceIndex) => {
      if (!voice.notes) return;
      voice.notes.forEach(note => {
        const uniqueKey = `${voiceIndex}-${note.pitch}-${note.beat}`;
        if (seen.has(uniqueKey)) return; // Skip duplicates
        seen.add(uniqueKey);
        
        const intBeat = Math.floor(note.beat);
        const key = `${note.pitch}-${intBeat}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ voiceIndex, note });
      });
    });
    return map;
  }, [cantusFirmus, voices]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
      onSelectionChange(selectedNotesList);
    }
  }, [selectedNotes, cantusFirmus, onSelectionChange]);

  const [dragState, setDragState] = useState(null);
  const originalDragNotesRef = useRef(null); // Store original notes when drag starts
  const [resizeState, setResizeState] = useState(null); // For resizing note duration (supports group resize)
  const [isPainting, setIsPainting] = useState(false); // For paint mode with pencil tool
  const paintedNotesRef = useRef(new Set()); // Track notes painted in current stroke
  const [pendingNote, setPendingNote] = useState(null); // For draw tool - only add note on mouseup
  const [clipboard, setClipboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [quantizeGrid, setQuantizeGrid] = useState(1); // 1 = 16th note (1 beat)
  const snapToGrid = snapToGridProp; // Use prop for snap to grid
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(null);
  const [isLoopSelecting, setIsLoopSelecting] = useState(false);
  
  // Use smooth playhead position if available, otherwise fall back to currentBeat
  // During scrubbing, use the scrub position for immediate feedback
  const smoothPlayhead = isScrubbing && scrubPosition !== null ? scrubPosition : (playheadPosition !== undefined ? playheadPosition : currentBeat);
  const [loopSelectStart, setLoopSelectStart] = useState(null);
  const [viewportState, setViewportState] = useState({ scrollLeft: 0, scrollTop: 0, height: 400, width: 800 });
  const [pinchState, setPinchState] = useState(null);
  const lastTapRef = useRef({ key: null, time: 0 });
  const touchStartRef = useRef(null); // Track touch start for scroll detection
  const activeTouchIdRef = useRef(null); // Track which touch is active for dragging
  const [lastNoteDuration, setLastNoteDuration] = useState(DEFAULT_DURATION); // Track last used duration
  const [hoveredCell, setHoveredCell] = useState(null); // Track hovered cell for piano highlighting
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Use pre-generated pitches (must be before useEffects that use it)
  const pitches = ALL_PITCHES;

  // Audio visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const smoothingFactor = 0.7;
    let previousData = null;
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      const analyserNode = getAnalyser();
      if (!analyserNode) {
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, rect.width, rect.height);
        return;
      }
      
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);
      
      if (previousData) {
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = previousData[i] * smoothingFactor + dataArray[i] * (1 - smoothingFactor);
        }
      }
      previousData = new Uint8Array(dataArray);
      
      const bgGradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      bgGradient.addColorStop(0, '#1A1A1A');
      bgGradient.addColorStop(1, '#0F0F0F');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      
      const numBars = 80;
      const barWidth = rect.width / numBars;
      const gap = 1.5;
      
      for (let i = 0; i < numBars; i++) {
        const startIdx = Math.floor((i / numBars) * bufferLength);
        const endIdx = Math.floor(((i + 1) / numBars) * bufferLength);
        let sum = 0;
        let count = 0;
        for (let j = startIdx; j < endIdx; j++) {
          sum += dataArray[j];
          count++;
        }
        const value = count > 0 ? sum / count : 0;

        // Apply non-linear scaling for better visual representation
        const normalized = value / 255;
        const boosted = Math.pow(normalized, 0.7) * 255; // Power scaling

        const labelSpace = 16;
        const barHeight = (boosted / 255) * (rect.height - labelSpace) * 1.8;
        const x = i * barWidth;
        
        const gradient = ctx.createLinearGradient(x, rect.height - barHeight, x, rect.height);
        
        if (barHeight < rect.height * 0.3) {
          gradient.addColorStop(0, '#00D4FF');
          gradient.addColorStop(1, '#0088FF');
        } else if (barHeight < rect.height * 0.6) {
          gradient.addColorStop(0, '#00FF88');
          gradient.addColorStop(0.5, '#88FF00');
          gradient.addColorStop(1, '#00D4FF');
        } else if (barHeight < rect.height * 0.8) {
          gradient.addColorStop(0, '#FFCC00');
          gradient.addColorStop(0.5, '#00FF88');
          gradient.addColorStop(1, '#00D4FF');
        } else {
          gradient.addColorStop(0, '#FF3333');
          gradient.addColorStop(0.3, '#FFAA00');
          gradient.addColorStop(0.6, '#00FF88');
          gradient.addColorStop(1, '#00D4FF');
        }
        
        ctx.fillStyle = gradient;
        
        const radius = 2;
        ctx.beginPath();
        ctx.moveTo(x, rect.height);
        ctx.lineTo(x, rect.height - barHeight + radius);
        ctx.arcTo(x, rect.height - barHeight, x + barWidth - gap, rect.height - barHeight, radius);
        ctx.lineTo(x + barWidth - gap, rect.height);
        ctx.closePath();
        ctx.fill();
        
        if (value > 180) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = barHeight > rect.height * 0.8 ? '#FF3333' : '#00FF88';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = (rect.height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      
      const freqMarkers = [
        { freq: '20Hz', pos: 0.02 },
        { freq: '100Hz', pos: 0.15 },
        { freq: '500Hz', pos: 0.35 },
        { freq: '1kHz', pos: 0.5 },
        { freq: '5kHz', pos: 0.75 },
        { freq: '10kHz', pos: 0.9 }
      ];
      
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      freqMarkers.forEach(marker => {
        const x = marker.pos * rect.width;
        ctx.fillText(marker.freq, x, 10);
      });
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [canvasRef.current]);

  // Update piano highlights based on interaction state
  useEffect(() => {
    if (!onPressedNotesChange) return;
    
    const highlightedNotes = new Set();
    
    // Highlight pending note (being added)
    if (pendingNote) {
      highlightedNotes.add(pendingNote.pitch);
    }
    
    // Highlight notes being dragged
    if (dragState && dragState.isDragging && originalDragNotesRef.current?.notes) {
      const pitchDelta = dragState.currentPitchIndex - dragState.startPitchIndex;
      originalDragNotesRef.current.notes.forEach(note => {
        const newPitchIdx = pitches.indexOf(note.pitch) + pitchDelta;
        if (newPitchIdx >= 0 && newPitchIdx < pitches.length) {
          highlightedNotes.add(pitches[newPitchIdx]);
        }
      });
    }
    
    // Highlight hovered cell in draw mode
    if (hoveredCell && tool === 'draw') {
      highlightedNotes.add(hoveredCell.pitch);
    }
    
    onPressedNotesChange(highlightedNotes);
  }, [pendingNote, dragState, hoveredCell, tool, onPressedNotesChange, pitches]);


  // Update viewport dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (gridRef.current) {
        setViewportState(prev => ({
          ...prev,
          height: gridRef.current.clientHeight,
          width: gridRef.current.clientWidth
        }));
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Set initial scroll to center on middle C (C4)
  useEffect(() => {
    if (gridRef.current && pitches.length > 0) {
      const c4Index = pitches.indexOf('C4');
      if (c4Index >= 0) {
        const c4Position = c4Index * CELL_HEIGHT;
        const viewportHeight = gridRef.current.clientHeight - 28; // subtract header height
        gridRef.current.scrollTop = c4Position - viewportHeight / 2;
      }
    }
  }, []); // Only run on mount

  // Expose scroll function via ref
  useEffect(() => {
    if (scrollToBeatRef) {
      scrollToBeatRef.current = (beat) => {
        if (gridRef.current) {
          const containerWidth = gridRef.current.clientWidth - 56;
          const beatPosition = beat * CELL_WIDTH;
          gridRef.current.scrollLeft = Math.max(0, beatPosition - containerWidth * 0.3);
        }
      };
    }
  }, [scrollToBeatRef, CELL_WIDTH]);

  // Smooth auto-scroll following playhead during playback (like a 2D game camera)
    useEffect(() => {
      if (gridRef.current && isPlaying && !isScrubbing) {
        if (smoothPlayhead === 0) {
          // Reset scroll to beginning
          gridRef.current.scrollLeft = 0;
        } else {
          const containerWidth = gridRef.current.clientWidth - 56; // subtract pitch label width
          const playheadPixelPosition = smoothPlayhead * CELL_WIDTH;
          
          // Center the playhead like a 2D game character - smooth scrolling
          const targetScroll = Math.max(0, playheadPixelPosition - containerWidth * 0.5);
          
          // Smooth interpolation for buttery smooth camera follow
          const currentScroll = gridRef.current.scrollLeft;
          const smoothingFactor = 0.15; // Lower = smoother but slower, higher = snappier
          const newScroll = currentScroll + (targetScroll - currentScroll) * smoothingFactor;
          
          gridRef.current.scrollLeft = newScroll;
        }
      }
    }, [smoothPlayhead, CELL_WIDTH, isScrubbing, isPlaying]);

  const getNotesAtBeat = (voiceIndex, beat) => {
    const voice = voices[voiceIndex];
    if (!voice || !voice.notes) return [];
    return voice.notes.filter(n => n.beat === beat);
  };

  const saveToHistory = useCallback((notes) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...notes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onNotesUpdate(history[historyIndex - 1]);
    }
  }, [historyIndex, history, onNotesUpdate]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onNotesUpdate(history[historyIndex + 1]);
    }
  }, [historyIndex, history, onNotesUpdate]);

  const deleteSelected = useCallback(() => {
    if (selectedNotes.size === 0) return;
    const newNotes = cantusFirmus.filter(n => !selectedNotes.has(getNoteKey(n.pitch, n.beat)));
    saveToHistory(newNotes);
    onNotesUpdate(newNotes);
    setSelectedNotes(new Set());
    
    // Auto-adjust measures after deletion
    if (window.autoAdjustMeasures) {
      setTimeout(() => window.autoAdjustMeasures(newNotes), 100);
    }
  }, [selectedNotes, cantusFirmus, onNotesUpdate, saveToHistory]);

  const copySelected = useCallback(() => {
    const copied = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
    if (copied.length > 0) {
      const minBeat = Math.min(...copied.map(n => n.beat));
      setClipboard(copied.map(n => ({ ...n, beat: n.beat - minBeat })));
    }
  }, [selectedNotes, cantusFirmus]);

  const paste = useCallback((atBeat = 0) => {
    if (clipboard.length === 0) return;
    const newNotes = [...cantusFirmus];
    clipboard.forEach(note => {
      const targetBeat = note.beat + atBeat;
      if (targetBeat < totalBeats) {
        // Allow multiple notes per beat - just add it
        const exists = newNotes.some(n => n.beat === targetBeat && n.pitch === note.pitch);
        if (!exists) {
          newNotes.push({ pitch: note.pitch, beat: targetBeat });
        }
      }
    });
    saveToHistory(newNotes.sort((a, b) => a.beat - b.beat));
    onNotesUpdate(newNotes.sort((a, b) => a.beat - b.beat));
  }, [clipboard, cantusFirmus, totalBeats, onNotesUpdate, saveToHistory]);

  // Play note sound when adding
  const playNoteSound = useCallback((pitch, note = null) => {
    initAudio();
    const instrument = voices[activeVoice]?.instrument || 'organ';
    const pitchBend = (note?.bendStart !== undefined || note?.bendEnd !== undefined) ? {
      start: note.bendStart ?? 0,
      end: note.bendEnd ?? 0,
      startTime: note.bendStartTime ?? 0,
      endTime: note.bendEndTime ?? 1
    } : 0;
    playNote(pitch, 0.5, 0.6, 0, instrument, pitchBend);
  }, [voices, activeVoice]);

  const selectAll = useCallback(() => {
    const allKeys = new Set(cantusFirmus.map(n => getNoteKey(n.pitch, n.beat)));
    setSelectedNotes(allKeys);
  }, [cantusFirmus]);

  const quantize = useCallback((gridValue = quantizeGrid) => {
    if (cantusFirmus.length === 0) return;
    
    const notesToQuantize = selectedNotes.size > 0 
      ? cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)))
      : cantusFirmus;
    
    if (notesToQuantize.length === 0) return;

    const newNotes = cantusFirmus.map(n => {
      const shouldQuantize = selectedNotes.size === 0 || selectedNotes.has(getNoteKey(n.pitch, n.beat));
      if (shouldQuantize) {
        // Snap to nearest grid value - use proper rounding for triplets
        const quantizedBeat = Math.round(n.beat / gridValue) * gridValue;
        return { ...n, beat: Math.max(0, Math.round(quantizedBeat * 1000) / 1000) };
      }
      return n;
    }).sort((a, b) => a.beat - b.beat);

    // Remove duplicate notes at same pitch and beat (keep first one)
    const seen = new Set();
    const uniqueNotes = newNotes.filter(n => {
      const key = getNoteKey(n.pitch, n.beat);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Update selection keys to new positions
    if (selectedNotes.size > 0) {
      const newSelectedKeys = new Set(
        notesToQuantize.map(n => {
          const quantizedBeat = Math.round(n.beat / gridValue) * gridValue;
          return getNoteKey(n.pitch, Math.max(0, Math.round(quantizedBeat * 1000) / 1000));
        })
      );
      setSelectedNotes(newSelectedKeys);
    }

    saveToHistory(uniqueNotes);
    onNotesUpdate(uniqueNotes);
  }, [selectedNotes, cantusFirmus, onNotesUpdate, saveToHistory, quantizeGrid, getNoteKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copySelected();
        deleteSelected();
      } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copySelected();
      } else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste(currentBeat);
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setSelectedNotes(new Set());
        setMarquee(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        // Spacebar is handled by parent for play/pause
      } else if (e.key === 'ArrowUp' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes up one octave (12 semitones)
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx - 12;
            if (newIdx >= 0) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else {
              newSelectedKeys.add(getNoteKey(n.pitch, n.beat));
            }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes down one octave (12 semitones)
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx + 12;
            if (newIdx < pitches.length) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else {
              newSelectedKeys.add(getNoteKey(n.pitch, n.beat));
            }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowUp' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes up one semitone
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx - 1;
            if (newIdx >= 0) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else {
              newSelectedKeys.add(getNoteKey(n.pitch, n.beat));
            }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowDown' && !e.shiftKey && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes down one semitone
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const currentIdx = pitches.indexOf(n.pitch);
            const newIdx = currentIdx + 1;
            if (newIdx < pitches.length) {
              const newPitch = pitches[newIdx];
              newSelectedKeys.add(getNoteKey(newPitch, n.beat));
              return { ...n, pitch: newPitch };
            } else {
              newSelectedKeys.add(getNoteKey(n.pitch, n.beat));
            }
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowLeft' && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes left one beat
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const newBeat = Math.max(0, n.beat - 1);
            newSelectedKeys.add(getNoteKey(n.pitch, newBeat));
            return { ...n, beat: newBeat };
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'ArrowRight' && selectedNotes.size > 0) {
        e.preventDefault();
        // Move selected notes right one beat
        const newSelectedKeys = new Set();
        const newNotes = cantusFirmus.map(n => {
          if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
            const newBeat = Math.min(totalBeats - 1, n.beat + 1);
            newSelectedKeys.add(getNoteKey(n.pitch, newBeat));
            return { ...n, beat: newBeat };
          }
          return n;
        });
        setSelectedNotes(newSelectedKeys);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else if (e.key === 'q' && cantusFirmus.length > 0) {
        e.preventDefault();
        quantize();
      } else if (e.key === 'v') {
        setTool('select');
      } else if (e.key === 'm') {
        setTool('marquee');
      } else if (e.key === 'b') {
        setTool('draw');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, copySelected, paste, selectAll, undo, redo]);

  const getBeatFromHeaderPosition = (clientX) => {
    if (!gridRef.current) return null;
    const gridRect = gridRef.current.getBoundingClientRect();
    const scrollLeft = gridRef.current.scrollLeft;
    const x = clientX - gridRect.left - 56 + scrollLeft; // 56 = pitch label width
    const beat = Math.floor(x / CELL_WIDTH);
    if (beat >= 0 && beat < totalBeats) {
      return beat;
    }
    return null;
  };

  const getCellFromPosition = (clientX, clientY) => {
    if (!containerRef.current || !gridRef.current) return null;
    const gridRect = gridRef.current.getBoundingClientRect();

    // Calculate position relative to the grid viewport, accounting for scroll
    const scrollLeft = gridRef.current.scrollLeft;
    const scrollTop = gridRef.current.scrollTop;
    const x = clientX - gridRect.left - 56 + scrollLeft; // 56 = pitch label width
    const y = clientY - gridRect.top - 28 + scrollTop; // 28 = header height (h-7 = 1.75rem = 28px)

    // Support fractional beats - snap only if snapToGrid is enabled
    let beat = x / CELL_WIDTH;
    if (snapToGrid) {
      beat = Math.round(beat / quantizeGrid) * quantizeGrid;
    }
    beat = Math.max(0, Math.min(totalBeats - 0.125, beat));

    const pitchIndex = Math.floor(y / CELL_HEIGHT);

    if (pitchIndex >= 0 && pitchIndex < pitches.length) {
      return { pitch: pitches[pitchIndex], beat, pitchIndex };
    }
    return null;
  };

  // Check if clicking on the right edge of a note (for resizing)
  const isOnNoteEdge = (e, note) => {
    if (!note) return false;
    const rect = e.target.getBoundingClientRect();
    const noteWidth = (note.duration || DEFAULT_DURATION) * CELL_WIDTH;
    const clickX = e.clientX - rect.left;
    return clickX > noteWidth - 8;
  };

  const getEventCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
          return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        if (e.clientX !== undefined) {
          return { clientX: e.clientX, clientY: e.clientY };
        }
        return { clientX: 0, clientY: 0 };
      };

      const handlePointerDown = (e, pitch, beat) => {
        const coords = getEventCoords(e);
        const noteKey = getNoteKey(pitch, beat);
        const existingNote = cantusFirmus.find(n => n.pitch === pitch && n.beat === beat);
        const hasNote = !!existingNote;

        if (tool === 'draw') {
          // In draw mode on an empty cell, add note functionality
          if (!hasNote) {
            // Prevent double-tap issues
            const now = Date.now();
            const isDoubleTap = lastTapRef.current.key === noteKey && now - lastTapRef.current.time < 300;
            lastTapRef.current = { key: noteKey, time: now };

            if (!isDoubleTap) {
              // Add note immediately on mousedown
              const noteExists = cantusFirmus.some(n => n.pitch === pitch && n.beat === beat);
              if (!noteExists) {
                const newNotes = [...cantusFirmus, { 
                  pitch, 
                  beat, 
                  duration: lastNoteDuration, 
                  velocity: 0.8 
                }].sort((a, b) => a.beat - b.beat);
                saveToHistory(newNotes);
                onNotesUpdate(newNotes);
                
                // Auto-expand if adding note in last measure
                const lastMeasureStart = (measures - 1) * beatsPerMeasure;
                if (beat >= lastMeasureStart && window.expandMeasures) {
                  window.expandMeasures();
                }
                
                // Play the note with proper duration for feedback
                initAudio();
                const instrument = voices[activeVoice]?.instrument || 'organ';
                playNote(pitch, 0.5, 0.7, 0, instrument);
              }
              
              // Enable painting mode if paintMode is on
              if (paintMode) {
                setIsPainting(true);
                paintedNotesRef.current = new Set([noteKey]);
              }

              // Clear selection and loop
              setSelectedNotes(new Set());
              if (onLoopChange) {
                onLoopChange(null, null);
              }
            }
          }
          // If there's a note, do nothing - let the note element handle clicks
        } else if (tool === 'select') {
          if (hasNote) {
            // Note click is handled by the note element itself
            return;
          } else {
            // Click on empty cell - deselect and clear loop
            if (!e.shiftKey) {
              setSelectedNotes(new Set());
              if (onLoopChange) {
                onLoopChange(null, null);
              }
            }
            // Start marquee
            setMarquee({
              startX: coords.clientX,
              startY: coords.clientY,
              endX: coords.clientX,
              endY: coords.clientY
            });
          }
        } else if (tool === 'marquee') {
          setMarquee({
            startX: coords.clientX,
            startY: coords.clientY,
            endX: coords.clientX,
            endY: coords.clientY
          });
        }
      };

  const handlePointerMove = (e) => {
                const coords = e.clientX !== undefined ? e : getEventCoords(e);

                // Update hovered cell for piano highlighting
                const cell = getCellFromPosition(coords.clientX, coords.clientY);
                setHoveredCell(cell);

                // Clear pending note if we start moving with dragState
                if (dragState && pendingNote) {
                  console.log('[NoteGrid] Clearing pendingNote because drag began');
                  setPendingNote(null);
                }

                // Handle painting in draw mode (only if paintMode is enabled)
                if (isPainting && tool === 'draw' && paintMode) {
              if (cell) {
                const noteKey = getNoteKey(cell.pitch, cell.beat);
                const hasNote = cantusFirmus.some(n => n.pitch === cell.pitch && n.beat === cell.beat);

                // Only add if not already painted in this stroke and no existing note
                if (!paintedNotesRef.current.has(noteKey) && !hasNote) {
                  paintedNotesRef.current.add(noteKey);
                  const newNotes = [...cantusFirmus, { pitch: cell.pitch, beat: cell.beat, duration: lastNoteDuration, velocity: 0.8 }].sort((a, b) => a.beat - b.beat);
                  onNotesUpdate(newNotes);
                  
                  // Auto-expand if adding note in last measure
                  const lastMeasureStart = (measures - 1) * beatsPerMeasure;
                  if (cell.beat >= lastMeasureStart && window.expandMeasures) {
                    window.expandMeasures();
                  }
                  
                  // Play the note with proper duration for feedback
                  initAudio();
                  const instrument = voices[activeVoice]?.instrument || 'organ';
                  playNote(cell.pitch, 0.5, 0.7, 0, instrument);
                }
              }
            }

        if (resizeState) {
      // Handle note duration resize
              const deltaX = coords.clientX - resizeState.startX;
      const deltaDuration = deltaX / CELL_WIDTH;

      // Update note durations in real-time (group resize if multiple selected)
      const newNotes = cantusFirmus.map(n => {
        const noteKey = getNoteKey(n.pitch, n.beat);
        const startDuration = resizeState.startDurations[noteKey];
        if (startDuration !== undefined) {
          const newDuration = Math.max(MIN_DURATION, Math.round((startDuration + deltaDuration) * 8) / 8);
          return { ...n, duration: newDuration };
        }
        return n;
      });
      onNotesUpdate(newNotes);
    } else if (marquee) {
            setMarquee(prev => ({ ...prev, endX: coords.clientX, endY: coords.clientY }));
          } else if (dragState && (selectedNotes.size > 0 || originalDragNotesRef.current)) {
            // Calculate delta from original click position for smooth dragging
            const deltaX = coords.clientX - dragState.clickOffsetX;
            const deltaY = coords.clientY - dragState.clickOffsetY;
      
      // Support fractional beats when snap is off
      let beatDelta = deltaX / CELL_WIDTH;
      if (snapToGrid) {
        beatDelta = Math.round(beatDelta / quantizeGrid) * quantizeGrid;
      }
      const pitchDelta = Math.round(deltaY / CELL_HEIGHT);

      const newPitchIndex = dragState.startPitchIndex + pitchDelta;
      const newBeat = dragState.startBeat + beatDelta;
      
      const prevPitchIndex = dragState.currentPitchIndex;

      // Set dragging to true if we've moved at all
      const hasMoved = beatDelta !== 0 || pitchDelta !== 0;
      
      // Play note sound when pitch changes during drag
      if ((dragState.isDragging || hasMoved) && newPitchIndex !== prevPitchIndex && newPitchIndex >= 0 && newPitchIndex < pitches.length) {
        playNoteSound(pitches[newPitchIndex]);
      }

      // Auto-scroll when dragging near edges
                  if (gridRef.current && dragState.isDragging) {
                    const rect = gridRef.current.getBoundingClientRect();
                    const edgeThreshold = 60;
                    const scrollSpeed = 15;

                    // Horizontal scrolling
                    if (coords.clientX > rect.right - edgeThreshold) {
                      gridRef.current.scrollLeft += scrollSpeed;
                    } else if (coords.clientX < rect.left + edgeThreshold + 56) {
                      gridRef.current.scrollLeft -= scrollSpeed;
                    }

                    // Vertical scrolling
                    if (coords.clientY > rect.bottom - edgeThreshold) {
                      gridRef.current.scrollTop += scrollSpeed;
                    } else if (coords.clientY < rect.top + edgeThreshold + 28) {
                      gridRef.current.scrollTop -= scrollSpeed;
                    }
                  }

      setDragState(prev => ({
        ...prev,
        currentPitchIndex: newPitchIndex,
        currentBeat: newBeat,
        isDragging: prev.isDragging || hasMoved // Set to true if already dragging or if we've moved
      }));
    }
  };

  const handlePointerUp = (e) => {
        // Add pending note if in draw mode and mouse hasn't moved much
        console.log('[NoteGrid] PointerUp', { hasPendingNote: !!pendingNote, hasDragState: !!dragState, hasOriginalDragNotes: !!originalDragNotesRef.current });
        // Don't add pending note if we started a drag operation (even if dragState hasn't updated yet)
        if (pendingNote && !dragState && !originalDragNotesRef.current) {
          const coords = e?.clientX !== undefined ? e : getEventCoords(e || {});
          const deltaX = Math.abs(coords.clientX - pendingNote.clickX);
          const deltaY = Math.abs(coords.clientY - pendingNote.clickY);

          console.log('[NoteGrid] Checking pending note', { deltaX, deltaY, pendingNote });
          // Only add note if mouse hasn't moved significantly (not a drag) and we're not in a drag state
          if (deltaX < 15 && deltaY < 15) {
          // Check if note already exists at this position
          const noteExists = cantusFirmus.some(n => n.pitch === pendingNote.pitch && n.beat === pendingNote.beat);
          if (!noteExists) {
          const newNotes = [...cantusFirmus, { 
          pitch: pendingNote.pitch, 
          beat: pendingNote.beat, 
          duration: lastNoteDuration, 
          velocity: 0.8 
          }].sort((a, b) => a.beat - b.beat);
          saveToHistory(newNotes);
          onNotesUpdate(newNotes);

          // Auto-expand if adding note in last measure
          const lastMeasureStart = (measures - 1) * beatsPerMeasure;
          if (pendingNote.beat >= lastMeasureStart && window.expandMeasures) {
          window.expandMeasures();
          }

          // Play the note with proper duration for feedback
          initAudio();
          const instrument = voices[0]?.instrument || 'organ';
          playNote(pendingNote.pitch, 0.5, 0.7, 0, instrument);
          } else {
          console.log('[NoteGrid] Note already exists at this position, not adding duplicate');
          }
          }

          setPendingNote(null);
        }

        // Save history after painting stroke
        if (isPainting && paintedNotesRef.current.size > 0) {
          saveToHistory(cantusFirmus);
        }
        setIsPainting(false);
        paintedNotesRef.current.clear();

        if (resizeState) {
          // Save to history after resize and update last duration
          const resizedNote = cantusFirmus.find(n => resizeState.startDurations[getNoteKey(n.pitch, n.beat)] !== undefined);
          if (resizedNote) {
            setLastNoteDuration(resizedNote.duration || DEFAULT_DURATION);
          }
          saveToHistory(cantusFirmus);
          setResizeState(null);
          return;
        }
    
    if (marquee) {
      // Check if this was a drag or just a click
      const deltaX = Math.abs(marquee.endX - marquee.startX);
      const deltaY = Math.abs(marquee.endY - marquee.startY);
      
      if (deltaX < 40 && deltaY < 40) {
        // Just a click - clear selection and loop
        setSelectedNotes(new Set());
        if (onLoopChange) {
          onLoopChange(null, null);
        }
      } else {
        // Calculate selected notes from marquee
        const startCell = getCellFromPosition(marquee.startX, marquee.startY);
        const endCell = getCellFromPosition(marquee.endX, marquee.endY);
        
        if (startCell && endCell) {
          const minBeat = Math.min(startCell.beat, endCell.beat);
          const maxBeat = Math.max(startCell.beat, endCell.beat);
          const minPitchIdx = Math.min(startCell.pitchIndex, endCell.pitchIndex);
          const maxPitchIdx = Math.max(startCell.pitchIndex, endCell.pitchIndex);
          
          const newSelected = new Set();
          cantusFirmus.forEach(note => {
            const pitchIdx = pitches.indexOf(note.pitch);
            const duration = note.duration || DEFAULT_DURATION;
            const noteEndBeat = note.beat + duration;
            
            // Select note if it overlaps with marquee at all (more lenient)
            const overlapsHorizontally = noteEndBeat > minBeat && note.beat <= maxBeat;
            const overlapsVertically = pitchIdx >= minPitchIdx && pitchIdx <= maxPitchIdx;
            
            if (overlapsHorizontally && overlapsVertically) {
              newSelected.add(getNoteKey(note.pitch, note.beat));
            }
          });
          setSelectedNotes(newSelected);
        }
      }
      setMarquee(null);
    } else if (dragState && originalDragNotesRef.current) {
      // Apply drag only if actually moved
      const pitchDelta = dragState.currentPitchIndex - dragState.startPitchIndex;
      const beatDelta = dragState.currentBeat - dragState.startBeat;

      const { notes: originalNotes, keys: draggedKeys, shouldUpdateSelection, shiftKey, targetKey } = originalDragNotesRef.current;

      // Only apply drag if there was actual movement AND dragging was initiated
      if (originalNotes && originalNotes.length > 0 && dragState.isDragging && (pitchDelta !== 0 || beatDelta !== 0)) {
        // Remove original notes and add moved notes at new positions
        const notesWithoutDragged = cantusFirmus.filter(n => !draggedKeys.has(getNoteKey(n.pitch, n.beat)));

        const movedNotes = originalNotes.map(n => {
          const origPitchIdx = pitches.indexOf(n.pitch);
          const newPitchIdx = Math.max(0, Math.min(pitches.length - 1, origPitchIdx + pitchDelta));
          let newBeat = n.beat + beatDelta;
          // Round to 3 decimal places to avoid floating point errors
          newBeat = Math.round(newBeat * 1000) / 1000;
          newBeat = Math.max(0, Math.min(totalBeats - 0.125, newBeat));
          return { 
            pitch: pitches[newPitchIdx], 
            beat: newBeat, 
            duration: n.duration || DEFAULT_DURATION,
            velocity: n.velocity ?? 0.8
          };
        }).filter(n => n.beat >= 0 && n.beat < totalBeats);

        const newNotes = [...notesWithoutDragged, ...movedNotes].sort((a, b) => a.beat - b.beat);

        saveToHistory(newNotes);
        onNotesUpdate(newNotes);

        // Update selection keys to new positions
        const newSelected = new Set(movedNotes.map(n => getNoteKey(n.pitch, n.beat)));
        setSelectedNotes(newSelected);
        
        // Auto-adjust measures after moving notes
        if (window.autoAdjustMeasures) {
          setTimeout(() => window.autoAdjustMeasures(newNotes), 100);
        }
      } else if (!dragState.isDragging || (pitchDelta === 0 && beatDelta === 0)) {
        // Simple click without drag - update selection now
        if (shouldUpdateSelection) {
          if (!shiftKey) {
            setSelectedNotes(new Set([targetKey]));
          } else {
            setSelectedNotes(prev => new Set([...prev, targetKey]));
          }
        }
      }

      // Clear the ref
      originalDragNotesRef.current = null;
    }
    setDragState(null);
    activeTouchIdRef.current = null;
  };

  // Calculate drag preview offset
  const getDragOffset = () => {
    if (!dragState || !dragState.isDragging) return { pitchDelta: 0, beatDelta: 0 };
    return {
      pitchDelta: dragState.currentPitchIndex - dragState.startPitchIndex,
      beatDelta: dragState.currentBeat - dragState.startBeat
    };
  };

  const dragOffset = getDragOffset();

  return (
          <div className="bg-[#2D2D2D] rounded-xl sm:rounded-2xl border border-[#3A3A3A] w-full overflow-hidden max-w-full">
            {/* Main Toolbar */}
          <div className="flex items-center justify-between px-2 sm:px-5 py-1 sm:py-1.5 border-b border-[#3A3A3A] overflow-x-auto gap-2">
            {/* Left: File Menu */}
            <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white hover:text-white hover:bg-slate-700/50 gap-2"
              >
                <Menu className="w-4 h-4" />
                <span className="font-semibold text-sm">File</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-[#1E1E1E] border-[#3A3A3A] min-w-[220px] shadow-xl">
              <DropdownMenuItem onClick={onNewProject} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FileText className="w-4 h-4 mr-2" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLoadProject} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FolderOpen className="w-4 h-4 mr-2" />
                Load Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveProject} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Project
                <span className="ml-auto text-xs text-white/40">⌘S</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveProjectAs} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FilePlus className="w-4 h-4 mr-2" />
                Save Project As...
                <span className="ml-auto text-xs text-white/40">⌘⇧S</span>
              </DropdownMenuItem>
              {onSaveSong && (
                <DropdownMenuItem onClick={onSaveSong} className="text-amber-400 cursor-pointer font-semibold hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
                  <Save className="w-4 h-4 mr-2" />
                  Save as Song (Admin)
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={onBrowseSongs} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
                <Music className="w-4 h-4 mr-2" />
                Browse Songs
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={onExportMidi} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FileAudio className="w-4 h-4 mr-2" />
                Export MIDI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportMidi} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FileAudio className="w-4 h-4 mr-2" />
                Import MIDI
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                try {
                  const { renderToWav } = await import('../counterpoint/audioExporter');
                  const blob = await renderToWav(cantusFirmus, tempo, voices[0]?.instrument || 'organ');
                  
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `composition-${Date.now()}.wav`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Export audio error:', error);
                  alert('Failed to export audio: ' + error.message);
                }
              }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Download className="w-4 h-4 mr-2" />
                Download as Audio
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={onOpenWaveEditor} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Guitar className="w-4 h-4 mr-2" />
                Create Instrument
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={onAIComposer} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Composer
                {chatbotActive && <Check className="w-4 h-4 ml-auto text-amber-400" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={onGenerate} 
                disabled={!canGenerate || isGenerating}
                className="text-amber-400 cursor-pointer font-semibold hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Counterpoint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

          {/* Center: Transport controls */}
          <div className="flex-1 flex items-center justify-center">
            {playbackControls}
          </div>
        
          <div className="w-8" />
        </div>

      {/* Secondary Toolbar - Tool Controls */}
      <div className="flex items-center justify-between px-2 sm:px-5 py-1.5 border-b border-[#3A3A3A]/50 bg-[#252525]">
        <div className="flex items-center gap-1">
          <Button
            variant={tool === 'select' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('select')}
            className={`h-7 px-2 ${tool === 'select' ? 'bg-amber-500 text-slate-900' : 'text-white/70'}`}
            title="Select (V)"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={tool === 'draw' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('draw')}
            className={`h-7 px-2 ${tool === 'draw' ? 'bg-amber-500 text-slate-900' : 'text-white/70'}`}
            title="Draw (B)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant={paintMode ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPaintMode(!paintMode)}
            disabled={tool !== 'draw'}
            className={`h-7 px-2 text-xs ${paintMode ? 'bg-amber-500/80 text-slate-900' : 'text-white/70 border border-slate-600'}`}
            title="Paint mode - drag to add multiple notes"
          >
            Paint
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSnapToGridChange?.(!snapToGrid)}
            className={`h-7 w-16 text-xs font-semibold ${snapToGrid ? 'bg-amber-500/80 text-slate-900 hover:bg-amber-500/90 hover:text-slate-900' : 'text-white/70 border border-slate-600 hover:text-white hover:bg-slate-700'}`}
            title={snapToGrid ? "Snap to grid enabled" : "Free positioning"}
          >
            SNAP
          </Button>
          
          <div className="w-px h-4 bg-slate-600 mx-1.5" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-7 px-2 text-white/70 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-7 px-2 text-white/70 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-3.5 h-3.5" />
          </Button>
          
          <div className="w-px h-4 bg-slate-600 mx-1.5" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelected}
            disabled={selectedNotes.size === 0}
            className="h-7 px-2 text-white/70 disabled:opacity-30"
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => paste()}
            disabled={clipboard.length === 0}
            className="h-7 px-2 text-white/70 disabled:opacity-30"
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelected}
            disabled={selectedNotes.size === 0}
            className="h-7 px-2 text-white/70 hover:text-red-400 disabled:opacity-30"
            title="Delete (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-4 bg-slate-600 mx-1.5" />

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => quantize()}
              disabled={cantusFirmus.length === 0}
              className="h-7 px-2 text-white/70 hover:text-white hover:bg-slate-700 rounded-r-none border-r border-slate-600 disabled:opacity-30"
              title={selectedNotes.size > 0 ? "Quantize selected notes (Q)" : "Quantize all notes (Q)"}
            >
              <span className="font-bold text-xs">Q</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 text-white/70 hover:text-white hover:bg-slate-700 rounded-l-none"
                  title="Quantize grid settings"
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(0.125); quantize(0.125); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 0.125 ? 'bg-slate-700' : ''}`}
                >
                  128th note (0.125 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(0.25); quantize(0.25); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 0.25 ? 'bg-slate-700' : ''}`}
                >
                  64th note (0.25 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(0.5); quantize(0.5); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 0.5 ? 'bg-slate-700' : ''}`}
                >
                  32nd note (0.5 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(1); quantize(1); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 1 ? 'bg-slate-700' : ''}`}
                >
                  16th note (1 beat)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(2); quantize(2); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 2 ? 'bg-slate-700' : ''}`}
                >
                  8th note (2 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(8/3); quantize(8/3); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 8/3 ? 'bg-slate-700' : ''}`}
                >
                  8th triplet (2.67 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(4); quantize(4); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 4 ? 'bg-slate-700' : ''}`}
                >
                  Quarter note (4 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(16/3); quantize(16/3); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 16/3 ? 'bg-slate-700' : ''}`}
                >
                  Quarter triplet (5.33 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(8); quantize(8); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 8 ? 'bg-slate-700' : ''}`}
                >
                  Half note (8 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(12); quantize(12); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 12 ? 'bg-slate-700' : ''}`}
                >
                  Half triplet (10.67 beats)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setQuantizeGrid(16); quantize(16); }}
                  className={`text-white cursor-pointer text-xs ${quantizeGrid === 16 ? 'bg-slate-700' : ''}`}
                >
                  Whole note (16 beats)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right: Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-[10px] uppercase">W</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
            className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
            title="Zoom out width"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Slider
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            className="w-16 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
            className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
            title="Zoom in width"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          <span className="text-white/50 text-[10px] uppercase">H</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoomY(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            disabled={zoomY <= MIN_ZOOM}
            className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
            title="Zoom out height"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Slider
            value={[zoomY]}
            onValueChange={([value]) => setZoomY(value)}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            className="w-16 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoomY(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            disabled={zoomY >= MAX_ZOOM}
            className="h-7 w-7 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
            title="Zoom in height"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>


          <div 
                  ref={gridRef}
                  className={`overflow-auto relative select-none mx-2 sm:mx-5 ${
                    showPianoPanel 
                      ? 'max-h-[47vh] sm:max-h-[488px]'
                      : 'max-h-[66vh] sm:max-h-[648px]'
                  }`}
                style={{ 
                  scrollbarWidth: 'thin', 
                  scrollbarColor: '#505050 transparent',
                  touchAction: tool === 'marquee' ? 'none' : 'auto',
                  backgroundColor: '#232323'
                }}
        onMouseMove={handlePointerMove}
                      onMouseUp={handlePointerUp}
                      onMouseLeave={(e) => {
                        setHoveredCell(null);
                        handlePointerUp(e);
                      }}
                      onTouchMove={(e) => { 
                                                                                // Handle pinch to zoom first
                                                                                if (e.touches.length === 2) {
                                                                                  e.preventDefault();
                                                                                  const touch1 = e.touches[0];
                                                                                  const touch2 = e.touches[1];
                                                                                  const currentDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

                                                                                  if (pinchState) {
                                                                                    const scale = currentDist / pinchState.initialDist;
                                                                                    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchState.initialZoom * scale));
                                                                                    const newZoomY = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchState.initialZoomY * scale));
                                                                                    setZoom(newZoom);
                                                                                    setZoomY(newZoomY);
                                                                                  }
                                                                                  return;
                                                                                }

                                                                                // Prevent scrolling when any editing gesture is active
                                                                                if (marquee || tool === 'marquee' || (isPainting && paintMode) || resizeState || dragState) {
                                                                                  e.preventDefault();
                                                                                  // Find the active touch
                                                                                  let activeTouch = null;
                                                                                  for (let i = 0; i < e.touches.length; i++) {
                                                                                    if (e.touches[i].identifier === activeTouchIdRef.current) {
                                                                                      activeTouch = e.touches[i];
                                                                                      break;
                                                                                    }
                                                                                  }
                                                                                  if (activeTouch) {
                                                                                    handlePointerMove({ clientX: activeTouch.clientX, clientY: activeTouch.clientY });
                                                                                  } else if (e.touches.length > 0) {
                                                                                    handlePointerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
                                                                                  }
                                                                                }
                                                                              }}
                                    onTouchStart={(e) => {
                                      // Detect pinch start
                                      if (e.touches.length === 2) {
                                        const touch1 = e.touches[0];
                                        const touch2 = e.touches[1];
                                        const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                                        setPinchState({ initialDist: dist, initialZoom: zoom, initialZoomY: zoomY });
                                      }
                                    }}
                                    onTouchEnd={(e) => {
                                      // Check if the ended touch is our active one
                                      let wasActiveTouch = false;
                                      for (let i = 0; i < e.changedTouches.length; i++) {
                                        if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
                                          wasActiveTouch = true;
                                          break;
                                        }
                                      }
                                      if (wasActiveTouch) {
                                        handlePointerUp();
                                        activeTouchIdRef.current = null;
                                      }
                                      if (e.touches.length < 2) {
                                        setPinchState(null);
                                      }
                                    }}
                                    onTouchCancel={() => {
                                      handlePointerUp();
                                      setPinchState(null);
                                      activeTouchIdRef.current = null;
                                    }}
        onScroll={(e) => {
        setViewportState(prev => ({ ...prev, scrollLeft: e.target.scrollLeft, scrollTop: e.target.scrollTop }));
      }}
      >
        <div className="inline-flex min-w-full" ref={containerRef}>
          {/* Pitch labels - fixed column on left, allows vertical scrolling */}
                                      <div className="sticky left-0 z-20 flex-shrink-0" style={{ backgroundColor: '#2B2B2B' }}>
                                        <div className="h-7 border-b border-amber-900/50 sticky top-0 z-10" style={{ backgroundColor: '#3a3a3a' }} />
                          {pitches.map((pitch) => {
                                                                        const isSharp = pitch.includes('#');
                                                                        const isC = pitch.startsWith('C') && !pitch.startsWith('C#');
                                                                        const isPianoPressed = pressedPianoNotes.has(pitch);
                                                                        return (
                                                                          <div 
                                                                            key={pitch}
                                                                            onTouchEnd={(e) => {
                                                                                                    // Only play note on tap, not after scroll
                                                                                                    if (!e.defaultPrevented) {
                                                                                                      initAudio();
                                                                                                      playNote(pitch, 0.5, 0.7, 0, pianoInstrument);
                                                                                                    }
                                                                                                  }}
                                                                            onClick={() => {
                                                                                                    initAudio();
                                                                                                    playNote(pitch, 0.5, 0.7, 0, pianoInstrument);
                                                                                                  }}
                                                                            className={`w-14 flex items-center justify-end pr-2 text-xs border-b border-slate-700 cursor-pointer hover:bg-slate-600/50 transition-colors sticky left-0 ${
                                                                              isPianoPressed ? 'text-amber-300 font-bold' : isC ? 'text-amber-400 font-semibold' : isSharp ? 'text-white/50' : 'text-white/80'
                                                                            }`}
                                                                            style={{ height: CELL_HEIGHT, backgroundColor: isPianoPressed ? 'rgba(251, 191, 36, 0.4)' : isC ? 'rgba(200, 165, 112, 0.15)' : isSharp ? 'rgba(0,0,0,0.3)' : '#2B2B2B' }}
                                                                          >
                                                                            {pitch}
                                                                          </div>
                                                                        );
                                                                      })}
                        </div>

          {/* Grid area */}
          <div className="flex-shrink-0">
            {/* Beat numbers header */}
                            <div 
                              className="flex h-7 border-b border-amber-900/50 select-none sticky top-0 z-30 relative cursor-pointer"
                              style={{ backgroundColor: '#3a3a3a' }}
                              onMouseDown={(e) => {
                                const beat = getBeatFromHeaderPosition(e.clientX);
                                if (beat === null) return;

                                setIsLoopSelecting(true);
                                setLoopSelectStart(beat);
                                if (onLoopChange) {
                                  onLoopChange(beat, beat);
                                }

                                const handleMouseMove = (moveEvent) => {
                                  const moveBeat = getBeatFromHeaderPosition(moveEvent.clientX);
                                  if (moveBeat !== null) {
                                    const start = Math.min(beat, moveBeat);
                                    const end = Math.max(beat, moveBeat);
                                    if (onLoopChange) {
                                      onLoopChange(start, end);
                                    }
                                  }
                                };

                                const handleMouseUp = (upEvent) => {
                                  let upBeat = getBeatFromHeaderPosition(upEvent.clientX);
                                  if (upBeat !== null) {
                                    // Apply snapping for loop selection (always snap for loop regions)
                                    const snappedBeat = Math.floor(beat);
                                    const snappedUpBeat = Math.floor(upBeat);
                                    const dragDistance = Math.abs(snappedUpBeat - snappedBeat);

                                    if (dragDistance === 0) {
                                      // Single click - seek to position
                                      if (snapToGrid) {
                                        upBeat = Math.round(upBeat / quantizeGrid) * quantizeGrid;
                                      }
                                      if (onSeek) {
                                        onSeek(upBeat);
                                      }
                                      if (onLoopChange) {
                                        onLoopChange(null, null);
                                      }
                                    } else {
                                      // Drag - create loop region (always use full beats for loops)
                                      const start = Math.min(snappedBeat, snappedUpBeat);
                                      const end = Math.max(snappedBeat, snappedUpBeat) + 1;
                                      if (onLoopChange) {
                                        onLoopChange(start, end);
                                      }
                                    }
                                  }
                                  setIsLoopSelecting(false);
                                  setLoopSelectStart(null);
                                  document.removeEventListener('mousemove', handleMouseMove);
                                  document.removeEventListener('mouseup', handleMouseUp);
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                              }}
                            >
                              {Array.from({ length: measures }).map((_, measureIndex) => {
                                const measureStartBeat = measureIndex * beatsPerMeasure;

                                return (
                                  <div 
                                    key={measureIndex}
                                    className={`flex-shrink-0 flex items-center justify-start pl-2 text-sm font-semibold relative overflow-visible ${measureIndex > 0 ? 'border-l-2 border-l-slate-600' : ''}`}
                                    style={{ 
                                      width: CELL_WIDTH * beatsPerMeasure,
                                      backgroundColor: '#3a3a3a'
                                    }}
                                    >
                                    <span className="text-white font-bold pointer-events-none relative z-10">
                                      {measureIndex + 1}
                                    </span>

                                    {/* Individual beat backgrounds for loop highlighting */}
                                    {Array.from({ length: beatsPerMeasure }).map((_, beatIndex) => {
                                      const beat = measureStartBeat + beatIndex;
                                      const inLoop = loopStart !== null && loopEnd !== null && beat >= loopStart && beat < loopEnd;
                                      return (
                                        <div
                                          key={`bg-${beatIndex}`}
                                          className="absolute top-0 bottom-0 pointer-events-none"
                                          style={{
                                            left: `${beatIndex * CELL_WIDTH}px`,
                                            width: `${CELL_WIDTH}px`,
                                            backgroundColor: inLoop ? '#C8A570' : 'transparent'
                                          }}
                                        />
                                      );
                                    })}

                                    {/* Ruler tick marks */}
                                    {Array.from({ length: beatsPerMeasure }).map((_, beatIndex) => (
                                      <div
                                        key={beatIndex}
                                        className="absolute top-0 pointer-events-none z-10"
                                        style={{
                                          left: `${beatIndex * CELL_WIDTH - 0.5}px`,
                                          width: '1px',
                                          height: beatIndex % 4 === 0 ? '12px' : '6px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.3)'
                                        }}
                                      />
                                    ))}
                                    {/* End tick */}
                                    <div
                                      className="absolute top-0 pointer-events-none z-10"
                                      style={{
                                        right: '-1px',
                                        width: '1px',
                                        height: '12px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.3)'
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>

            {/* Virtualized Note grid rows - only render visible rows */}
            {(() => {
              // Calculate visible range with buffer
              const visibleStartRow = Math.max(0, Math.floor(viewportState.scrollTop / CELL_HEIGHT) - 5);
              const visibleEndRow = Math.min(pitches.length, Math.ceil((viewportState.scrollTop + viewportState.height) / CELL_HEIGHT) + 5);

              // Calculate visible beat range
              const visibleStartBeat = Math.max(0, Math.floor(viewportState.scrollLeft / CELL_WIDTH) - 2);
              const visibleEndBeat = Math.min(totalBeats, Math.ceil((viewportState.scrollLeft + viewportState.width) / CELL_WIDTH) + 2);
              
              return (
                <>
                  {/* Spacer for rows above visible area */}
                  {visibleStartRow > 0 && (
                    <div style={{ height: visibleStartRow * CELL_HEIGHT }} />
                  )}
                  
                  {pitches.slice(visibleStartRow, visibleEndRow).map((pitch, idx) => {
                    const pitchIndex = visibleStartRow + idx;
                    const isCLine = pitch.startsWith('C') && !pitch.startsWith('C#');
                    const isSharpLine = pitch.includes('#');
                    
                    return (
                      <div key={pitch} className="flex" style={{ height: CELL_HEIGHT }}>
                        {/* Spacer for beats before visible area */}
                        {visibleStartBeat > 0 && (
                          <div style={{ width: visibleStartBeat * CELL_WIDTH, flexShrink: 0 }} />
                        )}
                        
                        {Array.from({ length: visibleEndBeat - visibleStartBeat }).map((_, i) => {
                          const beat = visibleStartBeat + i;
                          const isBarLine = beat % beatsPerMeasure === 0 && beat !== 0;
                          const noteKey = getNoteKey(pitch, beat);
                          const isSelected = selectedNotes.has(noteKey);
                          const notesAtPosition = notesMap.get(`${pitch}-${beat}`) || [];
                          const isCurrentBeat = currentBeat === beat;
                          const inLoopRegion = loopStart !== null && loopEnd !== null && beat >= loopStart && beat < loopEnd;

                          return (
                            <div
                              key={beat}
                              onMouseDown={(e) => handlePointerDown(e, pitch, beat)}
                                    onTouchStart={(e) => { 
                                      const touch = e.touches[0];
                                      const hasNote = cantusFirmus.some(n => n.pitch === pitch && n.beat === beat);

                                      // For marquee tool, prevent scrolling immediately
                                      if (tool === 'marquee') {
                                        e.preventDefault();
                                        activeTouchIdRef.current = touch.identifier;
                                        handlePointerDown(e, pitch, beat);
                                        return;
                                      }

                                      // If we have selected notes and tapping on empty cell, start drag immediately
                                      if (!hasNote && selectedNotes.size > 0 && tool === 'select') {
                                        e.preventDefault();
                                        activeTouchIdRef.current = touch.identifier;

                                        // Store notes for dragging
                                        const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                                        const notesToStore = selectedNotesList.map(n => ({
                                          pitch: n.pitch,
                                          beat: n.beat,
                                          duration: n.duration || DEFAULT_DURATION,
                                          velocity: n.velocity
                                        }));
                                        originalDragNotesRef.current = {
                                          keys: new Set(notesToStore.map(n => getNoteKey(n.pitch, n.beat))),
                                          notes: notesToStore
                                        };

                                        const currentPitchIdx = pitches.indexOf(pitch);
                                        setDragState({
                                          startPitch: pitch,
                                          startBeat: beat,
                                          startPitchIndex: currentPitchIdx,
                                          currentPitchIndex: currentPitchIdx,
                                          currentBeat: beat,
                                          isDragging: true,
                                          clickOffsetX: touch.clientX,
                                          clickOffsetY: touch.clientY
                                        });
                                        return;
                                      }

                                      // Store touch start position to detect scrolling vs tapping
                                      touchStartRef.current = { 
                                        x: touch.clientX, 
                                        y: touch.clientY, 
                                        pitch, 
                                        beat,
                                        time: Date.now()
                                      };
                                    }}
                                    onTouchEnd={(e) => {
                                      if (!touchStartRef.current) return;
                                      const touch = e.changedTouches[0];
                                      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
                                      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
                                      const deltaTime = Date.now() - touchStartRef.current.time;

                                      // Only trigger note action if it was a tap (small movement, quick touch)
                                      if (deltaX < 10 && deltaY < 10 && deltaTime < 300) {
                                        e.preventDefault();
                                        handlePointerDown(e, touchStartRef.current.pitch, touchStartRef.current.beat);
                                      }
                                      touchStartRef.current = null;
                                    }}
                              className={`flex-shrink-0 border-b relative cursor-pointer
                                ${isBarLine ? 'border-l-2 border-l-slate-600' : 'border-l border-l-slate-700/40'} 
                                hover:bg-slate-700/30
                              `}
                              style={{ 
                                width: CELL_WIDTH, 
                                height: CELL_HEIGHT,
                                backgroundColor: inLoopRegion && isLooping ? 'rgba(251, 191, 36, 0.15)' : (isCLine ? '#2A2A2A' : isSharpLine ? '#1A1A1A' : '#232323'),
                                borderBottomColor: '#404040'
                              }}
                            >
                              {notesAtPosition.map(({ voiceIndex, note }) => {
                                const duration = note.duration || DEFAULT_DURATION;
                                const noteWidth = duration * CELL_WIDTH - 4;
                                const nKey = getNoteKey(note.pitch, note.beat);
                                // Hide note only when actually dragging (ghost is showing)
                                const isBeingDragged = originalDragNotesRef.current?.keys.has(nKey) && dragState && (dragState.isDragging || dragOffset.beatDelta !== 0 || dragOffset.pitchDelta !== 0);

                                if (isBeingDragged) return null;

                                const noteVelocity = note.velocity ?? 0.8;
                                const velocityColor = voiceIndex === 0 ? getVelocityColor(noteVelocity) : NOTE_COLORS[voiceIndex];
                                const noteInLoop = loopStart !== null && loopEnd !== null && note.beat >= loopStart && note.beat < loopEnd;
                                
                                return (
                                  <div
                                    key={`${voiceIndex}-${note.beat.toFixed(3)}-${note.pitch}`}
                                    onMouseDown={(e) => {
                                              e.stopPropagation();
                                              console.log('[NoteGrid] Existing note mousedown', { pitch, beat, hasPendingNote: !!pendingNote });
                                              setPendingNote(null); // Clear any pending note when clicking existing note

                                              const coords = getEventCoords(e);
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const clickX = coords.clientX - rect.left;
                                              playNoteSound(pitch, note);

                                    if (clickX > rect.width - 10) {
                                                    const startDurations = {};
                                                    if (selectedNotes.has(nKey) && selectedNotes.size > 0) {
                                                      cantusFirmus.forEach(n => {
                                                        if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
                                                          startDurations[getNoteKey(n.pitch, n.beat)] = n.duration || DEFAULT_DURATION;
                                                        }
                                                      });
                                                    } else {
                                                      startDurations[nKey] = note.duration || DEFAULT_DURATION;
                                                    }
                                                    setResizeState({ startX: coords.clientX, startDurations });
                                    } else {
                                    // Determine which notes to drag BEFORE any state updates
                                    const wasSelected = selectedNotes.has(nKey);
                                    const keysToUse = wasSelected ? new Set(selectedNotes) : new Set([nKey]);

                                    // Capture notes to drag synchronously from current state
                                    const notesToStore = cantusFirmus.filter(n => keysToUse.has(getNoteKey(n.pitch, n.beat))).map(n => ({
                                      pitch: n.pitch,
                                      beat: n.beat,
                                      duration: n.duration || DEFAULT_DURATION,
                                      velocity: n.velocity
                                    }));

                                    // Store drag state with exact keys and notes
                                    originalDragNotesRef.current = {
                                      keys: new Set(notesToStore.map(n => getNoteKey(n.pitch, n.beat))),
                                      notes: notesToStore,
                                      shouldUpdateSelection: !wasSelected,
                                      shiftKey: e.shiftKey,
                                      targetKey: nKey
                                    };

                                              setDragState({
                                              startPitch: pitch,
                                              startBeat: beat,
                                              startPitchIndex: pitches.indexOf(pitch),
                                              currentPitchIndex: pitches.indexOf(pitch),
                                              currentBeat: beat,
                                              isDragging: false,
                                              clickOffsetX: coords.clientX,
                                              clickOffsetY: coords.clientY
                                              });
                                              console.log('[NoteGrid] Set drag state for existing note', { pitch, beat });
                                              setPendingNote(null); // Clear pending note when starting drag
                                              }
                                    }}
                                    onTouchStart={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                setPendingNote(null); // Clear any pending note when touching existing note

                                                                                const touch = e.touches[0];
                                                                                activeTouchIdRef.current = touch.identifier;
                                                                                const coords = { clientX: touch.clientX, clientY: touch.clientY };
                                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                                const clickX = coords.clientX - rect.left;
                                                                                playNoteSound(note.pitch, note);

                                                                                if (clickX > rect.width - 10) {
                                                                                  // Resize mode
                                                                                  const startDurations = {};
                                                                                  if (selectedNotes.has(nKey) && selectedNotes.size > 0) {
                                                                                    cantusFirmus.forEach(n => {
                                                                                      if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) {
                                                                                        startDurations[getNoteKey(n.pitch, n.beat)] = n.duration || DEFAULT_DURATION;
                                                                                      }
                                                                                    });
                                                                                  } else {
                                                                                    startDurations[nKey] = note.duration || DEFAULT_DURATION;
                                                                                  }
                                                                                  setResizeState({ startX: coords.clientX, startDurations });
                                                                                } else {
                                                                                  // Determine which notes to drag BEFORE any state updates
                                                                                  const keysToUse = selectedNotes.has(nKey) ? new Set(selectedNotes) : new Set([nKey]);

                                                                                  // Capture notes synchronously
                                                                                  const notesToStore = cantusFirmus
                                                                                    .filter(n => keysToUse.has(getNoteKey(n.pitch, n.beat)))
                                                                                    .map(n => ({ 
                                                                                      pitch: n.pitch,
                                                                                      beat: n.beat,
                                                                                      duration: n.duration || DEFAULT_DURATION,
                                                                                      velocity: n.velocity
                                                                                    }));

                                                                                  // Store drag state with exact keys
                                                                                  originalDragNotesRef.current = {
                                                                                    keys: new Set(notesToStore.map(n => getNoteKey(n.pitch, n.beat))),
                                                                                    notes: notesToStore
                                                                                  };

                                                                                  // Update selection after storing
                                                                                  if (!selectedNotes.has(nKey)) {
                                                                                    setSelectedNotes(new Set([nKey]));
                                                                                  }

                                                                                  setDragState({
                                                                                    startPitch: note.pitch,
                                                                                    startBeat: note.beat,
                                                                                    startPitchIndex: pitches.indexOf(note.pitch),
                                                                                    currentPitchIndex: pitches.indexOf(note.pitch),
                                                                                    currentBeat: note.beat,
                                                                                    isDragging: true,
                                                                                    clickOffsetX: coords.clientX,
                                                                                    clickOffsetY: coords.clientY
                                                                                  });
                                                                                  setPendingNote(null); // Clear pending note when starting drag
                                                                                  }
                                                                              }}
                                    className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${
                                      selectedNotes.has(nKey) ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : noteInLoop && isLooping ? 'ring-2 ring-amber-400/60' : ''
                                    }`}
                                    style={{ 
                                      left: `${(note.beat - Math.floor(note.beat)) * CELL_WIDTH + 2}px`,
                                      width: noteWidth,
                                      minWidth: 20,
                                      backgroundColor: velocityColor,
                                      boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${velocityColor}` : undefined,
                                      cursor: resizeState ? 'ew-resize' : 'grab',
                                      zIndex: 5
                                    }}
                                    >
                                    <span className="text-[10px] font-bold text-slate-900 pointer-events-none">
                                      {note.pitch.replace(/\d/, '')}
                                    </span>
                                    {((note.bendStart !== undefined && note.bendStart !== 0) || (note.bendEnd !== undefined && note.bendEnd !== 0)) && (
                                      <span className="text-[8px] text-slate-900/70 ml-0.5 pointer-events-none">↕</span>
                                    )}
                                    <div className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r" />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                        
                        {/* Spacer for beats after visible area */}
                        {visibleEndBeat < totalBeats && (
                          <div style={{ width: (totalBeats - visibleEndBeat) * CELL_WIDTH, flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Spacer for rows below visible area */}
                  {visibleEndRow < pitches.length && (
                    <div style={{ height: (pitches.length - visibleEndRow) * CELL_HEIGHT }} />
                  )}
                </>
              );
            })()}

            {/* Drag preview notes */}
                            {dragState && (dragState.isDragging || dragOffset.beatDelta !== 0 || dragOffset.pitchDelta !== 0) && originalDragNotesRef.current?.notes && (
                              <>
                                {originalDragNotesRef.current.notes.map(note => {
                                  const newPitchIdx = pitches.indexOf(note.pitch) + dragOffset.pitchDelta;
                                  const newBeat = note.beat + dragOffset.beatDelta;
                                  if (newPitchIdx < 0 || newPitchIdx >= pitches.length || newBeat < 0 || newBeat >= totalBeats) return null;

                                  const duration = note.duration || DEFAULT_DURATION;
                                  const noteWidth = duration * CELL_WIDTH - 4;
                                  const noteVelocity = note.velocity ?? 0.8;
                                  const velocityColor = getVelocityColor(noteVelocity);

                                  return (
                                    <div
                                      key={`preview-${note.pitch}-${note.beat}`}
                                      className="absolute rounded flex items-center justify-start pl-1 shadow-lg pointer-events-none z-10"
                                      style={{
                                        left: 56 + newBeat * CELL_WIDTH + 2,
                                        top: 28 + newPitchIdx * CELL_HEIGHT + 2,
                                        width: noteWidth,
                                        height: CELL_HEIGHT - 4,
                                        backgroundColor: velocityColor,
                                        opacity: 0.8
                                      }}
                                    >
                                      <span className="text-[10px] font-bold text-slate-900">
                                        {pitches[newPitchIdx].replace(/\d/, '')}
                                      </span>
                                    </div>
                                  );
                                })}
                              </>
                            )}
          </div>
        </div>

        {/* Playhead triangle marker - fixed at header top */}
        <div
          className="fixed cursor-ew-resize"
          style={{
            left: `${gridRef.current ? gridRef.current.getBoundingClientRect().left + 56 + smoothPlayhead * CELL_WIDTH - viewportState.scrollLeft : 0}px`,
            top: `${gridRef.current ? gridRef.current.getBoundingClientRect().top : 0}px`,
            width: 0,
            height: 0,
            pointerEvents: 'auto',
            zIndex: 51,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsScrubbing(true);

            const handleMouseMove = (moveEvent) => {
              if (!gridRef.current) return;
              const gridRect = gridRef.current.getBoundingClientRect();
              const scrollLeft = gridRef.current.scrollLeft;
              const x = moveEvent.clientX - gridRect.left - 56 + scrollLeft;
              let beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));

              // Apply snapping if enabled
              if (snapToGrid) {
                beat = Math.round(beat / quantizeGrid) * quantizeGrid;
              }

              setScrubPosition(beat);
              onSeek && onSeek(beat);
            };

            const handleMouseUp = () => {
              setIsScrubbing(false);
              setScrubPosition(null);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsScrubbing(true);

            const handleTouchMove = (moveEvent) => {
              if (!gridRef.current || !moveEvent.touches[0]) return;
              const gridRect = gridRef.current.getBoundingClientRect();
              const scrollLeft = gridRef.current.scrollLeft;
              const x = moveEvent.touches[0].clientX - gridRect.left - 56 + scrollLeft;
              let beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));

              // Apply snapping if enabled
              if (snapToGrid) {
                beat = Math.round(beat / quantizeGrid) * quantizeGrid;
              }

              setScrubPosition(beat);
              onSeek && onSeek(beat);
            };

            const handleTouchEnd = () => {
              setIsScrubbing(false);
              setScrubPosition(null);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          {/* Triangle marker pointing down */}
          <div 
            className="absolute"
            style={{
              left: '50%',
              top: '0px',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${Math.max(10, 12 * zoom)}px solid transparent`,
              borderRight: `${Math.max(10, 12 * zoom)}px solid transparent`,
              borderTop: `${Math.max(12, 14 * zoom)}px solid #ef4444`,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        </div>

                    {/* Playhead vertical line - scrolls with content */}
                                <div
                                  className="absolute z-30 pointer-events-none"
                                  style={{
                                    left: `${56 + smoothPlayhead * CELL_WIDTH}px`,
                                    top: 28,
                                    transform: 'translateX(-50%)',
                                    width: Math.max(2, 3 * zoom),
                                    height: pitches.length * CELL_HEIGHT,
                                    backgroundColor: '#ef4444',
                                    boxShadow: '0 0 8px rgba(239,68,68,0.6)'
                                  }}
                                />

        {/* Marquee selection rectangle */}
        {marquee && (
          <div
            className="fixed border-2 border-amber-400 bg-amber-400/10 pointer-events-none z-50"
            style={{
              left: Math.min(marquee.startX, marquee.endX),
              top: Math.min(marquee.startY, marquee.endY),
              width: Math.abs(marquee.endX - marquee.startX),
              height: Math.abs(marquee.endY - marquee.startY),
            }}
          />
        )}
        </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-700 px-2 sm:px-5 py-2 sm:py-3 min-h-[64px]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Left side - instrument and piano controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <InstrumentSelect 
            value={voices[0]?.instrument || 'organ'} 
            onChange={(v) => onVoiceInstrumentChange?.(0, v)}
            instruments={allInstruments}
            onCreateNew={onOpenWaveEditor}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="piano-toggle" className="text-xs text-white/70">Piano</Label>
            <Switch
              id="piano-toggle"
              checked={showPianoPanel}
              onCheckedChange={onTogglePianoPanel}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
          {showPianoPanel && onPopOut && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPopOut}
              className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-slate-700"
              title="Pop Out Piano"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Center - note controls */}
        {selectedNotes.size > 0 && (<div className="flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-amber-400 text-xs flex-shrink-0">{selectedNotes.size} selected</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-white/50 text-[10px]">Vel</span>
                <Slider
                  value={[(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return (firstSelected?.velocity ?? 0.8) * 125;
                  })()]}
                  onValueChange={([value]) => {
                    const velocity = value / 125;
                    const newNotes = cantusFirmus.map(n => 
                      selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                        ? { ...n, velocity } 
                        : n
                    );
                    onNotesUpdate(newNotes);
                  }}
                  onValueCommit={([value]) => {
                    saveToHistory(cantusFirmus);
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    if (firstSelected) {
                      initAudio();
                      const instrument = voices[0]?.instrument || 'organ';
                      playNote(firstSelected.pitch, 0.5, value / 125, 0, instrument);
                    }
                  }}
                  min={25}
                  max={125}
                  step={5}
                  className="w-16 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
                <span className="text-white/70 text-[10px] w-6">
                  {Math.round(((() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return (firstSelected?.velocity ?? 0.8) * 125;
                  })()))}
                </span>
              </div>
              <div className="w-px h-3 bg-slate-600" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-white/50 text-[10px]">Bend</span>
                <Slider
                  value={[(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return firstSelected?.bendStart ?? 0;
                  })()]}
                  onValueChange={([value]) => {
                    const newNotes = cantusFirmus.map(n => 
                      selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                        ? { ...n, bendStart: value } 
                        : n
                    );
                    onNotesUpdate(newNotes);
                  }}
                  onValueCommit={([value]) => {
                    saveToHistory(cantusFirmus);
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    if (firstSelected) {
                      initAudio();
                      const instrument = voices[0]?.instrument || 'organ';
                      const pitchBend = {
                        start: value,
                        end: firstSelected?.bendEnd ?? 0,
                        startTime: firstSelected?.bendStartTime ?? 0,
                        endTime: firstSelected?.bendEndTime ?? 1
                      };
                      playNote(firstSelected.pitch, 1.5, 0.7, 0, instrument, pitchBend);
                    }
                  }}
                  min={-12}
                  max={12}
                  step={0.1}
                  className="w-14 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
                <span className="text-white/70 text-[10px] w-7">
                  {(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    const bend = firstSelected?.bendStart ?? 0;
                    return bend > 0 ? `+${bend.toFixed(1)}` : bend.toFixed(1);
                  })()}
                </span>
                <span className="text-white/50 text-[10px]">→</span>
                <Slider
                  value={[(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return firstSelected?.bendEnd ?? 0;
                  })()]}
                  onValueChange={([value]) => {
                    const newNotes = cantusFirmus.map(n => 
                      selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                        ? { ...n, bendEnd: value } 
                        : n
                    );
                    onNotesUpdate(newNotes);
                  }}
                  onValueCommit={([value]) => {
                    saveToHistory(cantusFirmus);
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    if (firstSelected) {
                      initAudio();
                      const instrument = voices[0]?.instrument || 'organ';
                      const pitchBend = {
                        start: firstSelected?.bendStart ?? 0,
                        end: value,
                        startTime: firstSelected?.bendStartTime ?? 0,
                        endTime: firstSelected?.bendEndTime ?? 1
                      };
                      playNote(firstSelected.pitch, 1.5, 0.7, 0, instrument, pitchBend);
                    }
                  }}
                  min={-12}
                  max={12}
                  step={0.1}
                  className="w-14 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
                <span className="text-white/70 text-[10px] w-7">
                  {(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    const bend = firstSelected?.bendEnd ?? 0;
                    return bend > 0 ? `+${bend.toFixed(1)}` : bend.toFixed(1);
                  })()}
                </span>
              </div>
              <div className="w-px h-3 bg-slate-600" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-white/50 text-[10px]">T:</span>
                <Slider
                  value={[(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return (firstSelected?.bendStartTime ?? 0) * 100;
                  })()]}
                  onValueChange={([value]) => {
                    const newNotes = cantusFirmus.map(n => 
                      selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                        ? { ...n, bendStartTime: value / 100 } 
                        : n
                    );
                    onNotesUpdate(newNotes);
                  }}
                  onValueCommit={([value]) => {
                    saveToHistory(cantusFirmus);
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    if (firstSelected) {
                      initAudio();
                      const instrument = voices[0]?.instrument || 'organ';
                      const pitchBend = {
                        start: firstSelected?.bendStart ?? 0,
                        end: firstSelected?.bendEnd ?? 0,
                        startTime: value / 100,
                        endTime: firstSelected?.bendEndTime ?? 1
                      };
                      playNote(firstSelected.pitch, 1.5, 0.7, 0, instrument, pitchBend);
                    }
                  }}
                  min={0}
                  max={100}
                  step={5}
                  className="w-12 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
                <span className="text-white/70 text-[10px] w-6">
                  {(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return `${Math.round((firstSelected?.bendStartTime ?? 0) * 100)}`;
                  })()}
                </span>
                <span className="text-white/50 text-[10px]">→</span>
                <Slider
                  value={[(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return (firstSelected?.bendEndTime ?? 1) * 100;
                  })()]}
                  onValueChange={([value]) => {
                    const newNotes = cantusFirmus.map(n => 
                      selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                        ? { ...n, bendEndTime: value / 100 } 
                        : n
                    );
                    onNotesUpdate(newNotes);
                  }}
                  onValueCommit={([value]) => {
                    saveToHistory(cantusFirmus);
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    if (firstSelected) {
                      initAudio();
                      const instrument = voices[0]?.instrument || 'organ';
                      const pitchBend = {
                        start: firstSelected?.bendStart ?? 0,
                        end: firstSelected?.bendEnd ?? 0,
                        startTime: firstSelected?.bendStartTime ?? 0,
                        endTime: value / 100
                      };
                      playNote(firstSelected.pitch, 1.5, 0.7, 0, instrument, pitchBend);
                    }
                  }}
                  min={0}
                  max={100}
                  step={5}
                  className="w-12 h-8 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
                <span className="text-white/70 text-[10px] w-6">
                  {(() => {
                    const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                    return `${Math.round((firstSelected?.bendEndTime ?? 1) * 100)}`;
                  })()}
                  </span>
                  </div>
                  </div>
                  </div></div>
                  )}
                  </div>

                  {/* Audio Visualizer - right side */}
                  <div className="flex-shrink-0 bg-[#1A1A1A] rounded-lg border border-[#3A3A3A] p-1.5 hidden sm:block w-48 h-10">
                  <canvas 
                  ref={canvasRef}
                  className="rounded w-full h-full block"
                  />
                  </div>
                  </div>

                  {/* Minimap - positioned absolutely */}
      <div className={`absolute right-8 z-50 ${showPianoPanel ? 'bottom-[273px]' : 'bottom-[89px]'}`}>
        <ScoreMinimap
          notes={cantusFirmus}
          totalBeats={totalBeats}
          totalPitches={pitches.length}
          viewportStart={Math.floor(viewportState.scrollLeft / CELL_WIDTH)}
          viewportEnd={Math.floor((viewportState.scrollLeft + (gridRef.current?.clientWidth || 400) - 56) / CELL_WIDTH)}
          viewportPitchStart={Math.floor(viewportState.scrollTop / CELL_HEIGHT)}
          viewportPitchEnd={Math.floor((viewportState.scrollTop + (gridRef.current?.clientHeight || 300) - 28) / CELL_HEIGHT)}
          currentBeat={currentBeat}
          onSeek={(beat) => {
            onSeek?.(beat);
            if (gridRef.current) {
              gridRef.current.scrollLeft = beat * CELL_WIDTH - 100;
            }
          }}
          pitches={pitches}
        />
      </div>
      </div>
      );
}