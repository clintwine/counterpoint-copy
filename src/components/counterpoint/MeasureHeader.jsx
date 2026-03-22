import React from 'react';

export default function MeasureHeader({
  measureIndex,
  measureStartBeat,
  beatsPerMeasure,
  CELL_WIDTH,
  loopStart,
  loopEnd,
  isLooping,
  selectedNotes,
  isLoopSelecting,
  cantusFirmus,
  getNoteKey,
  onLoopChange,
  setSelectedNotes,
  onSeek,
  snapToGrid,
  quantizeGrid,
  totalBeats
}) {
  const handleMeasureClick = (e) => {
    e.stopPropagation();
    if (!isLoopSelecting && selectedNotes.size === 0) {
      const measureStart = measureStartBeat;
      const measureEnd = measureStartBeat + beatsPerMeasure;
      const isAlreadyLooped = loopStart === measureStart && loopEnd === measureEnd;
      
      if (isAlreadyLooped && !e.shiftKey) {
        if (onLoopChange) onLoopChange(null, null);
        setSelectedNotes(new Set());
      } else if (e.shiftKey && loopStart !== null && loopEnd !== null) {
        const newStart = Math.min(loopStart, measureStart);
        const newEnd = Math.max(loopEnd, measureEnd);
        if (onLoopChange) onLoopChange(newStart, newEnd);
        const measureNotes = cantusFirmus.filter(n => Math.floor(n.beat / beatsPerMeasure) === measureIndex);
        if (measureNotes.length > 0) {
          const measureKeys = new Set(measureNotes.map(n => getNoteKey(n.pitch, n.beat)));
          setSelectedNotes(prev => new Set([...prev, ...measureKeys]));
        }
      } else {
        if (onLoopChange) onLoopChange(measureStart, measureEnd);
        const measureNotes = cantusFirmus.filter(n => Math.floor(n.beat / beatsPerMeasure) === measureIndex);
        if (measureNotes.length > 0) {
          const measureKeys = new Set(measureNotes.map(n => getNoteKey(n.pitch, n.beat)));
          setSelectedNotes(measureKeys);
        }
      }
    }
  };

  return (
    <div 
      className={`flex-shrink-0 flex items-center justify-start pl-2 text-sm font-semibold relative overflow-visible ${measureIndex > 0 ? 'border-l-2 border-l-slate-600' : ''}`}
      style={{ width: CELL_WIDTH * beatsPerMeasure, backgroundColor: '#3a3a3a' }}
      onClick={handleMeasureClick}
    >
      <span className="text-white font-bold pointer-events-none relative z-10">
        {measureIndex + 1}
      </span>

      {Array.from({ length: beatsPerMeasure }).map((_, beatIndex) => {
        const beat = measureStartBeat + beatIndex;
        const inLoop = loopStart !== null && loopEnd !== null && beat >= loopStart && beat < loopEnd;
        const isLoopStart = loopStart !== null && beat === Math.floor(loopStart);
        const isLoopEnd = loopEnd !== null && beat === Math.floor(loopEnd) - 1;
        if (!inLoop) return null;
        return (
          <div
            key={`bg-${beatIndex}`}
            className={`absolute top-0 bottom-0 pointer-events-none ${isLoopStart || isLoopEnd ? 'hover:cursor-col-resize' : ''}`}
            style={{
              left: `${beatIndex * CELL_WIDTH}px`,
              width: `${CELL_WIDTH}px`,
              backgroundColor: '#C8A570'
            }}
          />
        );
      })}
      
      {loopStart !== null && loopEnd !== null && (
        <>
          {Math.floor(loopStart) >= measureStartBeat && Math.floor(loopStart) < measureStartBeat + beatsPerMeasure && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-600/60 hover:bg-amber-500 transition-colors pointer-events-auto cursor-col-resize z-20"
              style={{ left: `${(Math.floor(loopStart) - measureStartBeat) * CELL_WIDTH}px` }}
            />
          )}
          {Math.floor(loopEnd) - 1 >= measureStartBeat && Math.floor(loopEnd) - 1 < measureStartBeat + beatsPerMeasure && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-600/60 hover:bg-amber-500 transition-colors pointer-events-auto cursor-col-resize z-20"
              style={{ left: `${(Math.floor(loopEnd) - measureStartBeat) * CELL_WIDTH - 1}px` }}
            />
          )}
        </>
      )}

      {Array.from({ length: beatsPerMeasure }).map((_, beatIndex) => (
        <div
          key={beatIndex}
          className="absolute top-0 pointer-events-none z-10"
          style={{
            left: `${beatIndex * CELL_WIDTH - 0.5}px`,
            width: '1px',
            height: beatIndex % 4 === 0 ? '12px' : '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)'
          }}
        />
      ))}
      <div
        className="absolute top-0 pointer-events-none z-10"
        style={{
          right: '-1px',
          width: '1px',
          height: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)'
        }}
      />
    </div>
  );
}