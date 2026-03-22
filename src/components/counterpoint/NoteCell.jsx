import React from 'react';

export default function NoteCell({
  voiceIndex,
  note,
  pitch,
  beat,
  pitches,
  CELL_WIDTH,
  CELL_HEIGHT,
  DEFAULT_DURATION,
  getVelocityColor,
  NOTE_COLORS,
  selectedNotes,
  getNoteKey,
  loopStart,
  loopEnd,
  isLooping,
  isCurrentBeat,
  isPlaying,
  resizeState,
  dragState,
  originalDragNotesRef,
  onMouseDown,
  onTouchStart,
  cantusFirmus,
  playNoteSound
}) {
  const nKey = getNoteKey(note.pitch, note.beat);
  const duration = note.duration || DEFAULT_DURATION;
  const noteWidth = duration * CELL_WIDTH - 4;
  const isBeingDragged = dragState?.isDragging && originalDragNotesRef.current?.keys?.has(nKey);
  
  const noteVelocity = note.velocity ?? 0.8;
  const velocityColor = voiceIndex === 0 ? getVelocityColor(noteVelocity) : NOTE_COLORS[voiceIndex];
  const noteInLoop = loopStart !== null && loopEnd !== null && note.beat >= loopStart && note.beat < loopEnd;

  return (
    <div
      key={`${voiceIndex}-${note.beat.toFixed(3)}-${note.pitch}`}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${
        selectedNotes.has(nKey) ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : noteInLoop && isLooping ? 'ring-2 ring-amber-400/60' : ''
      }`}
      data-dragging={isBeingDragged}
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
      <div className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-l" />
      <div className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r" />
    </div>
  );
}