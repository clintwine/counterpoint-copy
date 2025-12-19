import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MousePointer2, Square, Trash2, Copy, ClipboardPaste, Undo, Redo, Pencil, FileAudio, ZoomIn, ZoomOut, Guitar, ChevronDown } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { initAudio, playNote } from './audioEngine';
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
  0: '#E8B885', // Voice 1 - Gold
  1: '#7B9E89', // Voice 2 - Sage
  2: '#9B8AA6', // Voice 3 - Lavender
  3: '#A68B7B', // Voice 4 - Warm brown
};

// Velocity to color gradient: blue → green → yellow → red
const getVelocityColor = (velocity) => {
  const v = Math.max(0, Math.min(1, velocity)); // Clamp between 0 and 1
  
  if (v < 0.33) {
    // Blue to Green
    const t = v / 0.33;
    const r = Math.round(0 + t * 0);
    const g = Math.round(100 + t * 155);
    const b = Math.round(255 - t * 55);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (v < 0.66) {
    // Green to Yellow
    const t = (v - 0.33) / 0.33;
    const r = Math.round(0 + t * 255);
    const g = Math.round(255);
    const b = Math.round(200 - t * 200);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red
    const t = (v - 0.66) / 0.34;
    const r = Math.round(255);
    const g = Math.round(255 - t * 100);
    const b = Math.round(0);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const BASE_CELL_WIDTH = 48;
const BASE_CELL_HEIGHT = 28;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const MIN_DURATION = 0.25; // Quarter of a beat
const DEFAULT_DURATION = 1; // One beat

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

const ALL_INSTRUMENTS = [...DEFAULT_INSTRUMENTS, ...PRESET_LIBRARY];

function InstrumentSelect({ value, onChange, instruments, onCreateNew }) {
  const [open, setOpen] = React.useState(false);
  const selected = instruments.find(i => i.value === value);
  
  return (
    <div className="flex items-center gap-2">
      <Guitar className="w-4 h-4 text-white/60" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-28 h-8 justify-between bg-slate-700 border-slate-600 text-white text-xs hover:bg-slate-600"
          >
            {selected?.label || 'Select...'}
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0 bg-slate-800 border-slate-700">
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
                    className="text-white text-xs cursor-pointer"
                  >
                    {inst.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
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
    onLoopChange
  }) {
    // Use smooth playhead position if available, otherwise fall back to currentBeat
    const smoothPlayhead = playheadPosition !== undefined ? playheadPosition : currentBeat;
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const timeSigConfig = TIME_SIGNATURES.find(t => t.value === timeSignature) || TIME_SIGNATURES[0];
  const beatsPerMeasure = timeSigConfig.beatsPerMeasure;
  const totalBeats = measures * beatsPerMeasure;

  const [zoom, setZoom] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const CELL_WIDTH = BASE_CELL_WIDTH * zoom;
  const CELL_HEIGHT = BASE_CELL_HEIGHT * zoomY;

  const [tool, setTool] = useState('select'); // 'select', 'marquee', 'draw'
    const [paintMode, setPaintMode] = useState(false); // When false, draw tool only adds one note per click
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [marquee, setMarquee] = useState(null);

  const getNoteKey = useCallback((pitch, beat) => `${pitch}-${beat}`, []);
  
  // Memoize notes lookup for performance
  const notesMap = useMemo(() => {
    const map = new Map();
    cantusFirmus.forEach(note => {
      const key = `${note.pitch}-${note.beat}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ voiceIndex: 0, note });
    });
    voices.forEach((voice, voiceIndex) => {
      if (!voice.notes) return;
      voice.notes.forEach(note => {
        const key = `${note.pitch}-${note.beat}`;
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
  const [clipboard, setClipboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLoopSelecting, setIsLoopSelecting] = useState(false);
  const [loopSelectStart, setLoopSelectStart] = useState(null);
  const [viewportState, setViewportState] = useState({ scrollLeft: 0, scrollTop: 0, height: 400, width: 800 });
  const [pinchState, setPinchState] = useState(null);
  const lastTapRef = useRef({ key: null, time: 0 });
  const touchStartRef = useRef(null); // Track touch start for scroll detection
  const activeTouchIdRef = useRef(null); // Track which touch is active for dragging

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

  // Use pre-generated pitches
      const pitches = ALL_PITCHES;

  // Scroll to keep playhead visible during playback (not while scrubbing)
    useEffect(() => {
      if (gridRef.current && isPlaying && !isScrubbing) {
        if (smoothPlayhead === 0) {
          // Reset scroll to beginning
          gridRef.current.scrollLeft = 0;
        } else {
          const containerWidth = gridRef.current.clientWidth - 56; // subtract pitch label width
          const playheadPixelPosition = smoothPlayhead * CELL_WIDTH;
          const currentScroll = gridRef.current.scrollLeft;

          // Keep playhead in the middle third of the visible area
          const leftThreshold = currentScroll + containerWidth * 0.3;
          const rightThreshold = currentScroll + containerWidth * 0.7;

          if (playheadPixelPosition > rightThreshold || playheadPixelPosition < leftThreshold) {
            gridRef.current.scrollLeft = Math.max(0, playheadPixelPosition - containerWidth * 0.3);
          }
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
  const playNoteSound = useCallback((pitch) => {
    initAudio();
    const instrument = voices[activeVoice]?.instrument || 'organ';
    playNote(pitch, 0.3, 0.6, 0, instrument);
  }, [voices, activeVoice]);

  const selectAll = useCallback(() => {
    const allKeys = new Set(cantusFirmus.map(n => getNoteKey(n.pitch, n.beat)));
    setSelectedNotes(allKeys);
  }, [cantusFirmus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copySelected();
      } else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
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
    
    const beat = Math.floor(x / CELL_WIDTH);
    const pitchIndex = Math.floor(y / CELL_HEIGHT);
    
    if (beat >= 0 && beat < totalBeats && pitchIndex >= 0 && pitchIndex < pitches.length) {
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
          // Prevent double-tap from adding then immediately removing a note
          const now = Date.now();
          const isDoubleTap = lastTapRef.current.key === noteKey && now - lastTapRef.current.time < 300;
          lastTapRef.current = { key: noteKey, time: now };
          
          if (!isDoubleTap) {
            // Draw mode - add/remove note
            if (hasNote) {
              const newNotes = cantusFirmus.filter(n => !(n.pitch === pitch && n.beat === beat));
              saveToHistory(newNotes);
              onNotesUpdate(newNotes);
            } else {
              // Add the note
              const newNotes = [...cantusFirmus, { pitch, beat, duration: DEFAULT_DURATION, velocity: 0.8 }].sort((a, b) => a.beat - b.beat);
              saveToHistory(newNotes);
              onNotesUpdate(newNotes);
              // Play the note with proper duration for feedback
              initAudio();
              const instrument = voices[0]?.instrument || 'organ';
              playNote(pitch, 0.5, 0.7, 0, instrument);
            }

            // Clear selection after adding/removing note so it doesn't interfere with playback
            setSelectedNotes(new Set());

            // Only enable painting mode if paintMode is on
            if (paintMode) {
              setIsPainting(true);
              paintedNotesRef.current = new Set([noteKey]);
            }
          }
        } else if (tool === 'select') {
          if (hasNote) {
            // Note click is handled by the note element itself
            return;
          } else {
            // Click on empty cell - deselect or add note
            if (!e.shiftKey) {
              setSelectedNotes(new Set());
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

                // Handle painting in draw mode (only if paintMode is enabled)
                if (isPainting && tool === 'draw' && paintMode) {
              const cell = getCellFromPosition(coords.clientX, coords.clientY);
              if (cell) {
                const noteKey = getNoteKey(cell.pitch, cell.beat);
                const hasNote = cantusFirmus.some(n => n.pitch === cell.pitch && n.beat === cell.beat);

                // Only add if not already painted in this stroke and no existing note
                if (!paintedNotesRef.current.has(noteKey) && !hasNote) {
                  paintedNotesRef.current.add(noteKey);
                  const newNotes = [...cantusFirmus, { pitch: cell.pitch, beat: cell.beat, duration: DEFAULT_DURATION, velocity: 0.8 }].sort((a, b) => a.beat - b.beat);
                  onNotesUpdate(newNotes);
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
          const newDuration = Math.max(MIN_DURATION, Math.round((startDuration + deltaDuration) * 4) / 4);
          return { ...n, duration: newDuration };
        }
        return n;
      });
      onNotesUpdate(newNotes);
    } else if (marquee) {
            setMarquee(prev => ({ ...prev, endX: coords.clientX, endY: coords.clientY }));
          } else if (dragState && selectedNotes.size > 0) {
            // Calculate delta from original click position for smooth dragging
            const deltaX = coords.clientX - dragState.clickOffsetX;
            const deltaY = coords.clientY - dragState.clickOffsetY;
      
      const beatDelta = Math.round(deltaX / CELL_WIDTH);
      const pitchDelta = Math.round(deltaY / CELL_HEIGHT);
      
      const newPitchIndex = dragState.startPitchIndex + pitchDelta;
      const newBeat = dragState.startBeat + beatDelta;
      
      const prevPitchIndex = dragState.currentPitchIndex;

      // Play note sound when pitch changes during drag
      if (dragState.isDragging && newPitchIndex !== prevPitchIndex && newPitchIndex >= 0 && newPitchIndex < pitches.length) {
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
        isDragging: true
      }));
    }
  };

  const handlePointerUp = () => {
        // Save history after painting stroke
        if (isPainting && paintedNotesRef.current.size > 0) {
          saveToHistory(cantusFirmus);
        }
        setIsPainting(false);
        paintedNotesRef.current.clear();

        if (resizeState) {
      // Save to history after resize
      saveToHistory(cantusFirmus);
      setResizeState(null);
      return;
    }
    
    if (marquee) {
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
          if (note.beat >= minBeat && note.beat <= maxBeat && 
              pitchIdx >= minPitchIdx && pitchIdx <= maxPitchIdx) {
            newSelected.add(getNoteKey(note.pitch, note.beat));
          }
        });
        setSelectedNotes(newSelected);
      }
      setMarquee(null);
    } else if (dragState && originalDragNotesRef.current) {
      // Apply drag only if actually moved
      const pitchDelta = dragState.currentPitchIndex - dragState.startPitchIndex;
      const beatDelta = dragState.currentBeat - dragState.startBeat;

      const originalNotes = originalDragNotesRef.current.notes;
      const draggedKeys = originalDragNotesRef.current.keys;

      // Only apply drag if there was actual movement AND dragging was initiated
      if (originalNotes && originalNotes.length > 0 && dragState.isDragging && (pitchDelta !== 0 || beatDelta !== 0)) {
        // Remove original notes and add moved notes at new positions
        const notesWithoutDragged = cantusFirmus.filter(n => !draggedKeys.has(getNoteKey(n.pitch, n.beat)));

        const movedNotes = originalNotes.map(n => {
          const origPitchIdx = pitches.indexOf(n.pitch);
          const newPitchIdx = Math.max(0, Math.min(pitches.length - 1, origPitchIdx + pitchDelta));
          const newBeat = Math.max(0, Math.min(totalBeats - 1, n.beat + beatDelta));
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
        <div className="bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-600 w-full overflow-hidden max-w-full">
          {/* Playback Controls - embedded at top */}
          {playbackControls}

          {/* Toolbar */}
                      <div className="flex items-center justify-between px-2 sm:px-5 py-2 sm:py-3 border-b border-slate-700 overflow-x-auto">
        <div className="flex items-center gap-1">
          <Button
            variant={tool === 'select' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('select')}
            className={`h-8 px-2 ${tool === 'select' ? 'bg-amber-500 text-slate-900' : 'text-white/70'}`}
            title="Select (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </Button>
          <Button
            variant={tool === 'marquee' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTool('marquee')}
            className={`h-8 px-2 ${tool === 'marquee' ? 'bg-amber-500 text-slate-900' : 'text-white/70'}`}
            title="Marquee (M)"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
                        variant={tool === 'draw' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTool('draw')}
                        className={`h-8 px-2 ${tool === 'draw' ? 'bg-amber-500 text-slate-900' : 'text-white/70'}`}
                        title="Draw (B)"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      {tool === 'draw' && (
                        <Button
                          variant={paintMode ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setPaintMode(!paintMode)}
                          className={`h-8 px-2 text-xs ${paintMode ? 'bg-amber-500/80 text-slate-900' : 'text-white/70 border border-slate-600'}`}
                          title="Paint mode - drag to add multiple notes"
                        >
                          Paint
                        </Button>
                      )}
          
          <div className="w-px h-5 bg-slate-600 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-slate-600 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copySelected}
            disabled={selectedNotes.size === 0}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Copy (Ctrl+C)"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => paste()}
            disabled={clipboard.length === 0}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteSelected}
            disabled={selectedNotes.size === 0}
            className="h-8 px-2 text-white/70 hover:text-red-400 disabled:opacity-30"
            title="Delete (Del)"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-slate-600 mx-2" />

          {/* Instrument for cantus firmus (voice being edited) */}
                        <InstrumentSelect 
                          value={voices[0]?.instrument || 'organ'} 
                          onChange={(v) => onVoiceInstrumentChange?.(0, v)}
                          instruments={ALL_INSTRUMENTS}
                          onCreateNew={onOpenWaveEditor}
                        />

          <div className="w-px h-5 bg-slate-600 mx-2" />

          {/* Zoom controls */}
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
          </div>

          <div 
                  ref={gridRef}
                  className="overflow-auto max-h-[50vh] sm:max-h-[400px] relative select-none mx-2 sm:mx-5"
                style={{ 
                  scrollbarWidth: 'thin', 
                  scrollbarColor: '#475569 transparent',
                  touchAction: tool === 'marquee' ? 'none' : 'auto'
                }}
        onMouseMove={handlePointerMove}
                      onMouseUp={handlePointerUp}
                      onMouseLeave={handlePointerUp}
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
        onScroll={(e) => setViewportState(prev => ({ ...prev, scrollLeft: e.target.scrollLeft, scrollTop: e.target.scrollTop }))}
      >
        <div className="inline-flex min-w-full" ref={containerRef}>
          {/* Pitch labels - fixed column on left, allows vertical scrolling */}
                                      <div className="sticky left-0 z-20 flex-shrink-0" style={{ backgroundColor: 'rgb(30, 41, 59)' }}>
                                        <div className="h-7 border-b border-slate-600 bg-slate-800 sticky top-0 z-30" />
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
                                                                            style={{ height: CELL_HEIGHT, backgroundColor: isPianoPressed ? 'rgba(251, 191, 36, 0.4)' : isC ? 'rgba(251, 191, 36, 0.15)' : isSharp ? 'rgba(0,0,0,0.2)' : 'rgb(30, 41, 59)' }}
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
                              className="flex h-7 border-b border-slate-600 select-none sticky top-0 z-10 bg-slate-800"
                              onMouseDown={(e) => {
                                const beat = getBeatFromHeaderPosition(e.clientX);
                                if (beat === null) return;

                                // Start loop selection on any mousedown
                                setIsLoopSelecting(true);
                                setLoopSelectStart(beat);
                                if (onLoopChange) {
                                  onLoopChange(beat, beat);
                                }
                              }}
                              onMouseMove={(e) => {
                                const beat = getBeatFromHeaderPosition(e.clientX);
                                if (beat === null) return;

                                if (isLoopSelecting && loopSelectStart !== null) {
                                  const start = Math.min(loopSelectStart, beat);
                                  const end = Math.max(loopSelectStart, beat);
                                  if (onLoopChange) {
                                    onLoopChange(start, end);
                                  }
                                }
                              }}
                              onMouseUp={(e) => {
                                const beat = getBeatFromHeaderPosition(e.clientX);
                                // If no drag occurred (same beat), seek instead of setting loop
                                if (beat !== null && loopSelectStart === beat && onSeek) {
                                  onSeek(beat);
                                }
                                setIsLoopSelecting(false);
                                setLoopSelectStart(null);
                              }}
                              onMouseLeave={() => {
                                setIsLoopSelecting(false);
                                setLoopSelectStart(null);
                              }}
                            >
                              {Array.from({ length: totalBeats }).map((_, beat) => {
                                const inLoopRegion = loopStart !== null && loopEnd !== null && beat >= loopStart && beat <= loopEnd;
                                return (
                                  <div 
                                    key={beat}
                                    className={`flex-shrink-0 flex items-center justify-center text-xs font-medium border-r pointer-events-none ${
                                      beat % beatsPerMeasure === 0 
                                        ? 'border-r-slate-500 bg-slate-700/50 text-amber-400' 
                                        : 'border-r-slate-700 text-white/60'
                                    } ${inLoopRegion ? 'bg-amber-500/30' : ''}`}
                                    style={{ width: CELL_WIDTH }}
                                  >
                                    {beat % beatsPerMeasure === 0 ? Math.floor(beat / beatsPerMeasure) + 1 : ''}
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
                          const isBarLine = beat % beatsPerMeasure === 0;
                          const noteKey = getNoteKey(pitch, beat);
                          const isSelected = selectedNotes.has(noteKey);
                          const notesAtPosition = notesMap.get(`${pitch}-${beat}`) || [];
                          const isCurrentBeat = currentBeat === beat;

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
                              className={`flex-shrink-0 border-r border-b relative cursor-pointer
                                ${isBarLine ? 'border-r-slate-500' : 'border-r-slate-700'} 
                                ${isCLine ? 'border-b-slate-500 bg-amber-400/5' : isSharpLine ? 'border-b-slate-700 bg-black/20' : 'border-b-slate-700'}
                                hover:bg-slate-700/50
                              `}
                              style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                            >
                              {notesAtPosition.map(({ voiceIndex, note }) => {
                                const duration = note.duration || DEFAULT_DURATION;
                                const noteWidth = duration * CELL_WIDTH - 4;
                                const nKey = getNoteKey(note.pitch, note.beat);
                                const isBeingDragged = selectedNotes.has(nKey) && dragState?.isDragging;
                                
                                if (isBeingDragged) return null;
                                
                                const noteVelocity = note.velocity ?? 0.8;
                                const velocityColor = voiceIndex === 0 ? getVelocityColor(noteVelocity) : NOTE_COLORS[voiceIndex];
                                
                                return (
                                  <div
                                    key={`${voiceIndex}-${note.beat}-${note.pitch}`}
                                    onMouseDown={(e) => {
                                                e.stopPropagation();

                                                const coords = getEventCoords(e);
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const clickX = coords.clientX - rect.left;
                                                playNoteSound(pitch);

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

                                    // Capture notes to drag synchronously
                                    const notesToStore = cantusFirmus.filter(n => keysToUse.has(getNoteKey(n.pitch, n.beat))).map(n => ({
                                      pitch: n.pitch,
                                      beat: n.beat,
                                      duration: n.duration || DEFAULT_DURATION,
                                      velocity: n.velocity
                                    }));

                                    // Clear previous drag state and store new one
                                    originalDragNotesRef.current = {
                                      keys: new Set(notesToStore.map(n => getNoteKey(n.pitch, n.beat))),
                                      notes: notesToStore
                                    };

                                    // Update selection after storing notes
                                    if (!wasSelected && !e.shiftKey) {
                                      setSelectedNotes(new Set([nKey]));
                                    } else if (!wasSelected && e.shiftKey) {
                                      setSelectedNotes(prev => new Set([...prev, nKey]));
                                    }

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
                                    }
                                    }}
                                    onTouchStart={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();

                                                                                const touch = e.touches[0];
                                                                                activeTouchIdRef.current = touch.identifier;
                                                                                const coords = { clientX: touch.clientX, clientY: touch.clientY };
                                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                                const clickX = coords.clientX - rect.left;
                                                                                playNoteSound(note.pitch);

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
                                                                                }
                                                                              }}
                                    className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${
                                      selectedNotes.has(nKey) ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                                    }`}
                                    style={{ 
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
                            {dragState?.isDragging && selectedNotes.size > 0 && originalDragNotesRef.current?.notes && (
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

        {/* Playhead triangle marker - fixed at top */}
        <div
          className="absolute cursor-ew-resize"
          style={{
            left: `${56 + smoothPlayhead * CELL_WIDTH}px`,
            top: 28,
            width: 0,
            height: 0,
            pointerEvents: 'auto',
            zIndex: 50,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsScrubbing(true);
            const startX = e.clientX;
            const startBeat = currentBeat;

            const handleMouseMove = (moveEvent) => {
              const deltaX = moveEvent.clientX - startX;
              const beatDelta = Math.round(deltaX / CELL_WIDTH);
              const newBeat = Math.max(0, Math.min(totalBeats - 1, startBeat + beatDelta));
              onSeek && onSeek(newBeat);
            };

            const handleMouseUp = () => {
              setIsScrubbing(false);
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
            const startX = e.touches[0].clientX;
            const startBeat = currentBeat;

            const handleTouchMove = (moveEvent) => {
              const deltaX = moveEvent.touches[0].clientX - startX;
              const beatDelta = Math.round(deltaX / CELL_WIDTH);
              const newBeat = Math.max(0, Math.min(totalBeats - 1, startBeat + beatDelta));
              onSeek && onSeek(newBeat);
            };

            const handleTouchEnd = () => {
              setIsScrubbing(false);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          {/* Triangle marker pointing down */}
          <div 
            className="absolute bottom-0"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${Math.max(8, 10 * zoom)}px solid transparent`,
              borderRight: `${Math.max(8, 10 * zoom)}px solid transparent`,
              borderTop: `${Math.max(10, 12 * zoom)}px solid #ef4444`
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
      
      <div className="flex items-center justify-between px-2 sm:px-5 py-2 sm:py-3 border-t border-slate-700 flex-wrap gap-2">
      <p className="text-white/50 text-xs">
        {tool === 'select' && 'Click notes to select, drag to move • Shift+click for multi-select • Drag header to set loop'}
        {tool === 'marquee' && 'Click and drag to select multiple notes • Drag header to set loop'}
        {tool === 'draw' && 'Click to add/remove notes • Drag header to set loop'}
      </p>
      <div className="flex items-center gap-3">
        {selectedNotes.size > 0 && (
          <>
            <span className="text-amber-400 text-xs">{selectedNotes.size} selected</span>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs">Velocity:</span>
              <Slider
                value={[(() => {
                  const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                  return (firstSelected?.velocity ?? 0.8) * 100;
                })()]}
                onValueChange={([value]) => {
                  const velocity = value / 100;
                  const newNotes = cantusFirmus.map(n => 
                    selectedNotes.has(getNoteKey(n.pitch, n.beat)) 
                      ? { ...n, velocity } 
                      : n
                  );
                  onNotesUpdate(newNotes);
                }}
                onValueCommit={([value]) => {
                  saveToHistory(cantusFirmus);
                }}
                min={20}
                max={100}
                step={5}
                className="w-24 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5"
              />
              <span className="text-white/70 text-xs w-8 text-right">
                {Math.round(((() => {
                  const firstSelected = cantusFirmus.find(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                  return (firstSelected?.velocity ?? 0.8) * 100;
                })()))}
              </span>
            </div>
          </>
        )}
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
      </div>
      );
}