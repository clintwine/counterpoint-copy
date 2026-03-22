import React from 'react';

export default function NoteGridNotes({
  notesAtPosition,
  voiceIndex,
  note,
  pitch,
  beat,
  CELL_WIDTH,
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
  dragState,
  originalDragNotesRef,
  onMouseDown,
  onTouchStart,
  resizeState,
  cantusFirmus,
  playNoteSound,
  getEventCoords,
  setResizeState,
  pitches,
  setDragState,
  setPendingNote,
  selectedNotesSet,
  setSelectedNotes
}) {
  return notesAtPosition.map(({ voiceIndex: vIdx, note: n }) => {
    const duration = n.duration || DEFAULT_DURATION;
    const noteWidth = duration * CELL_WIDTH - 4;
    const nKey = getNoteKey(n.pitch, n.beat);
    const isBeingDragged = dragState?.isDragging && originalDragNotesRef.current?.keys?.has(nKey);

    const noteVelocity = n.velocity ?? 0.8;
    const velocityColor = vIdx === 0 ? getVelocityColor(noteVelocity) : NOTE_COLORS[vIdx];
    const noteInLoop = loopStart !== null && loopEnd !== null && n.beat >= loopStart && n.beat < loopEnd;
    
    return (
      <div
        key={`${vIdx}-${n.beat.toFixed(3)}-${n.pitch}`}
        onMouseDown={async (e) => {
          e.stopPropagation();
          setPendingNote(null);
          if (onMouseDown) onMouseDown(null, null);

          const coords = getEventCoords(e);
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = coords.clientX - rect.left;
          await playNoteSound(pitch, n);

          if (clickX > rect.width - 10) {
            const startNotes = [];
            if (selectedNotesSet.has(nKey) && selectedNotesSet.size > 0) {
              cantusFirmus.forEach(cn => {
                if (selectedNotesSet.has(getNoteKey(cn.pitch, cn.beat))) {
                  startNotes.push({ pitch: cn.pitch, beat: cn.beat, duration: cn.duration || DEFAULT_DURATION });
                }
              });
            } else {
              startNotes.push({ pitch: n.pitch, beat: n.beat, duration: n.duration || DEFAULT_DURATION });
            }
            setResizeState({ startX: coords.clientX, startNotes, edge: 'right' });
          } else if (clickX < 10) {
            const startNotes = [];
            if (selectedNotesSet.has(nKey) && selectedNotesSet.size > 0) {
              cantusFirmus.forEach(cn => {
                if (selectedNotesSet.has(getNoteKey(cn.pitch, cn.beat))) {
                  startNotes.push({ pitch: cn.pitch, beat: cn.beat, duration: cn.duration || DEFAULT_DURATION });
                }
              });
            } else {
              startNotes.push({ pitch: n.pitch, beat: n.beat, duration: n.duration || DEFAULT_DURATION });
            }
            setResizeState({ startX: coords.clientX, startNotes, edge: 'left' });
          } else {
            const wasSelected = selectedNotesSet.has(nKey);
            const keysToUse = wasSelected ? new Set(selectedNotesSet) : new Set([nKey]);
            const notesToStore = cantusFirmus.filter(cn => keysToUse.has(getNoteKey(cn.pitch, cn.beat))).map(cn => ({
              pitch: cn.pitch,
              beat: cn.beat,
              duration: cn.duration || DEFAULT_DURATION,
              velocity: cn.velocity,
              articulation: cn.articulation,
              bendStart: cn.bendStart,
              bendEnd: cn.bendEnd,
              bendStartTime: cn.bendStartTime,
              bendEndTime: cn.bendEndTime
            }));

            originalDragNotesRef.current = {
              keys: new Set(notesToStore.map(cn => getNoteKey(cn.pitch, cn.beat))),
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
            setPendingNote(null);
          }
        }}
        className={`absolute top-0.5 bottom-0.5 left-0.5 rounded flex items-center justify-start pl-1 shadow-md ${
          selectedNotesSet.has(nKey) ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800' : noteInLoop && isLooping ? 'ring-2 ring-amber-400/60' : ''
        }`}
        style={{ 
          left: `${(n.beat - Math.floor(n.beat)) * CELL_WIDTH + 2}px`,
          width: noteWidth,
          minWidth: 20,
          backgroundColor: velocityColor,
          boxShadow: isCurrentBeat && isPlaying ? `0 0 8px ${velocityColor}` : undefined,
          cursor: resizeState ? 'ew-resize' : 'grab',
          zIndex: 5,
          opacity: isBeingDragged ? 0 : 1
        }}
      >
        <span className="text-[10px] font-bold text-slate-900 pointer-events-none">
          {n.pitch.replace(/\d/, '')}
        </span>
        {((n.bendStart !== undefined && n.bendStart !== 0) || (n.bendEnd !== undefined && n.bendEnd !== 0)) && (
          <span className="text-[8px] text-slate-900/70 ml-0.5 pointer-events-none">↕</span>
        )}
        <div className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-l" />
        <div className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 rounded-r" />
      </div>
    );
  });
}