import React from 'react';

export default function Scrubber({ 
  smoothPlayhead, 
  totalBeats, 
  CELL_WIDTH, 
  onSeek, 
  gridRef 
}) {
  return (
    <div 
      className="flex h-6 border-b border-amber-900/50 select-none sticky top-0 z-30 relative bg-[#2B2B2B] cursor-pointer"
      onMouseDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const scrollLeft = gridRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left - 56 + scrollLeft;
        const beat = Math.max(0, Math.min(totalBeats - 0.125, x / CELL_WIDTH));
        onSeek?.(beat);
        
        const handleMouseMove = (moveEvent) => {
          const moveX = moveEvent.clientX - rect.left - 56 + (gridRef.current?.scrollLeft || 0);
          const moveBeat = Math.max(0, Math.min(totalBeats - 0.125, moveX / CELL_WIDTH));
          onSeek?.(moveBeat);
        };
        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }}
    >
      <div className="sticky left-0 z-20 flex-shrink-0" style={{ width: 56, backgroundColor: '#2B2B2B' }} />
      <div className="relative flex-1 h-full" style={{ backgroundColor: '#232323' }}>
        {/* Playhead position indicator */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-amber-400 pointer-events-none transition-all"
          style={{ left: `${(smoothPlayhead % totalBeats) * CELL_WIDTH}px` }}
        />
      </div>
    </div>
  );
}