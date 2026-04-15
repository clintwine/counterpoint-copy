import React from 'react';

const getVelocityColor = (velocity) => {
  const v = Math.max(0, Math.min(1, velocity));
  if (v < 0.4) {
    const t = v / 0.4;
    return `rgb(${Math.round(t * 0)}, ${Math.round(100 + t * 155)}, ${Math.round(255 - t * 55)})`;
  } else if (v < 0.7) {
    const t = (v - 0.4) / 0.3;
    return `rgb(${Math.round(t * 255)}, 255, ${Math.round(200 - t * 200)})`;
  } else {
    const t = (v - 0.7) / 0.3;
    return `rgb(255, ${Math.round(255 - t * 255)}, 0)`;
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

  const getNotePosition = (note) => {
    const x = (note.beat / totalBeats) * width;
    const pitchIndex = pitches.indexOf(note.pitch);
    const y = (pitchIndex / totalPitches) * height;
    const noteWidth = Math.max(1, ((note.duration || 1) / totalBeats) * width);
    return { x, y, width: noteWidth };
  };

  const viewportX = (viewportStart / totalBeats) * width;
  const viewportWidth = ((viewportEnd - viewportStart) / totalBeats) * width;
  const viewportY = (viewportPitchStart / totalPitches) * height;
  const viewportHeight = ((viewportPitchEnd - viewportPitchStart) / totalPitches) * height;
  const playheadX = (currentBeat / totalBeats) * width;

  const [isDragging, setIsDragging] = React.useState(false);

  const handleSeek = (e) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.floor((x / width) * totalBeats);
    onSeek(Math.max(0, Math.min(totalBeats - 1, beat)));
    e.stopPropagation();
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
      onMouseDown={(e) => { setIsDragging(true); handleSeek(e); }}
      onMouseMove={(e) => { if (isDragging) handleSeek(e); }}
      title="Click or drag to navigate"
    >
      {notes.map((note, idx) => {
        const pos = getNotePosition(note);
        return (
          <div
            key={`${note.pitch}-${note.beat}-${idx}`}
            className="absolute"
            style={{ left: pos.x, top: pos.y, width: Math.max(2, pos.width), height: 2, backgroundColor: getVelocityColor(note.velocity ?? 0.8), opacity: 0.8 }}
          />
        );
      })}
      <div
        className="absolute border border-white/40 bg-white/5 pointer-events-none"
        style={{ left: viewportX, top: viewportY, width: Math.max(4, viewportWidth), height: Math.max(4, viewportHeight) }}
      />
      <div className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none" style={{ left: playheadX }} />
    </div>
  );
}