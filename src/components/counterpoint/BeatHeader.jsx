import React from 'react';
import MeasureHeader from './MeasureHeader';

export default function BeatHeader({ 
  measures, 
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
  getBeatFromHeaderPosition
}) {
  const handleMouseDown = (e) => {
    if (e.target !== e.currentTarget && e.target?.closest('span')) return;
    
    const beat = getBeatFromHeaderPosition(e.clientX);
    if (beat === null) return;

    const edgeThreshold = 2;
    let dragMode = 'new';
    
    if (loopStart !== null && loopEnd !== null) {
      if (Math.abs(beat - loopStart) <= edgeThreshold) {
        dragMode = 'start';
      } else if (Math.abs(beat - loopEnd) <= edgeThreshold) {
        dragMode = 'end';
      }
    }

    if (dragMode === 'new' && onLoopChange) {
      onLoopChange(beat, beat);
    }

    const handleMouseMove = (moveEvent) => {
      const moveBeat = getBeatFromHeaderPosition(moveEvent.clientX);
      if (moveBeat === null) return;

      if (dragMode === 'start') {
        const newStart = Math.floor(moveBeat);
        if (newStart < loopEnd) {
          onLoopChange?.(newStart, loopEnd);
        }
      } else if (dragMode === 'end') {
        const newEnd = Math.floor(moveBeat) + 1;
        if (newEnd > loopStart) {
          onLoopChange?.(loopStart, newEnd);
        }
      } else {
        const start = Math.min(beat, moveBeat);
        const end = Math.max(beat, moveBeat);
        if (onLoopChange) {
          onLoopChange(start, end);
        }
      }
    };

    const handleMouseUp = (upEvent) => {
      let upBeat = getBeatFromHeaderPosition(upEvent.clientX);
      if (upBeat !== null) {
        if (dragMode !== 'start' && dragMode !== 'end') {
          const snappedBeat = Math.floor(beat);
          const snappedUpBeat = Math.floor(upBeat);
          const dragDistance = Math.abs(snappedUpBeat - snappedBeat);

          if (dragDistance === 0) {
            if (onLoopChange) {
              onLoopChange(null, null);
            }
          } else {
            const start = Math.min(snappedBeat, snappedUpBeat);
            const end = Math.max(snappedBeat, snappedUpBeat) + 1;
            if (onLoopChange) {
              onLoopChange(start, end);
            }
          }
        }
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className="flex h-7 border-b border-amber-900/50 select-none relative cursor-pointer z-30"
      style={{ backgroundColor: '#3a3a3a' }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ width: '56px', flexShrink: 0 }} />
      {Array.from({ length: measures }).map((_, measureIndex) => {
        const measureStartBeat = measureIndex * beatsPerMeasure;
        return (
          <MeasureHeader 
            key={measureIndex} 
            measureIndex={measureIndex} 
            measureStartBeat={measureStartBeat} 
            beatsPerMeasure={beatsPerMeasure} 
            CELL_WIDTH={CELL_WIDTH} 
            loopStart={loopStart} 
            loopEnd={loopEnd} 
            isLooping={isLooping} 
            selectedNotes={selectedNotes} 
            isLoopSelecting={isLoopSelecting} 
            cantusFirmus={cantusFirmus} 
            getNoteKey={getNoteKey} 
            onLoopChange={onLoopChange} 
            setSelectedNotes={setSelectedNotes} 
            gridRef={gridRef} 
          />
        );
      })}
    </div>
  );
}