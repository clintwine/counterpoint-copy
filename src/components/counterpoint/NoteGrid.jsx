import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { MousePointer2, Square, Trash2, Copy, ClipboardPaste, Undo, Redo, Pencil, Download, FileVideo, FileAudio } from 'lucide-react';
import { initAudio, playNote } from './audioEngine';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const OCTAVES = [5, 4, 3, 2];

const NOTE_COLORS = {
  0: '#E8B885', // Voice 1 - Gold
  1: '#7B9E89', // Voice 2 - Sage
  2: '#9B8AA6', // Voice 3 - Lavender
  3: '#A68B7B', // Voice 4 - Warm brown
};

const CELL_WIDTH = 48;
const CELL_HEIGHT = 28;

export default function NoteGrid({ 
  voices, 
  currentBeat, 
  isPlaying, 
  measures = 8, 
  onNoteClick,
  onNotesUpdate,
  cantusFirmus = [],
  onExportMidi,
  onExportVideo
}) {
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const beatsPerMeasure = 4;
  const totalBeats = measures;

  const [tool, setTool] = useState('select'); // 'select', 'marquee', 'draw'
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [dragState, setDragState] = useState(null);
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

  // Scroll to current beat during playback
  useEffect(() => {
    if (isPlaying && gridRef.current && currentBeat > 4) {
      const scrollPosition = (currentBeat - 4) * CELL_WIDTH;
      gridRef.current.scrollLeft = scrollPosition;
    }
  }, [currentBeat, isPlaying]);

  const getNoteAtBeat = (voiceIndex, beat) => {
    const voice = voices[voiceIndex];
    if (!voice || !voice.notes) return null;
    return voice.notes.find(n => n.beat === beat);
  };

  const getNoteKey = (pitch, beat) => `${pitch}-${beat}`;

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

  const handleMouseDown = (e, pitch, beat) => {
    const noteKey = getNoteKey(pitch, beat);
    const hasNote = cantusFirmus.some(n => n.pitch === pitch && n.beat === beat);
    
    if (tool === 'draw') {
      // Draw mode - add/remove note (allows multiple notes per beat)
      if (hasNote) {
        const newNotes = cantusFirmus.filter(n => !(n.pitch === pitch && n.beat === beat));
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
      } else {
        // Allow multiple notes per beat - just add the new note
        const newNotes = [...cantusFirmus, { pitch, beat }].sort((a, b) => a.beat - b.beat);
        saveToHistory(newNotes);
        onNotesUpdate(newNotes);
        playNoteSound(pitch);
      }
    } else if (tool === 'select') {
      if (hasNote) {
        // Start dragging
        const isSelected = selectedNotes.has(noteKey);
        if (!isSelected && !e.shiftKey) {
          setSelectedNotes(new Set([noteKey]));
        } else if (e.shiftKey) {
          const newSelected = new Set(selectedNotes);
          if (newSelected.has(noteKey)) {
            newSelected.delete(noteKey);
          } else {
            newSelected.add(noteKey);
          }
          setSelectedNotes(newSelected);
        }
        
        setDragState({
          startPitch: pitch,
          startBeat: beat,
          startPitchIndex: pitches.indexOf(pitch),
          currentPitchIndex: pitches.indexOf(pitch),
          currentBeat: beat,
          isDragging: false
        });
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
    if (marquee) {
      setMarquee(prev => ({ ...prev, endX: e.clientX, endY: e.clientY }));
    } else if (dragState && selectedNotes.size > 0) {
      const cell = getCellFromPosition(e.clientX, e.clientY);
      if (cell) {
        setDragState(prev => ({
          ...prev,
          currentPitchIndex: cell.pitchIndex,
          currentBeat: cell.beat,
          isDragging: true
        }));
      }
    }
  };

  const handleMouseUp = () => {
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
          return { pitch: pitches[newPitchIdx], beat: newBeat };
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportVideo}
            disabled={cantusFirmus.length === 0}
            className="h-8 px-2 text-white/70 disabled:opacity-30"
            title="Export Video"
          >
            <FileVideo className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">Video</span>
          </Button>
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
        className="overflow-x-auto overflow-y-auto max-h-[400px] relative select-none"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="flex" ref={containerRef}>
          {/* Pitch labels - fixed column */}
          <div className="sticky left-0 z-20 bg-slate-800 flex-shrink-0">
            <div className="h-7 border-b border-slate-600" />
            {pitches.map((pitch) => (
              <div 
                key={pitch}
                className={`h-7 w-14 flex items-center justify-end pr-2 text-xs border-b border-slate-700 ${
                  pitch.startsWith('C') ? 'text-amber-400 font-semibold' : 'text-white/80'
                }`}
                style={{ backgroundColor: pitch.startsWith('C') ? 'rgba(251, 191, 36, 0.1)' : undefined }}
              >
                {pitch}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="flex-1">
            {/* Beat numbers header */}
            <div className="flex h-7 border-b border-slate-600">
              {Array.from({ length: totalBeats }).map((_, beat) => (
                <div 
                  key={beat}
                  className={`flex-shrink-0 flex items-center justify-center text-xs font-medium border-r ${
                    beat % beatsPerMeasure === 0 
                      ? 'border-r-slate-500 bg-slate-700/50 text-amber-400' 
                      : 'border-r-slate-700 text-white/60'
                  }`}
                  style={{ width: CELL_WIDTH }}
                >
                  {beat + 1}
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
                  
                  // Check if any voice has a note at this position
                  const notesAtPosition = voices.map((_, voiceIndex) => {
                    const note = getNoteAtBeat(voiceIndex, beat);
                    if (note && note.pitch === pitch) {
                      return { voiceIndex, note };
                    }
                    return null;
                  }).filter(Boolean);

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
                      {notesAtPosition.map(({ voiceIndex, note }) => (
                        <motion.div
                          key={voiceIndex}
                          initial={{ scale: 0 }}
                          animate={{ 
                            scale: 1,
                            opacity: showDragPreview ? 0.4 : 1
                          }}
                          className={`absolute inset-0.5 rounded flex items-center justify-center shadow-md ${
                            isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                          }`}
                          style={{ 
                            backgroundColor: NOTE_COLORS[voiceIndex],
                            boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${NOTE_COLORS[voiceIndex]}` : undefined
                          }}
                        >
                          <span className="text-[10px] font-bold text-slate-900">
                            {note.pitch.replace(/\d/, '')}
                          </span>
                        </motion.div>
                      ))}
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
                  
                  return (
                    <div
                      key={`preview-${note.pitch}-${note.beat}`}
                      className="absolute rounded flex items-center justify-center shadow-lg pointer-events-none z-10"
                      style={{
                        left: 56 + newBeat * CELL_WIDTH + 2,
                        top: 28 + newPitchIdx * CELL_HEIGHT + 2,
                        width: CELL_WIDTH - 4,
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