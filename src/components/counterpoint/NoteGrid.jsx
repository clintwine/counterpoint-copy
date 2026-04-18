import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MousePointer2, Square, Trash2, Copy, ClipboardPaste, Undo, Redo, Pencil, FileAudio, ZoomIn, ZoomOut, Guitar, ChevronDown, Keyboard, Grid3x3, MoreVertical, FileText, FolderOpen, Save, Download, Sparkles, RefreshCw, Music, ExternalLink, Volume2, Check, FilePlus, Menu, LogIn, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { initAudio, playNote, getAnalyser, playNoteWithCustomInstrument, playNoteSustain, stopNoteSustain } from './audioEngine';
import ScoreMinimap from './ScoreMinimap.jsx';
import NoteControls from './NoteControls.jsx';
import GridOverlays from './GridOverlays.jsx';
import MeasureHeader from './MeasureHeader.jsx';
import Scrubber from './Scrubber.jsx';
import { DEFAULT_INSTRUMENTS } from './instrumentsList';
import { useNoteGridKeyboard } from './useNoteGridKeyboard';
import { useAudioVisualizer } from './useAudioVisualizer';

import { TIME_SIGNATURES, NOTE_COLORS, getVelocityColor, BASE_CELL_WIDTH, BASE_CELL_HEIGHT, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, MIN_DURATION, DEFAULT_DURATION, ALL_PITCHES } from './gridConstants';

import { PRESET_LIBRARY_CONFIGS, PRESET_LIBRARY } from './presetLibrary';
import InstrumentSelect from './InstrumentSelectComponent';

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
              chatbotActive = false,
              projectName = '',
              currentUser
            }) {
  const gridRef = useRef(null);
  const headerScrollRef = useRef(null);
  const headerRef = useRef(null);
  const scrubberRef = useRef(null);
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
  const [resizeState, setResizeState] = useState(null); // For resizing note duration (supports group resize, left or right edge)
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
  const [lastNoteVelocity, setLastNoteVelocity] = useState(0.8); // Track last used velocity
  const [hoveredCell, setHoveredCell] = useState(null); // Track hovered cell for piano highlighting
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const autoScrollRef = useRef(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const pianoSustainRef = useRef(null); // Track sustained piano note
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const lastPianoPitchRef = useRef(null);

  // Use pre-generated pitches (must be before useEffects that use it)
  const pitches = ALL_PITCHES;

  // Detect window size changes (including fullscreen)
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
      console.log('[NoteGrid] Window height:', window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check initial
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Consider fullscreen if window height is very large
  const isFullscreen = windowHeight > 900;

  // Audio visualizer
  useAudioVisualizer(canvasRef);

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

  const paste = useCallback((atBeat = null) => {
    if (clipboard.length === 0) return;
    
    // If no beat specified, paste at current playhead or after existing notes
    let targetBeat = atBeat;
    if (targetBeat === null) {
      if (cantusFirmus.length > 0) {
        // Paste after the last note
        const lastBeat = Math.max(...cantusFirmus.map(n => n.beat + (n.duration || 1)));
        targetBeat = Math.ceil(lastBeat);
      } else {
        // No notes - paste at playhead or beat 0
        targetBeat = currentBeat || 0;
      }
    }
    
    const newNotes = [...cantusFirmus];
    const pastedNotes = [];
    clipboard.forEach(note => {
      const finalBeat = note.beat + targetBeat;
      if (finalBeat < totalBeats) {
        // Allow multiple notes per beat - just add it
        const exists = newNotes.some(n => n.beat === finalBeat && n.pitch === note.pitch);
        if (!exists) {
          const pastedNote = { 
            pitch: note.pitch, 
            beat: finalBeat,
            duration: note.duration || DEFAULT_DURATION,
            velocity: note.velocity ?? 0.8
          };
          newNotes.push(pastedNote);
          pastedNotes.push(pastedNote);
        }
      }
    });
    
    const sorted = newNotes.sort((a, b) => a.beat - b.beat);
    saveToHistory(sorted);
    onNotesUpdate(sorted);
    
    // Select the pasted notes and scroll to them
    const pastedKeys = new Set(pastedNotes.map(n => getNoteKey(n.pitch, n.beat)));
    setSelectedNotes(pastedKeys);
    
    if (pastedNotes.length > 0 && scrollToBeatRef?.current) {
      scrollToBeatRef.current(targetBeat);
    }
  }, [clipboard, cantusFirmus, totalBeats, onNotesUpdate, saveToHistory, currentBeat, scrollToBeatRef]);

  // Get custom instrument config if needed
  const getInstrumentConfig = useCallback((instrumentValue) => {
    if (instrumentValue.startsWith('custom_')) {
      const index = parseInt(instrumentValue.split('_')[1]);
      return customInstruments[index];
    }
    if (instrumentValue.startsWith('preset_')) {
      const index = parseInt(instrumentValue.split('_')[1]);
      return PRESET_LIBRARY_CONFIGS[index];
    }
    return null;
  }, [customInstruments]);

  // Play note sound when adding
  const playNoteSound = useCallback(async (pitch, note = null) => {
    await initAudio();
    const instrument = voices[activeVoice]?.instrument || 'organ';
    const customConfig = getInstrumentConfig(instrument);
    
    const hasBend = note?.bendStart !== undefined || note?.bendEnd !== undefined;
    const pitchBend = hasBend ? {
      start: note.bendStart ?? 0,
      end: note.bendEnd ?? 0,
      startTime: note.bendStartTime ?? 0,
      endTime: note.bendEndTime ?? 1
    } : 0;
    // Calculate actual duration based on note duration and tempo
    const sixteenthNoteDuration = (60 / tempo) / 4;
    const actualDuration = note?.duration ? (note.duration * sixteenthNoteDuration) : (hasBend ? 1.5 : 0.3);
    const velocity = note?.velocity ?? 0.7;
    
    // Use custom instrument if available
    if (customConfig) {
      playNoteWithCustomInstrument(pitch, actualDuration, velocity, customConfig, note?.articulation || 'normal', tempo, pitchBend);
    } else if (note?.articulation && note.articulation !== 'normal') {
      // Use articulation if present
      import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => {
        playNoteWithArticulation(pitch, actualDuration, velocity, 0, instrument, note.articulation, tempo, pitchBend);
      });
    } else {
      playNote(pitch, actualDuration, velocity, 0, instrument, pitchBend);
    }
  }, [voices, activeVoice, tempo, customInstruments, getInstrumentConfig]);

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
        uniqueNotes.filter(n => {
          const originalKey = getNoteKey(n.pitch, n.beat);
          const wasSelected = notesToQuantize.some(orig => orig.pitch === n.pitch);
          return wasSelected;
        }).map(n => getNoteKey(n.pitch, n.beat))
      );
      setSelectedNotes(newSelectedKeys);
    }

    saveToHistory(uniqueNotes);
    onNotesUpdate(uniqueNotes);
  }, [selectedNotes, cantusFirmus, onNotesUpdate, saveToHistory, quantizeGrid, getNoteKey]);

  // Global mouse up to stop piano note
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingPiano(false);
      lastPianoPitchRef.current = null;
      if (pianoSustainRef.current) {
        stopNoteSustain(pianoSustainRef.current, 0.3);
        pianoSustainRef.current = null;
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []); // No dependencies - use refs for current values

  // Keyboard shortcuts (extracted to hook)
  useNoteGridKeyboard({ deleteSelected, copySelected, paste, selectAll, undo, redo, quantize, onSeek, loopStart, loopEnd, isLooping, setSelectedNotes, setMarquee, selectedNotes, cantusFirmus, getNoteKey, pitches, totalBeats, saveToHistory, onNotesUpdate, setZoom, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP });

  // Tool shortcut keys (v/m/b) and prevent space from triggering buttons
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Prevent space bar from triggering focused buttons
      if (e.key === ' ' && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) {
        e.preventDefault();
        return;
      }
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) setTool('select');
      else if (e.key === 'm') setTool('marquee');
      else if (e.key === 'b') setTool('draw');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getBeatFromHeaderPosition = (clientX) => {
    if (!headerScrollRef.current) return null;
    const headerRect = headerScrollRef.current.getBoundingClientRect();
    const scrollLeft = headerScrollRef.current.scrollLeft;
    const x = clientX - headerRect.left + scrollLeft;
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
    const x = clientX - gridRect.left + scrollLeft; // Only account for scroll, pitch label is part of grid
    const y = clientY - gridRect.top + scrollTop; // Only account for scroll, header is above grid

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
  }

  // Check if clicking on the edges of a note (for resizing)
  const isOnNoteEdge = (e, note) => {
    if (!note) return false;
    const rect = e.target.getBoundingClientRect();
    const noteWidth = (note.duration || DEFAULT_DURATION) * CELL_WIDTH;
    const clickX = e.clientX - rect.left;
    return { 
      right: clickX > noteWidth - 10,
      left: clickX < 10
    };
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
              // Initialize paint tracking before adding note
              if (paintMode) {
                setIsPainting(true);
                paintedNotesRef.current = new Set([noteKey]);
              }

              // Add note immediately on mousedown
              const noteExists = cantusFirmus.some(n => n.pitch === pitch && n.beat === beat);
              if (!noteExists) {
                // Preserve fractional beats - don't round unless snap to grid is on
                const beatValue = snapToGrid ? Math.round(beat / quantizeGrid) * quantizeGrid : Math.round(beat * 1000) / 1000;
                const newNotes = [...cantusFirmus, { 
                  pitch, 
                  beat: beatValue, 
                  duration: lastNoteDuration, 
                  velocity: lastNoteVelocity 
                }].sort((a, b) => a.beat - b.beat);
                
                // Add note immediately - don't wait for mouseup
                if (!isPlaying) {
                  saveToHistory(newNotes);
                }
                onNotesUpdate(newNotes);
                
                // Auto-expand if adding note in last measure
                const lastMeasureStart = (measures - 1) * beatsPerMeasure;
                if (beatValue >= lastMeasureStart && window.expandMeasures) {
                  window.expandMeasures();
                }
                
                // Play the note with proper duration for feedback
                playNoteSound(pitch);
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
            // Click on empty cell - deselect
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
                if (dragState || resizeState) e.stopPropagation?.();
                const coords = e.clientX !== undefined ? e : getEventCoords(e);

                // Handle piano key dragging - early return for performance
                if (isDraggingPiano) {
                  if (gridRef.current) {
                    const gridRect = gridRef.current.getBoundingClientRect();
                    const scrollTop = gridRef.current.scrollTop;
                    const y = coords.clientY - gridRect.top - 28 + scrollTop;
                    const pitchIndex = Math.floor(y / CELL_HEIGHT);
                    
                    if (pitchIndex >= 0 && pitchIndex < pitches.length) {
                      const newPitch = pitches[pitchIndex];
                      if (newPitch !== lastPianoPitchRef.current) {
                        // Stop previous note
                        if (pianoSustainRef.current) {
                          stopNoteSustain(pianoSustainRef.current, 0.05);
                        }
                        
                        // Start new note
                        lastPianoPitchRef.current = newPitch;
                        const customConfig = getInstrumentConfig(pianoInstrument);
                        
                        if (customConfig) {
                          playNoteWithCustomInstrument(newPitch, 2, 0.7, customConfig);
                        } else {
                          pianoSustainRef.current = playNoteSustain(newPitch, 0.7, 0, pianoInstrument);
                        }
                      }
                    }
                  }
                  return; // Don't update hovered cell while dragging piano
                }

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
                // Floor the beat so we only paint the cell the mouse is actually over (rounding can snap into the next cell)
                const beatValue = Math.max(0, Math.min(totalBeats - 1, Math.floor((coords.clientX - (gridRef.current?.getBoundingClientRect().left ?? 0) - 56 + (gridRef.current?.scrollLeft ?? 0)) / CELL_WIDTH)));
                const normalizedKey = getNoteKey(cell.pitch, beatValue);
                const hasNote = cantusFirmus.some(n => n.pitch === cell.pitch && n.beat === beatValue);

                // Only add if not already painted in this stroke and no existing note
                if (!paintedNotesRef.current.has(normalizedKey) && !hasNote) {
                  paintedNotesRef.current.add(normalizedKey);
                  const newNotes = [...cantusFirmus, { pitch: cell.pitch, beat: beatValue, duration: lastNoteDuration, velocity: lastNoteVelocity }].sort((a, b) => a.beat - b.beat);
                  // Save to history immediately for paint mode (not during playback typically)
                  if (!isPlaying) {
                    saveToHistory(newNotes);
                  }
                  onNotesUpdate(newNotes);
                  
                  // Auto-expand if adding note in last measure
                  const lastMeasureStart = (measures - 1) * beatsPerMeasure;
                  if (beatValue >= lastMeasureStart && window.expandMeasures) {
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
      // Handle note duration resize (left or right edge)
              const deltaX = coords.clientX - resizeState.startX;
      const deltaDuration = deltaX / CELL_WIDTH;

      // Build a map of original note keys to identify which notes to resize
      const originalKeys = new Set(resizeState.startNotes.map(s => `${s.pitch}-${s.beat}`));

      // Update note durations in real-time (group resize if multiple selected)
      const newNotes = cantusFirmus.map(n => {
        // Match by pitch AND original beat to avoid resizing wrong notes with same pitch
        const startNote = resizeState.startNotes.find(s =>
          s.pitch === n.pitch && Math.abs(n.beat - s.beat) < 0.01
        );
        if (startNote) {
          if (resizeState.edge === 'right') {
            const newDuration = Math.max(MIN_DURATION, Math.round((startNote.duration + deltaDuration) * 8) / 8);
            return { ...n, duration: newDuration };
          } else {
            const endPoint = startNote.beat + startNote.duration;
            let newBeat = startNote.beat + deltaDuration;
            newBeat = Math.max(0, newBeat);
            let newDuration = endPoint - newBeat;
            if (newDuration < MIN_DURATION) { newDuration = MIN_DURATION; newBeat = endPoint - MIN_DURATION; }
            if (snapToGrid) {
              newBeat = Math.round(newBeat / quantizeGrid) * quantizeGrid;
              newDuration = Math.max(MIN_DURATION, Math.round((endPoint - newBeat) * 8) / 8);
            } else {
              newBeat = Math.round(newBeat * 1000) / 1000;
              newDuration = Math.round((endPoint - newBeat) * 1000) / 1000;
            }
            return { ...n, beat: Math.max(0, newBeat), duration: Math.max(MIN_DURATION, newDuration) };
          }
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
      
      // Include horizontal scroll offset change so notes follow mouse during auto-scroll
      const scrollLeftDelta = (gridRef.current?.scrollLeft || 0) - (dragState.startScrollLeft || 0);
      // Support fractional beats when snap is off
      let beatDelta = (deltaX + scrollLeftDelta) / CELL_WIDTH;
      if (snapToGrid) {
        beatDelta = Math.round(beatDelta / quantizeGrid) * quantizeGrid;
      }
      // Include scroll offset change so notes follow the mouse during auto-scroll
      const scrollTopDelta = (gridRef.current?.scrollTop || 0) - (dragState.startScrollTop || 0);
      const totalDeltaY = deltaY + scrollTopDelta;
      // Require meaningful vertical movement before registering pitch change (dead zone)
      const pitchDelta = Math.abs(totalDeltaY) >= CELL_HEIGHT / 2 ? Math.round(totalDeltaY / CELL_HEIGHT) : 0;

      const newPitchIndex = dragState.startPitchIndex + pitchDelta;
      const newBeat = dragState.startBeat + beatDelta;
      
      const prevPitchIndex = dragState.currentPitchIndex;

      // Require pixel threshold before flagging as drag (avoid note flash on click)
      const hasMoved = Math.abs(coords.clientX - dragState.clickOffsetX) > 4 || Math.abs(coords.clientY - dragState.clickOffsetY) > 4;
      
      // Play note sound when pitch changes during drag
      if ((dragState.isDragging || hasMoved) && newPitchIndex !== prevPitchIndex && newPitchIndex >= 0 && newPitchIndex < pitches.length) {
        // Use the first dragged note's properties for preview
        const firstDraggedNote = originalDragNotesRef.current?.notes?.[0];
        if (firstDraggedNote) {
          // Create a preview note with the new pitch but original effects
          const previewNote = {
            ...firstDraggedNote,
            pitch: pitches[newPitchIndex]
          };
          
          // Use custom instrument config if available
          initAudio();
          const instrument = voices[activeVoice]?.instrument || 'organ';
          const customConfig = getInstrumentConfig(instrument);
          
          const hasBend = previewNote.bendStart !== undefined || previewNote.bendEnd !== undefined;
          const pitchBend = hasBend ? {
            start: previewNote.bendStart ?? 0,
            end: previewNote.bendEnd ?? 0,
            startTime: previewNote.bendStartTime ?? 0,
            endTime: previewNote.bendEndTime ?? 1
          } : 0;
          
          const sixteenthNoteDuration = (60 / tempo) / 4;
          const actualDuration = previewNote.duration ? (previewNote.duration * sixteenthNoteDuration) : (hasBend ? 1.5 : 0.3);
          const velocity = previewNote.velocity ?? 0.7;
          
          if (customConfig) {
            playNoteWithCustomInstrument(pitches[newPitchIndex], actualDuration, velocity, customConfig, previewNote.articulation || 'normal', tempo, pitchBend);
          } else if (previewNote.articulation && previewNote.articulation !== 'normal') {
            import('@/components/counterpoint/audioEngine').then(({ playNoteWithArticulation }) => {
              playNoteWithArticulation(pitches[newPitchIndex], actualDuration, velocity, 0, instrument, previewNote.articulation, tempo, pitchBend);
            });
          } else {
            playNote(pitches[newPitchIndex], actualDuration, velocity, 0, instrument, pitchBend);
          }
        } else {
          playNoteSound(pitches[newPitchIndex]);
        }
      }

      // Smooth RAF-based auto-scroll when dragging near edges
                  if (gridRef.current && dragState.isDragging) {
                    const rect = gridRef.current.getBoundingClientRect();
                    const edgeThreshold = 60;
                    const maxSpeed = 18;
                    let vx = 0, vy = 0;
                    if (coords.clientX > rect.right - edgeThreshold)
                      vx = maxSpeed * Math.min(1, (coords.clientX - (rect.right - edgeThreshold)) / edgeThreshold);
                    else if (coords.clientX < rect.left + edgeThreshold + 56)
                      vx = -maxSpeed * Math.min(1, ((rect.left + edgeThreshold + 56) - coords.clientX) / edgeThreshold);
                    if (coords.clientY > rect.bottom - edgeThreshold)
                      vy = maxSpeed * Math.min(1, (coords.clientY - (rect.bottom - edgeThreshold)) / edgeThreshold);
                    else if (coords.clientY < rect.top + edgeThreshold)
                      vy = -maxSpeed * Math.min(1, ((rect.top + edgeThreshold) - coords.clientY) / edgeThreshold);

                    if (vx !== 0 || vy !== 0) {
                      if (!autoScrollRef.current) {
                        const loop = () => {
                          if (!autoScrollRef.current) return;
                          if (gridRef.current) {
                            gridRef.current.scrollLeft += autoScrollRef.current.vx;
                            gridRef.current.scrollTop += autoScrollRef.current.vy;
                          }
                          autoScrollRef.current.raf = requestAnimationFrame(loop);
                        };
                        autoScrollRef.current = { vx, vy, raf: requestAnimationFrame(loop) };
                      } else {
                        autoScrollRef.current.vx = vx;
                        autoScrollRef.current.vy = vy;
                      }
                    } else if (autoScrollRef.current) {
                      cancelAnimationFrame(autoScrollRef.current.raf);
                      autoScrollRef.current = null;
                    }
                  } else if (autoScrollRef.current) {
                    cancelAnimationFrame(autoScrollRef.current.raf);
                    autoScrollRef.current = null;
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
        // Stop smooth auto-scroll
        if (autoScrollRef.current) {
          cancelAnimationFrame(autoScrollRef.current.raf);
          autoScrollRef.current = null;
        }

        // Clear pending note on mouseup
        setPendingNote(null);

        // Save history after painting stroke
        if (isPainting && paintedNotesRef.current.size > 0) {
          saveToHistory(cantusFirmus);
        }
        setIsPainting(false);
        paintedNotesRef.current.clear();

        if (resizeState) {
          const newKeys = new Set();
          cantusFirmus.forEach(n => {
            const match = resizeState.startNotes.find(s => {
              if (s.pitch !== n.pitch) return false;
              if (resizeState.edge === 'left') return Math.abs((n.beat + (n.duration||1)) - (s.beat + s.duration)) < 0.01;
              return Math.abs(n.beat - s.beat) < 0.01;
            });
            if (match) newKeys.add(getNoteKey(n.pitch, n.beat));
          });
          if (newKeys.size > 0) setSelectedNotes(newKeys);
          const s0 = resizeState.startNotes[0];
          const rn = s0 && cantusFirmus.find(n => n.pitch === s0.pitch && Math.abs(n.beat - s0.beat) < 0.5);
          if (rn) setLastNoteDuration(rn.duration || DEFAULT_DURATION);
          saveToHistory(cantusFirmus);
          setResizeState(null);
          return;
        }
    
    if (marquee) {
      // Check if this was a drag or just a click
      const deltaX = Math.abs(marquee.endX - marquee.startX);
      const deltaY = Math.abs(marquee.endY - marquee.startY);
      
      if (deltaX < 40 && deltaY < 40) {
        // Just a click - clear selection
        setSelectedNotes(new Set());
        onLoopChange?.(null, null);
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
          const selectedNotesList = [];
          cantusFirmus.forEach(note => {
            const pitchIdx = pitches.indexOf(note.pitch);
            const duration = note.duration || DEFAULT_DURATION;
            const noteEndBeat = note.beat + duration;
            
            // Select note if it overlaps with marquee
            const overlapsHorizontally = noteEndBeat > minBeat && note.beat < maxBeat;
            const overlapsVertically = pitchIdx >= minPitchIdx && pitchIdx <= maxPitchIdx;
            
            if (overlapsHorizontally && overlapsVertically) {
              newSelected.add(getNoteKey(note.pitch, note.beat));
              selectedNotesList.push(note);
            }
          });
          if (selectedNotesList.length > 0) {
            const selMinBeat = Math.floor(Math.min(...selectedNotesList.map(n => n.beat)));
            const selMaxBeat = Math.ceil(Math.max(...selectedNotesList.map(n => n.beat + (n.duration || DEFAULT_DURATION))));
            onLoopChange?.(selMinBeat, selMaxBeat);
          } else {
            onLoopChange?.(null, null);
          }
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
            velocity: n.velocity ?? 0.8,
            // Preserve articulation and bend properties
            articulation: n.articulation,
            bendStart: n.bendStart,
            bendEnd: n.bendEnd,
            bendStartTime: n.bendStartTime,
            bendEndTime: n.bendEndTime
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
    if (!dragState) return { pitchDelta: 0, beatDelta: 0 };
    return {
      pitchDelta: dragState.currentPitchIndex - dragState.startPitchIndex,
      beatDelta: dragState.currentBeat - dragState.startBeat
    };
  };

  const dragOffset = getDragOffset();

  const getInitials = (email) => {
    if (!email) return '?';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
          <div className="bg-[#2D2D2D] rounded-xl sm:rounded-2xl border border-[#3A3A3A] w-full overflow-hidden max-w-full flex flex-col h-full">
            {/* Main Toolbar */}
          <div className="flex items-center justify-between px-2 sm:px-5 py-1 sm:py-1.5 border-b border-[#3A3A3A] overflow-x-auto gap-2 flex-shrink-0">
            {/* Left: User Avatar + File Menu */}
            <div className="flex items-center gap-2">
              {/* User avatar */}
              {currentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D4AF37] text-[#1E1E1E] font-semibold text-xs border-2 border-[#3A3A3A] hover:bg-[#E5BF47] transition-colors cursor-pointer" 
                      title={currentUser.email}
                    >
                      {getInitials(currentUser.email)}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#1E1E1E] border-[#3A3A3A]">
                    <DropdownMenuItem disabled className="text-white/50 text-xs cursor-default">
                      {currentUser.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#3A3A3A]" />
                    <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white hover:text-white hover:bg-slate-700/50 gap-2"
                onClick={() => setTimeout(() => gridRef.current?.focus(), 0)}
              >
                <Menu className="w-4 h-4" />
                <span className="font-semibold text-sm">{projectName || 'File'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-[#1E1E1E] border-[#3A3A3A] min-w-[220px] shadow-xl">
              <DropdownMenuItem onClick={() => { onNewProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FileText className="w-4 h-4 mr-2" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onLoadProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FolderOpen className="w-4 h-4 mr-2" />Browse All Projects
              </DropdownMenuItem>
              {(() => { const recent = JSON.parse(localStorage.getItem('counterpoint-local-projects') || '[]').slice(-5).reverse(); return recent.length > 0 ? (<><DropdownMenuSeparator className="bg-[#3A3A3A]" /><div className="px-2 py-0.5 text-[10px] text-white/40 uppercase tracking-wider">Recent</div>{recent.map(p => (<DropdownMenuItem key={p.id} onClick={() => { if (window.__loadRecentProject) window.__loadRecentProject(p); else window.location.reload(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/75 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white text-xs py-1.5"><FolderOpen className="w-3 h-3 mr-2 flex-shrink-0 opacity-50" /><span className="truncate">{p.name}</span></DropdownMenuItem>))}<DropdownMenuSeparator className="bg-[#3A3A3A]" /></>) : null; })()}
              <DropdownMenuItem onClick={() => { onSaveProject(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Save className="w-4 h-4 mr-2" />Save Project<span className="ml-auto text-xs text-white/40">⌘S</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onSaveProjectAs(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <FilePlus className="w-4 h-4 mr-2" />Save Project As...<span className="ml-auto text-xs text-white/40">⌘⇧S</span>
              </DropdownMenuItem>
              {onSaveSong && (
                <DropdownMenuItem onClick={() => { onSaveSong(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer font-semibold hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
                  <Save className="w-4 h-4 mr-2" />
                  Save as Song (Admin)
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={() => { onBrowseSongs(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-amber-400 cursor-pointer hover:bg-[#3A3A3A] hover:text-amber-300 focus:bg-[#3A3A3A] focus:text-amber-300">
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
                const toastId = 'audio-export';
                try {
                  // toast.loading('Generating audio file...', { id: toastId });
                  const { renderToWav } = await import('./audioExporter');
                  const blob = await renderToWav(cantusFirmus, tempo, voices[0]?.instrument || 'organ');
                  
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `composition-${Date.now()}.wav`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  // toast.success('Audio file downloaded', { id: toastId });
                } catch (error) {
                  console.error('Export audio error:', error);
                  // toast.error('Failed to export audio: ' + error.message, { id: toastId });
                }
              }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Download className="w-4 h-4 mr-2" />
                Download as Audio
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={() => { onTogglePianoPanel(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Keyboard className="w-4 h-4 mr-2" />
                {showPianoPanel ? 'Hide Piano' : 'Show Piano'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onOpenWaveEditor(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Guitar className="w-4 h-4 mr-2" />
                Create Instrument
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3A3A3A]" />
              <DropdownMenuItem onClick={() => { onAIComposer(); setTimeout(() => document.activeElement?.blur(), 0); }} className="text-white/90 cursor-pointer hover:bg-[#3A3A3A] hover:text-white focus:bg-[#3A3A3A] focus:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Composer
                {chatbotActive && <Check className="w-4 h-4 ml-auto text-amber-400" />}
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
      <div className="flex items-center justify-between px-2 sm:px-5 py-1.5 border-b border-[#3A3A3A]/50 bg-[#252525] flex-shrink-0">
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

          <div className="w-px h-4 bg-slate-600 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setZoom(1); setZoomY(1); }}
            className="h-7 px-2 text-white/60 hover:text-white hover:bg-slate-700 border border-slate-600 text-xs"
            title="Reset zoom"
          >
            Reset
          </Button>
        </div>
      </div>

        {/* Fixed Scrubber */}
        <div className="flex flex-shrink-0" ref={scrubberRef}>
          <div className="flex-shrink-0" style={{ width: '56px', backgroundColor: '#2B2B2B' }} />
          <div 
            className="flex-1 overflow-hidden"
            style={{ backgroundColor: '#2B2B2B' }}
          >
            <Scrubber 
              smoothPlayhead={smoothPlayhead}
              totalBeats={totalBeats}
              CELL_WIDTH={CELL_WIDTH}
              onSeek={onSeek}
              gridRef={gridRef}
            />
          </div>
        </div>

      {/* Grid container with fixed headers and scrollable content */}
      <div className="flex flex-col flex-1 overflow-hidden mx-1">
        {/* Fixed Beat Header (measures) */}
        <div className="flex flex-shrink-0" ref={headerRef}>
          <div className="flex-shrink-0" style={{ width: '56px', backgroundColor: '#3a3a3a' }} />
          <div 
            className="flex-1 overflow-x-hidden"
            ref={headerScrollRef}
            style={{ backgroundColor: '#3a3a3a' }}
            onScroll={(e) => {
              if (gridRef.current) {
                gridRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
          >
            <div 
              className="flex h-7 border-b border-amber-900/50 select-none relative cursor-pointer"
              style={{ backgroundColor: '#3a3a3a', width: `${totalBeats * CELL_WIDTH}px` }}
              onMouseDown={(e) => {
                // Allow note selection within measures - only handle direct header clicks
                if (e.target !== e.currentTarget && e.target?.closest('span')) return;
                
                const beat = getBeatFromHeaderPosition(e.clientX);
                if (beat === null) return;

                // Check if clicking near edges of existing loop region
                const edgeThreshold = 2; // beats
                let dragMode = 'new'; // 'new', 'start', 'end'
                
                if (loopStart !== null && loopEnd !== null) {
                  if (Math.abs(beat - loopStart) <= edgeThreshold) {
                    dragMode = 'start';
                  } else if (Math.abs(beat - loopEnd) <= edgeThreshold) {
                    dragMode = 'end';
                  }
                }

                setIsLoopSelecting(true);
                setLoopSelectStart(beat);
                
                if (dragMode === 'new') {
                  if (onLoopChange) {
                    onLoopChange(beat, beat);
                  }
                }

                const handleMouseMove = (moveEvent) => {
                  const moveBeat = getBeatFromHeaderPosition(moveEvent.clientX);
                  if (moveBeat !== null) {
                    if (dragMode === 'start') {
                      const newStart = Math.floor(moveBeat);
                      if (newStart < loopEnd) {
                        onLoopChange?.(newStart, loopEnd);
                      }
                    } else if (dragMode === 'end') {
                      const newEnd = Math.floor(moveBeat) + 1;
                      if (newEnd > loopStart) {
                        onLoopChange?.(loopStart, newEnd);
                      }
                    } else {
                      const start = Math.min(beat, moveBeat);
                      const end = Math.max(beat, moveBeat);
                      if (onLoopChange) {
                        onLoopChange(start, end);
                      }
                    }
                  }
                };

                const handleMouseUp = (upEvent) => {
                  let upBeat = getBeatFromHeaderPosition(upEvent.clientX);
                  if (upBeat !== null) {
                    if (dragMode === 'start' || dragMode === 'end') {
                      // Edge drag complete
                    } else {
                      const snappedBeat = Math.floor(beat);
                      const snappedUpBeat = Math.floor(upBeat);
                      const dragDistance = Math.abs(snappedUpBeat - snappedBeat);

                      if (dragDistance === 0) {
                        if (onLoopChange) {
                          onLoopChange(null, null);
                        }
                      } else {
                        const start = Math.min(snappedBeat, snappedUpBeat);
                        const end = Math.max(snappedBeat, snappedUpBeat) + 1;
                        if (onLoopChange) {
                          onLoopChange(start, end);
                        }
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
              {Array.from({ length: measures }).map((_, measureIndex) => {const measureStartBeat = measureIndex * beatsPerMeasure; return (<MeasureHeader key={measureIndex} measureIndex={measureIndex} measureStartBeat={measureStartBeat} beatsPerMeasure={beatsPerMeasure} CELL_WIDTH={CELL_WIDTH} loopStart={loopStart} loopEnd={loopEnd} isLooping={isLooping} selectedNotes={selectedNotes} isLoopSelecting={isLoopSelecting} cantusFirmus={cantusFirmus} getNoteKey={getNoteKey} onLoopChange={onLoopChange} setSelectedNotes={setSelectedNotes} gridRef={gridRef} />);})}
            </div>
          </div>
        </div>

      

        {/* Scrollable Grid Content */}
        <div 
          ref={gridRef}
          tabIndex={0}
          className="overflow-auto relative select-none focus:outline-none flex-1"
          style={{ 
            scrollbarWidth: 'thin', 
            scrollbarColor: '#505050 transparent',
            touchAction: (tool === 'marquee' || dragState || resizeState) ? 'none' : 'auto',
            backgroundColor: '#232323'
          }}
          onScroll={(e) => {
            setViewportState(prev => ({ ...prev, scrollLeft: e.target.scrollLeft, scrollTop: e.target.scrollTop }));
            if (headerScrollRef.current && Math.abs(headerScrollRef.current.scrollLeft - e.target.scrollLeft) > 0.5) {
              headerScrollRef.current.scrollLeft = e.target.scrollLeft;
            }
          }}
          onMouseMove={handlePointerMove}
          onMouseUp={(e) => {
            handlePointerUp(e);
            setIsDraggingPiano(false);
            lastPianoPitchRef.current = null;
            if (pianoSustainRef.current) {
              stopNoteSustain(pianoSustainRef.current, 0.3);
              pianoSustainRef.current = null;
            }
          }}
          onMouseLeave={(e) => {
            setHoveredCell(null);
            handlePointerUp(e);
          }}
          onTouchMove={(e) => { 
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

            if (marquee || tool === 'marquee' || (isPainting && paintMode) || resizeState || dragState) {
              e.preventDefault();
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
            if (e.touches.length === 2) {
              const touch1 = e.touches[0];
              const touch2 = e.touches[1];
              const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
              setPinchState({ initialDist: dist, initialZoom: zoom, initialZoomY: zoomY });
            }
          }}
          onTouchEnd={(e) => {
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
        >
          <div className="inline-flex min-w-full" ref={containerRef}>
            {/* Pitch labels - fixed column on left */}
            <div className="sticky left-0 z-20 flex-shrink-0" style={{ backgroundColor: '#2B2B2B' }}>

              {pitches.map((pitch) => {
                const isSharp = pitch.includes('#');
                const isC = pitch.startsWith('C') && !pitch.startsWith('C#');
                const isPianoPressed = pressedPianoNotes.has(pitch);
                
                const startPianoNote = async () => {
                  await initAudio();

                  // Stop previous note if any
                  if (pianoSustainRef.current) {
                    stopNoteSustain(pianoSustainRef.current, 0.1);
                    pianoSustainRef.current = null;
                  }

                  lastPianoPitchRef.current = pitch;
                  const customConfig = getInstrumentConfig(pianoInstrument);

                  if (customConfig) {
                    await playNoteWithCustomInstrument(pitch, 2, 0.7, customConfig);
                  } else {
                    pianoSustainRef.current = playNoteSustain(pitch, 0.7, 0, pianoInstrument);
                  }
                };
                
                return (
                  <div 
                    key={pitch}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingPiano(true);
                      startPianoNote();
                    }}
                    onMouseEnter={() => {
                      if (isDraggingPiano && lastPianoPitchRef.current !== pitch) {
                        startPianoNote();
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      if (!e.defaultPrevented) {
                        startPianoNote();
                        setTimeout(() => {
                          if (pianoSustainRef.current) {
                            stopNoteSustain(pianoSustainRef.current, 0.3);
                            pianoSustainRef.current = null;
                          }
                        }, 500);
                      }
                    }}
                    className={`w-14 flex items-center justify-end pr-2 text-xs border-b border-slate-700 cursor-pointer hover:bg-slate-600/50 transition-colors sticky left-0 ${
                      isPianoPressed ? 'text-amber-300 font-bold' : isC ? 'text-slate-900 font-semibold' : isSharp ? 'text-white/50' : 'text-slate-900'
                    }`}
                    style={{ height: CELL_HEIGHT, backgroundColor: isPianoPressed ? '#D4A574' : isSharp ? '#1E293B' : '#F5F5F5' }}
                  >
                    {pitch}
                  </div>
                );
              })}
            </div>

            {/* Grid content */}
            <div className="flex-shrink-0">


              {(() => {
                // Calculate visible range with buffer
                const visibleStartRow = Math.max(0, Math.floor(viewportState.scrollTop / CELL_HEIGHT) - 5);
                const visibleEndRow = Math.min(pitches.length, Math.ceil((viewportState.scrollTop + viewportState.height) / CELL_HEIGHT) + 5);

                // Calculate visible beat range
                const visibleStartBeat = Math.max(0, Math.floor(viewportState.scrollLeft / CELL_WIDTH) - 2);
                const visibleEndBeat = Math.min(totalBeats, Math.ceil((viewportState.scrollLeft + viewportState.width) / CELL_WIDTH) + 2);
                
                return (
                  <>
                    {visibleStartRow > 0 && (
                      <div style={{ height: visibleStartRow * CELL_HEIGHT }} />
                    )}
                    
                    {pitches.slice(visibleStartRow, visibleEndRow).map((pitch, idx) => {
                      const pitchIndex = visibleStartRow + idx;
                      const isCLine = pitch.startsWith('C') && !pitch.startsWith('C#');
                      const isSharpLine = pitch.includes('#');
                      
                      return (
                        <div key={pitch} className="flex" style={{ height: CELL_HEIGHT }}>
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

                                  if (tool === 'marquee') {
                                    e.preventDefault();
                                    activeTouchIdRef.current = touch.identifier;
                                    handlePointerDown(e, pitch, beat);
                                    return;
                                  }

                                  if (!hasNote && selectedNotes.size > 0 && tool === 'select') {
                                    e.preventDefault();
                                    activeTouchIdRef.current = touch.identifier;

                                    const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
                                    const notesToStore = selectedNotesList.map(n => ({
                                      pitch: n.pitch,
                                      beat: n.beat,
                                      duration: n.duration || DEFAULT_DURATION,
                                      velocity: n.velocity,
                                      articulation: n.articulation,
                                      bendStart: n.bendStart,
                                      bendEnd: n.bendEnd,
                                      bendStartTime: n.bendStartTime,
                                      bendEndTime: n.bendEndTime
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
                                                      clickOffsetY: touch.clientY,
                                                      startScrollTop: gridRef.current?.scrollTop || 0,
                                                      startScrollLeft: gridRef.current?.scrollLeft || 0
                                                    });
                                    return;
                                  }

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
                                {notesAtPosition.map(({ voiceIndex, note }) => {const duration = note.duration || DEFAULT_DURATION; const noteWidth = duration * CELL_WIDTH - 4; const nKey = getNoteKey(note.pitch, note.beat); const isBeingDragged = dragState?.isDragging && originalDragNotesRef.current?.keys?.has(nKey); const noteVelocity = note.velocity ?? 0.8; const velocityColor = voiceIndex === 0 ? getVelocityColor(noteVelocity) : NOTE_COLORS[voiceIndex]; const noteInLoop = loopStart !== null && loopEnd !== null && note.beat >= loopStart && note.beat < loopEnd; return (<div key={`${voiceIndex}-${note.beat.toFixed(3)}-${note.pitch}`} onMouseDown={async (e) => {e.stopPropagation(); setPendingNote(null); if (onLoopChange) onLoopChange(null, null); const coords = getEventCoords(e); const rect = e.currentTarget.getBoundingClientRect(); const clickX = coords.clientX - rect.left; await playNoteSound(pitch, note); if (clickX > rect.width - 10) {const startNotes = []; if (selectedNotes.has(nKey) && selectedNotes.size > 0) {cantusFirmus.forEach(n => {if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) startNotes.push({ pitch: n.pitch, beat: n.beat, duration: n.duration || DEFAULT_DURATION });})} else {startNotes.push({ pitch: note.pitch, beat: note.beat, duration: note.duration || DEFAULT_DURATION })} setResizeState({ startX: coords.clientX, startNotes, edge: 'right' });} else if (clickX < 10) {const startNotes = []; if (selectedNotes.has(nKey) && selectedNotes.size > 0) {cantusFirmus.forEach(n => {if (selectedNotes.has(getNoteKey(n.pitch, n.beat))) startNotes.push({ pitch: n.pitch, beat: n.beat, duration: n.duration || DEFAULT_DURATION });})} else {startNotes.push({ pitch: note.pitch, beat: note.beat, duration: note.duration || DEFAULT_DURATION })} setResizeState({ startX: coords.clientX, startNotes, edge: 'left' });} else {const wasSelected = selectedNotes.has(nKey); const keysToUse = wasSelected ? new Set(selectedNotes) : new Set([nKey]); const notesToStore = cantusFirmus.filter(n => keysToUse.has(getNoteKey(n.pitch, n.beat))).map(n => ({pitch: n.pitch, beat: n.beat, duration: n.duration || DEFAULT_DURATION, velocity: n.velocity, articulation: n.articulation, bendStart: n.bendStart, bendEnd: n.bendEnd, bendStartTime: n.bendStartTime, bendEndTime: n.bendEndTime})); originalDragNotesRef.current = {keys: new Set(notesToStore.map(n => getNoteKey(n.pitch, n.beat))), notes: notesToStore, shouldUpdateSelection: !wasSelected, shiftKey: e.shiftKey, targetKey: nKey}; setDragState({startPitch: pitch, startBeat: beat, startPitchIndex: pitches.indexOf(pitch), currentPitchIndex: pitches.indexOf(pitch), currentBeat: beat, isDragging: false, clickOffsetX: coords.clientX, clickOffsetY: coords.clientY, startScrollTop: gridRef.current?.scrollTop || 0, startScrollLeft: gridRef.current?.scrollLeft || 0}); console.log('[NoteGrid] Set drag state for existing note', { pitch, beat }); setPendingNote(null);}}} className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${selectedNotes.has(nKey) ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : noteInLoop && isLooping ? 'ring-2 ring-amber-400/60' : ''}`} style={{left: `${(note.beat - Math.floor(note.beat)) * CELL_WIDTH + 2}px`, width: noteWidth, minWidth: 20, backgroundColor: velocityColor, boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${velocityColor}` : undefined, cursor: resizeState ? 'ew-resize' : 'grab', zIndex: 5, opacity: isBeingDragged ? 0 : 1}}><span className="text-[10px] font-bold text-slate-900 pointer-events-none whitespace-nowrap">{note.pitch.replace(/\d+$/, '')}</span>{((note.bendStart !== undefined && note.bendStart !== 0) || (note.bendEnd !== undefined && note.bendEnd !== 0)) && (<span className="text-[8px] text-slate-900/70 ml-0.5 pointer-events-none">↕</span>)}<div className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-l" /><div className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r" /></div>);})}
                              </div>
                            );
                          })}
                          
                          {visibleEndBeat < totalBeats && (
                            <div style={{ width: (totalBeats - visibleEndBeat) * CELL_WIDTH, flexShrink: 0 }} />
                          )}
                        </div>
                      );
                    })}
                    
                    {visibleEndRow < pitches.length && (
                      <div style={{ height: (pitches.length - visibleEndRow) * CELL_HEIGHT }} />
                    )}
                  </>
                );
              })()}

              <GridOverlays
                marquee={marquee}
                dragState={dragState}
                dragOffset={dragOffset}
                originalDragNotes={originalDragNotesRef.current?.notes}
                pitches={pitches}
                CELL_WIDTH={CELL_WIDTH}
                CELL_HEIGHT={CELL_HEIGHT}
                DEFAULT_DURATION={DEFAULT_DURATION}
                getVelocityColor={getVelocityColor}
                viewportState={viewportState}
                gridRef={gridRef}
                headerRef={headerRef}
                smoothPlayhead={smoothPlayhead}
                zoom={zoom}
                isPlaying={isPlaying}
                currentBeat={currentBeat}
                onSeek={onSeek}
                snapToGrid={snapToGrid}
                quantizeGrid={quantizeGrid}
                totalBeats={totalBeats}
                setIsScrubbing={setIsScrubbing}
                setScrubPosition={setScrubPosition}
                scrubberRef={scrubberRef}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-700 px-2 sm:px-5 py-2 sm:py-3 min-h-[64px] flex-shrink-0 relative z-10" style={{backgroundColor: '#2D2D2D'}}>
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
        {selectedNotes.size > 0 && (
          <div className="flex-1 min-w-0">
            <NoteControls selectedNotes={selectedNotes} cantusFirmus={cantusFirmus} getNoteKey={getNoteKey} onNotesUpdate={onNotesUpdate} saveToHistory={saveToHistory} voices={voices} tempo={tempo} getInstrumentConfig={getInstrumentConfig} onVelocityChange={setLastNoteVelocity} />
          </div>
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