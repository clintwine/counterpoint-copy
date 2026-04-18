import React from 'react';

export default function Scrubber({ smoothPlayhead, totalBeats, CELL_WIDTH, onSeek, gridRef }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const seek = (moveEvent) => {
      if (!gridRef?.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left + gridRef.current.scrollLeft;
      const beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));
      onSeek && onSeek(beat);
    };
    seek(e);
    const onMove = (moveEvent) => seek(moveEvent);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div
      className="relative h-2 cursor-pointer select-none"
      style={{ width: `${totalBeats * CELL_WIDTH}px`, backgroundColor: '#2B2B2B' }}
      onMouseDown={handleMouseDown}
    >
      {/* No playhead here - rendered by GridOverlays */}
    </div>
  );
}