import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MousePointer2, Square, Trash2, Copy, ClipboardPaste, Undo, Redo, Pencil, FileAudio, ZoomIn, ZoomOut, Layers, Guitar } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { initAudio, playNote } from './audioEngine';

const NOTE_NAMES = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
const OCTAVES = [5, 4, 3, 2];

const NOTE_COLORS = {
  0: '#E8B885', // Voice 1 - Gold
  1: '#7B9E89', // Voice 2 - Sage
  2: '#9B8AA6', // Voice 3 - Lavender
  3: '#A68B7B', // Voice 4 - Warm brown
};

const BASE_CELL_WIDTH = 48;
const CELL_HEIGHT = 28;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const MIN_DURATION = 0.25; // Quarter of a beat
const DEFAULT_DURATION = 1; // One beat

const INSTRUMENTS = [
  { value: 'organ', label: 'Organ' },
  { value: 'distortion', label: 'Distortion' },
  { value: 'clean', label: 'Clean' },
  { value: 'bass', label: 'Bass' },
  { value: 'strings', label: 'Strings' },
  { value: 'flute', label: 'Flute' },
  { value: 'synth', label: 'Synth' },
];

export default function NoteGrid({ 
  voices, 
  currentBeat, 
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
  onSelectionChange
}) {
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const beatsPerMeasure = 16; // 16th notes per measure
  const totalBeats = measures * beatsPerMeasure;

  const [zoom, setZoom] = useState(1);
  const CELL_WIDTH = BASE_CELL_WIDTH * zoom;

  const [tool, setTool] = useState('select'); // 'select', 'marquee', 'draw'
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [marquee, setMarquee] = useState(null);

  const getNoteKey = (pitch, beat) => `${pitch}-${beat}`;

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
      onSelectionChange(selectedNotesList);
    }
  }, [selectedNotes, cantusFirmus, onSelectionChange]);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null); // For resizing note duration
  const [clipboard, setClipboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Generate all pitches for the grid
  const pitches = [];
  OCTAVES.forEach(octave => {
    NOTE_NAMES.forEach(note => {
      pitches.push(`${note}${octave}`);
    });
  });

  // Scroll to keep current beat visible during playback
  useEffect(() => {
    if (gridRef.current) {
      if (currentBeat === 0) {
        // Reset scroll to beginning
        gridRef.current.scrollLeft = 0;
      } else if (isPlaying) {
        const containerWidth = gridRef.current.clientWidth - 56; // subtract pitch label width
        const beatPosition = currentBeat * CELL_WIDTH;
        const currentScroll = gridRef.current.scrollLeft;

        // Keep playhead in the middle third of the visible area
        const leftThreshold = currentScroll + containerWidth * 0.3;
        const rightThreshold = currentScroll + containerWidth * 0.7;

        if (beatPosition > rightThreshold || beatPosition < leftThreshold) {
          gridRef.current.scrollLeft = Math.max(0, beatPosition - containerWidth * 0.3);
        }
      }
    }
  }, [currentBeat, CELL_WIDTH, isPlaying]);

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
    playNote(pitch, 0.3, 0.6, 0);
  }, []);

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

  const getCellFromPosition = (clientX, clientY) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = gridRef.current?.scrollLeft || 0;
    const scrollTop = gridRef.current?.scrollTop || 0;
    
    const x = clientX - rect.left + scrollLeft - 56; // 56 = pitch label width
    const y = clientY - rect.top + scrollTop - 28; // 28 = header height
    
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

  const handleMouseDown = (e, pitch, beat) => {
    const noteKey = getNoteKey(pitch, beat);
    const existingNote = cantusFirmus.find(n => n.pitch === pitch && n.beat === beat);
    const hasNote = !!existingNote;
    
    if (tool === 'draw') {
      // Draw mode - add/remove note (allows multiple notes per beat)
      if (hasNote) {
        const newNotes = cantusFirmus.filter(n => !(n.pitch === pitch && n.beat === beat));
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else {
        // Allow multiple notes per beat - just add the new note with default duration
        const newNotes = [...cantusFirmus, { pitch, beat, duration: DEFAULT_DURATION }].sort((a, b) => a.beat - b.beat);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
        playNoteSound(pitch);
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
          startX: e.clientX,
          startY: e.clientY,
          endX: e.clientX,
          endY: e.clientY
        });
      }
    } else if (tool === 'marquee') {
      setMarquee({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY
      });
    }
  };

  const handleMouseMove = (e) => {
    if (resizeState) {
      // Handle note duration resize
      const deltaX = e.clientX - resizeState.startX;
      const deltaDuration = deltaX / CELL_WIDTH;
      const newDuration = Math.max(MIN_DURATION, Math.round((resizeState.startDuration + deltaDuration) * 4) / 4);

      // Update note duration in real-time
      const newNotes = cantusFirmus.map(n => {
        if (n.pitch === resizeState.note.pitch && n.beat === resizeState.note.beat) {
          return { ...n, duration: newDuration };
        }
        return n;
      });
      onNotesUpdate(newNotes);
    } else if (marquee) {
      setMarquee(prev => ({ ...prev, endX: e.clientX, endY: e.clientY }));
    } else if (dragState && selectedNotes.size > 0) {
      const cell = getCellFromPosition(e.clientX, e.clientY);
      if (cell) {
        const prevPitchIndex = dragState.currentPitchIndex;
        const newPitchIndex = cell.pitchIndex;

        // Play note sound when pitch changes during drag
        if (dragState.isDragging && newPitchIndex !== prevPitchIndex) {
          playNoteSound(pitches[newPitchIndex]);
        }

        setDragState(prev => ({
          ...prev,
          currentPitchIndex: newPitchIndex,
          currentBeat: cell.beat,
          isDragging: true
        }));
      }
    }
  };

  const handleMouseUp = () => {
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
    } else if (dragState && dragState.isDragging && selectedNotes.size > 0) {
      // Apply drag
      const pitchDelta = dragState.currentPitchIndex - dragState.startPitchIndex;
      const beatDelta = dragState.currentBeat - dragState.startBeat;
      
      if (pitchDelta !== 0 || beatDelta !== 0) {
        const selectedNotesList = cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        const unselectedNotes = cantusFirmus.filter(n => !selectedNotes.has(getNoteKey(n.pitch, n.beat)));
        
        const movedNotes = selectedNotesList.map(note => {
          const newPitchIdx = Math.max(0, Math.min(pitches.length - 1, pitches.indexOf(note.pitch) + pitchDelta));
          const newBeat = Math.max(0, Math.min(totalBeats - 1, note.beat + beatDelta));
          return { pitch: pitches[newPitchIdx], beat: newBeat, duration: note.duration || DEFAULT_DURATION };
        }).filter(n => n.beat >= 0 && n.beat < totalBeats);
        
        const newNotes = [...unselectedNotes, ...movedNotes].sort((a, b) => a.beat - b.beat);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
        
        // Update selection keys
        const newSelected = new Set(movedNotes.map(n => getNoteKey(n.pitch, n.beat)));
        setSelectedNotes(newSelected);
      }
    }
    setDragState(null);
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
    <div className="bg-slate-800 rounded-2xl p-5 border border-slate-600">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
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
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportMidi}
            disabled={cantusFirmus.length === 0}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Export MIDI"
          >
            <FileAudio className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">MIDI</span>
          </Button>

          <div className="w-px h-5 bg-slate-600 mx-2" />

          {/* Voice selector */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white/60" />
            <Select value={String(activeVoice)} onValueChange={(v) => onActiveVoiceChange?.(parseInt(v))}>
              <SelectTrigger className="w-32 h-8 bg-slate-700 border-slate-600 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {voices.map((voice, i) => (
                  <SelectItem key={i} value={String(i)} className="text-white text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NOTE_COLORS[i] }} />
                      {voice.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instrument for active voice */}
          <div className="flex items-center gap-2">
            <Guitar className="w-4 h-4 text-white/60" />
            <Select 
              value={voices[activeVoice]?.instrument || 'organ'} 
              onValueChange={(v) => onVoiceInstrumentChange?.(activeVoice, v)}
            >
              <SelectTrigger className="w-28 h-8 bg-slate-700 border-slate-600 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {INSTRUMENTS.map(inst => (
                  <SelectItem key={inst.value} value={inst.value} className="text-white text-xs">
                    {inst.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-px h-5 bg-slate-600 mx-2" />

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              className="h-8 w-8 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
              title="Zoom out"
              aria-label="Zoom out timeline"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              className="w-20 [&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
              aria-label="Timeline zoom level"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              className="h-8 w-8 p-0 text-white hover:text-white hover:bg-slate-700 border border-slate-600 disabled:opacity-30"
              title="Zoom in"
              aria-label="Zoom in timeline"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <span className="text-white/60 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          </div>
          </div>
        
        <div className="flex gap-4">
          {voices.map((voice, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: NOTE_COLORS[i] }}
              />
              <span className="text-xs text-white/90">{voice.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div 
        ref={gridRef}
        className="overflow-auto max-h-[400px] relative select-none"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="inline-flex min-w-full" ref={containerRef}>
          {/* Pitch labels - fixed column on left */}
          <div className="sticky left-0 z-20 flex-shrink-0" style={{ backgroundColor: 'rgb(30, 41, 59)' }}>
            <div className="h-7 border-b border-slate-600 bg-slate-800" />
            {pitches.map((pitch) => (
              <div 
                key={pitch}
                className={`h-7 w-14 flex items-center justify-end pr-2 text-xs border-b border-slate-700 ${
                  pitch.startsWith('C') ? 'text-amber-400 font-semibold' : 'text-white/80'
                }`}
                style={{ backgroundColor: pitch.startsWith('C') ? 'rgba(251, 191, 36, 0.15)' : 'rgb(30, 41, 59)' }}
              >
                {pitch}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="flex-shrink-0">
            {/* Beat numbers header - draggable to scrub */}
            <div 
              className="flex h-7 border-b border-slate-600 cursor-ew-resize select-none"
              onMouseDown={(e) => {
                const headerRect = e.currentTarget.getBoundingClientRect();
                
                const updateBeat = (clientX) => {
                  const scrollLeft = gridRef.current?.scrollLeft || 0;
                  const x = clientX - headerRect.left + scrollLeft;
                  const beat = Math.max(0, Math.min(totalBeats - 1, Math.floor(x / CELL_WIDTH)));
                  onSeek && onSeek(beat);
                };

                updateBeat(e.clientX);

                const handleMouseMove = (moveEvent) => {
                  updateBeat(moveEvent.clientX);
                };

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              {Array.from({ length: totalBeats }).map((_, beat) => (
                <div 
                  key={beat}
                  className={`flex-shrink-0 flex items-center justify-center text-xs font-medium border-r pointer-events-none ${
                    beat % beatsPerMeasure === 0 
                      ? 'border-r-slate-500 bg-slate-700/50 text-amber-400' 
                      : 'border-r-slate-700 text-white/60'
                  } ${currentBeat === beat ? 'bg-amber-500/40' : ''}`}
                  style={{ width: CELL_WIDTH }}
                >
                  {beat % beatsPerMeasure === 0 ? Math.floor(beat / beatsPerMeasure) + 1 : ''}
                </div>
              ))}
            </div>

            {/* Note grid rows */}
            {pitches.map((pitch, pitchIndex) => (
              <div key={pitch} className="flex" style={{ height: CELL_HEIGHT }}>
                {Array.from({ length: totalBeats }).map((_, beat) => {
                  const isBarLine = beat % beatsPerMeasure === 0;
                  const isCLine = pitch.startsWith('C');
                  const noteKey = getNoteKey(pitch, beat);
                  const isSelected = selectedNotes.has(noteKey);
                  
                  // Check if any voice has a note at this position (support multiple notes per beat)
                  const notesAtPosition = [];
                  voices.forEach((voice, voiceIndex) => {
                    if (!voice.notes) return;
                    // Find ALL notes at this beat with this pitch (not just first)
                    voice.notes.forEach(note => {
                      if (note.beat === beat && note.pitch === pitch) {
                        notesAtPosition.push({ voiceIndex, note });
                      }
                    });
                  });

                  const isCurrentBeat = currentBeat === beat;
                  const hasNote = notesAtPosition.length > 0;

                  // Calculate if this note should show drag preview
                  const showDragPreview = isSelected && dragState?.isDragging;

                  return (
                    <div
                      key={beat}
                      onMouseDown={(e) => handleMouseDown(e, pitch, beat)}
                      className={`flex-shrink-0 border-r border-b relative cursor-pointer transition-colors
                        ${isBarLine ? 'border-r-slate-500' : 'border-r-slate-700'} 
                        ${isCLine ? 'border-b-slate-500 bg-amber-400/5' : 'border-b-slate-700'}
                        ${isCurrentBeat ? 'bg-amber-500/20' : 'hover:bg-slate-700/50'}
                      `}
                      style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                    >
                      {notesAtPosition.map(({ voiceIndex, note }) => {
                        const duration = note.duration || DEFAULT_DURATION;
                        const noteWidth = duration * CELL_WIDTH - 4;
                        
                        return (
                          <motion.div
                            key={`${voiceIndex}-${note.beat}-${note.pitch}`}
                            initial={{ scale: 0 }}
                            animate={{ 
                              scale: 1,
                              opacity: showDragPreview ? 0.4 : 1
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;

                                // Always play the note when clicking it
                                playNoteSound(pitch);

                                // Check if clicking on resize handle (right 10px)
                                if (clickX > rect.width - 10) {
                                  setResizeState({
                                    note: note,
                                    startX: e.clientX,
                                    startDuration: note.duration || DEFAULT_DURATION
                                  });
                                } else {
                                  // Normal selection/drag behavior
                                  const noteKey = getNoteKey(pitch, beat);
                                  const isAlreadySelected = selectedNotes.has(noteKey);

                                  if (!isAlreadySelected) {
                                    // Only change selection if clicking unselected note
                                    if (!e.shiftKey) {
                                      setSelectedNotes(new Set([noteKey]));
                                    } else {
                                      const newSelected = new Set(selectedNotes);
                                      newSelected.add(noteKey);
                                      setSelectedNotes(newSelected);
                                    }
                                  }

                                  setDragState({
                                    startPitch: pitch,
                                    startBeat: beat,
                                    startPitchIndex: pitches.indexOf(pitch),
                                    currentPitchIndex: pitches.indexOf(pitch),
                                    currentBeat: beat,
                                    isDragging: false
                                  });
                                }
                              }}
                            className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${
                              isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                            }`}
                            style={{ 
                              width: noteWidth,
                              minWidth: 20,
                              backgroundColor: NOTE_COLORS[voiceIndex],
                              boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${NOTE_COLORS[voiceIndex]}` : undefined,
                              cursor: resizeState ? 'ew-resize' : 'grab',
                              zIndex: 5
                            }}
                          >
                            <span className="text-[10px] font-bold text-slate-900 pointer-events-none">
                              {note.pitch.replace(/\d/, '')}
                            </span>
                            {/* Resize handle */}
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r"
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Drag preview notes */}
            {dragState?.isDragging && selectedNotes.size > 0 && (
              <>
                {cantusFirmus.filter(n => selectedNotes.has(getNoteKey(n.pitch, n.beat))).map(note => {
                  const newPitchIdx = pitches.indexOf(note.pitch) + dragOffset.pitchDelta;
                  const newBeat = note.beat + dragOffset.beatDelta;
                  if (newPitchIdx < 0 || newPitchIdx >= pitches.length || newBeat < 0 || newBeat >= totalBeats) return null;

                  const duration = note.duration || DEFAULT_DURATION;
                  const noteWidth = duration * CELL_WIDTH - 4;

                  return (
                    <div
                      key={`preview-${note.pitch}-${note.beat}`}
                      className="absolute rounded flex items-center justify-start pl-1 shadow-lg pointer-events-none z-10"
                      style={{
                        left: 56 + newBeat * CELL_WIDTH + 2,
                        top: 28 + newPitchIdx * CELL_HEIGHT + 2,
                        width: noteWidth,
                        height: CELL_HEIGHT - 4,
                        backgroundColor: NOTE_COLORS[0],
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
      
      <div className="flex items-center justify-between mt-3">
        <p className="text-white/50 text-xs">
          {tool === 'select' && 'Click notes to select, drag to move • Shift+click for multi-select'}
          {tool === 'marquee' && 'Click and drag to select multiple notes'}
          {tool === 'draw' && 'Click to add/remove notes'}
        </p>
        {selectedNotes.size > 0 && (
          <span className="text-amber-400 text-xs">{selectedNotes.size} selected</span>
        )}
      </div>
    </div>
  );
}