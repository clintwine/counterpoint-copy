import React from 'react';

// Velocity to color gradient: blue → green → yellow → red
const getVelocityColor = (velocity) => {
  const v = Math.max(0, Math.min(1, velocity));
  
  if (v < 0.33) {
    const t = v / 0.33;
    const r = Math.round(0 + t * 0);
    const g = Math.round(100 + t * 155);
    const b = Math.round(255 - t * 55);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (v < 0.66) {
    const t = (v - 0.33) / 0.33;
    const r = Math.round(0 + t * 255);
    const g = Math.round(255);
    const b = Math.round(200 - t * 200);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (v - 0.66) / 0.34;
    const r = Math.round(255);
    const g = Math.round(255 - t * 100);
    const b = Math.round(0);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

export default function ScoreMinimap({ 
  notes = [], 
  totalBeats, 
  totalPitches = 88,
  viewportStart = 0,
  viewportEnd = 16,
  viewportPitchStart = 0,
  viewportPitchEnd = 20,
  currentBeat = 0,
  onSeek,
  pitches = []
}) {
  const width = 120;
  const height = 60;
  
  // Calculate note positions
  const getNotePosition = (note) => {
    const x = (note.beat / totalBeats) * width;
    const pitchIndex = pitches.indexOf(note.pitch);
    const y = (pitchIndex / totalPitches) * height;
    const noteWidth = Math.max(1, ((note.duration || 1) / totalBeats) * width);
    return { x, y, width: noteWidth };
  };
  
  // Viewport rectangle
  const viewportX = (viewportStart / totalBeats) * width;
  const viewportWidth = ((viewportEnd - viewportStart) / totalBeats) * width;
  const viewportY = (viewportPitchStart / totalPitches) * height;
  const viewportHeight = ((viewportPitchEnd - viewportPitchStart) / totalPitches) * height;
  
  // Playhead position
  const playheadX = (currentBeat / totalBeats) * width;
  
  const [isDragging, setIsDragging] = React.useState(false);

  const handleSeek = (e) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.floor((x / width) * totalBeats);
    const clampedBeat = Math.max(0, Math.min(totalBeats - 1, beat));
    onSeek(clampedBeat);
    e.stopPropagation();
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleSeek(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);
  
  return (
    <div 
      className="bg-slate-900/90 rounded border border-slate-700 cursor-pointer relative overflow-hidden shadow-lg"
      style={{ width, height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      title="Click or drag to navigate"
    >
      {/* Notes */}
      {notes.map((note, idx) => {
        const pos = getNotePosition(note);
        return (
          <div
            key={`${note.pitch}-${note.beat}-${idx}`}
            className="absolute bg-amber-400/80"
            style={{
              left: pos.x,
              top: pos.y,
              width: Math.max(2, pos.width),
              height: 2,
            }}
          />
        );
      })}
      
      {/* Viewport indicator */}
      <div
        className="absolute border border-white/40 bg-white/5 pointer-events-none"
        style={{
          left: viewportX,
          top: viewportY,
          width: Math.max(4, viewportWidth),
          height: Math.max(4, viewportHeight),
        }}
      />
      
      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none"
        style={{ left: playheadX }}
      />
      
      {/* Label */}
      <span className="absolute bottom-0.5 right-1 text-[8px] text-white/40 pointer-events-none">
        MAP
      </span>
    </div>
  );
}