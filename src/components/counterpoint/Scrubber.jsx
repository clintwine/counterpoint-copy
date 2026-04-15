// Scrubber v2 - cache bust, no cmdk dependency
import React from 'react';

function Scrubber({ smoothPlayhead, totalBeats, CELL_WIDTH, onSeek, gridRef }) {
  const handleMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = gridRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const beat = Math.max(0, Math.min(totalBeats - 0.125, x / CELL_WIDTH));
    onSeek?.(beat);

    const handleMouseMove = (moveEvent) => {
      const moveX = moveEvent.clientX - rect.left + (gridRef.current?.scrollLeft || 0);
      const moveBeat = Math.max(0, Math.min(totalBeats - 0.125, moveX / CELL_WIDTH));
      onSeek?.(moveBeat);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const beatCount = Math.ceil(totalBeats);

  return (
    <div
      className="flex h-6 border-b border-amber-900/50 select-none relative bg-[#2B2B2B] cursor-pointer hover:bg-[#383838] transition-colors"
      onMouseDown={handleMouseDown}
    >
      <div className="flex-shrink-0" style={{ width: 0, backgroundColor: '#2B2B2B' }} />
      <div className="relative flex-1 h-full" style={{ backgroundColor: '#1F1F1F' }}>
        {Array.from({ length: beatCount }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-slate-700/30"
            style={{ left: `${i * CELL_WIDTH}px`, width: `${CELL_WIDTH}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export default Scrubber;