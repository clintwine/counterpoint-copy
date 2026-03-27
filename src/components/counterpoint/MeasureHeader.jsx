import React, { useRef } from 'react';

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
  gridRef,
}) {
  const mouseDownPos = useRef(null);
  const isDragging = useRef(false);

  const selectedBeatsInMeasure = new Set(
    cantusFirmus
      .filter(n => n.beat >= measureStartBeat && n.beat < measureStartBeat + beatsPerMeasure && selectedNotes.has(getNoteKey(n.pitch, n.beat)))
      .map(n => Math.floor(n.beat) - measureStartBeat)
  );

  const getBeatFromClientX = (clientX) => {
    if (!gridRef?.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const scrollLeft = gridRef.current.scrollLeft;
    const x = clientX - rect.left - 56 + scrollLeft;
    return Math.max(0, Math.floor(x / CELL_WIDTH));
  };

  const handleMeasureMouseDown = (e) => {
    e.stopPropagation();
    isDragging.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };

    const startBeat = getBeatFromClientX(e.clientX);
    if (startBeat === null) return;

    const handleMouseMove = (moveEvent) => {
      const dx = Math.abs(moveEvent.clientX - mouseDownPos.current.x);
      if (dx > 5) isDragging.current = true;

      if (isDragging.current) {
        const moveBeat = getBeatFromClientX(moveEvent.clientX);
        if (moveBeat !== null) {
          const start = Math.min(startBeat, moveBeat);
          const end = Math.max(startBeat, moveBeat) + 1;
          onLoopChange?.(start, end);
        }
      }
    };

    const handleMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!isDragging.current) {
        // It was a click — handle toggle
        const measureStart = measureStartBeat;
        const measureEnd = measureStartBeat + beatsPerMeasure;
        const clickedBeat = getBeatFromClientX(upEvent.clientX);
        const isClickInLoop = loopStart !== null && loopEnd !== null && clickedBeat >= loopStart && clickedBeat < loopEnd;

        if (isClickInLoop) {
          // Clicking within existing loop — deselect it
          onLoopChange?.(null, null);
          setSelectedNotes(new Set());
        } else if (upEvent.shiftKey && loopStart !== null && loopEnd !== null) {
          const newStart = Math.min(loopStart, measureStart);
          const newEnd = Math.max(loopEnd, measureEnd);
          onLoopChange?.(newStart, newEnd);
          const measureNotes = cantusFirmus.filter(n => Math.floor(n.beat / beatsPerMeasure) === measureIndex);
          if (measureNotes.length > 0) {
            const measureKeys = new Set(measureNotes.map(n => getNoteKey(n.pitch, n.beat)));
            setSelectedNotes(prev => new Set([...prev, ...measureKeys]));
          }
        } else {
          onLoopChange?.(measureStart, measureEnd);
          const measureNotes = cantusFirmus.filter(n => Math.floor(n.beat / beatsPerMeasure) === measureIndex);
          const measureKeys = new Set(measureNotes.map(n => getNoteKey(n.pitch, n.beat)));
          setSelectedNotes(measureKeys);
        }
      }
      isDragging.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // click logic is handled inside handleMeasureMouseDown

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-start pl-2 text-sm font-semibold relative overflow-visible ${measureIndex > 0 ? 'border-l-2 border-l-slate-600' : ''}`}
      style={{ width: CELL_WIDTH * beatsPerMeasure, backgroundColor: '#3a3a3a', position: 'relative' }}
      onMouseDown={handleMeasureMouseDown}
    >
      {false && selectedBeatsInMeasure.size > 0 && Array.from(selectedBeatsInMeasure).map(beatOffset => (
        <div
          key={`sel-${beatOffset}`}
          className="absolute top-0 bottom-0 pointer-events-none z-0"
          style={{ left: `${beatOffset * CELL_WIDTH}px`, width: `${CELL_WIDTH}px`, backgroundColor: '#C8A570' }}
        />
      ))}

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