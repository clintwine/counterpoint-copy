import React from 'react';

export default function GridOverlays({ 
  marquee, 
  dragState, 
  dragOffset, 
  originalDragNotes,
  pitches,
  CELL_WIDTH,
  CELL_HEIGHT,
  DEFAULT_DURATION,
  getVelocityColor,
  viewportState,
  gridRef,
  smoothPlayhead,
  zoom,
  isPlaying,
  currentBeat,
  onSeek,
  snapToGrid,
  quantizeGrid,
  totalBeats,
  setIsScrubbing,
  setScrubPosition
}) {
  if (!gridRef?.current) return null;
  const gridRect = gridRef.current.getBoundingClientRect();
  const containerRect = gridRef.current.parentElement?.getBoundingClientRect();

  return (
    <>
      {/* Playhead vertical line - fixed positioning aligned with scrubber */}
      <div
        className="absolute z-30 pointer-events-none"
        style={{
          left: `${gridRect.left + 56 + smoothPlayhead * CELL_WIDTH - viewportState.scrollLeft}px`,
          top: 28,
          transform: 'translateX(-50%)',
          width: Math.max(2, 3 * zoom),
          height: pitches.length * CELL_HEIGHT,
          backgroundColor: '#ef4444',
          boxShadow: '0 0 8px rgba(239,68,68,0.6)'
        }}
      />

      {/* Drag ghost notes - absolute positioning inside grid */}
      {dragState?.isDragging && originalDragNotes && (
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
                  left: `${56 + newBeat * CELL_WIDTH + 2}px`,
                  top: `${28 + newPitchIdx * CELL_HEIGHT + 2}px`,
                  width: noteWidth,
                  height: CELL_HEIGHT - 4,
                  backgroundColor: velocityColor,
                  opacity: 0.9,
                  zIndex: 50
                }}
              >
                <span className="text-[10px] font-bold text-slate-900 pointer-events-none">
                  {pitches[newPitchIdx].replace(/\d/, '')}
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* Playhead triangle marker - fixed at header top */}
      <div
        className="fixed cursor-ew-resize"
        style={{
          left: `${gridRect.left + 56 + smoothPlayhead * CELL_WIDTH - viewportState.scrollLeft}px`,
          top: `${gridRect.top}px`,
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
    </>
  );
}