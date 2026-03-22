import React from 'react';

export default function DragGhost({ dragState, dragOffset, originalDragNotes, pitches, CELL_WIDTH, CELL_HEIGHT, DEFAULT_DURATION, getVelocityColor, viewportState }) {
  if (!dragState?.isDragging || !originalDragNotes) return null;

  return (
    <>
      {originalDragNotes.map((note, idx) => {
        const newPitchIdx = pitches.indexOf(note.pitch) + dragOffset.pitchDelta;
        const newBeat = note.beat + dragOffset.beatDelta;
        if (newPitchIdx < 0 || newPitchIdx >= pitches.length) return null;

        const duration = note.duration || DEFAULT_DURATION;
        const noteWidth = duration * CELL_WIDTH - 4;
        const noteVelocity = note.velocity ?? 0.8;
        const velocityColor = getVelocityColor(noteVelocity);

        return (
          <div
            key={`ghost-${idx}`}
            className="absolute rounded flex items-center justify-start pl-1 shadow-xl pointer-events-none"
            style={{
              left: `${56 + newBeat * CELL_WIDTH + 2 - viewportState.scrollLeft}px`,
              top: `${28 + newPitchIdx * CELL_HEIGHT - viewportState.scrollTop + 2}px`,
              width: noteWidth,
              height: CELL_HEIGHT - 4,
              backgroundColor: velocityColor,
              opacity: 0.9,
              zIndex: 40
            }}
          >
            <span className="text-[10px] font-bold text-slate-900 pointer-events-none">
              {pitches[newPitchIdx].replace(/\d/, '')}
            </span>
          </div>
        );
      })}
    </>
  );
}