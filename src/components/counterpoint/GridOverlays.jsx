import React, { useRef, useLayoutEffect } from 'react';

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
  setScrubPosition,
  headerRef
}) {
  const playheadRef = useRef(null);
  const gridRectRef = useRef(null);
  const headerRectRef = useRef(null);

  // Cache rects for drag ghost positioning (only needs resize updates)
  useLayoutEffect(() => {
    const update = () => {
      if (gridRef?.current) gridRectRef.current = gridRef.current.getBoundingClientRect();
      if (headerRef?.current) headerRectRef.current = headerRef.current.getBoundingClientRect();
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Update playhead position directly in DOM — no React state, no scroll math needed
  // The playhead is position:absolute inside the scrollable content div, so it scrolls naturally
  useLayoutEffect(() => {
    if (!playheadRef.current) return;
    playheadRef.current.style.left = `${smoothPlayhead * CELL_WIDTH}px`;
  }, [smoothPlayhead, CELL_WIDTH]);

  if (!gridRef?.current) return null;
  const gridRect = gridRectRef.current || gridRef.current.getBoundingClientRect();
  const scrollLeft = gridRef.current.scrollLeft;
  const scrollTop = gridRef.current.scrollTop;

  const makeScrubHandlers = () => ({
    onMouseDown: (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScrubbing(true);
      const onMove = (moveEvent) => {
        if (!gridRef.current) return;
        const r = gridRef.current.getBoundingClientRect();
        const x = moveEvent.clientX - r.left - 56 + gridRef.current.scrollLeft;
        let beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));
        if (snapToGrid) beat = Math.round(beat / quantizeGrid) * quantizeGrid;
        setScrubPosition(beat);
        onSeek && onSeek(beat);
      };
      const onUp = () => {
        setIsScrubbing(false);
        setScrubPosition(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    onTouchStart: (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScrubbing(true);
      const onMove = (moveEvent) => {
        if (!gridRef.current || !moveEvent.touches[0]) return;
        const r = gridRef.current.getBoundingClientRect();
        const x = moveEvent.touches[0].clientX - r.left - 56 + gridRef.current.scrollLeft;
        let beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));
        if (snapToGrid) beat = Math.round(beat / quantizeGrid) * quantizeGrid;
        setScrubPosition(beat);
        onSeek && onSeek(beat);
      };
      const onEnd = () => {
        setIsScrubbing(false);
        setScrubPosition(null);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    }
  });

  const scrubHandlers = makeScrubHandlers();

  return (
    <>
      {/* Playhead — absolute inside scrollable content, scrolls naturally with grid */}
      <div
        ref={playheadRef}
        className="absolute top-0 pointer-events-auto cursor-ew-resize"
        style={{
          left: `${smoothPlayhead * CELL_WIDTH}px`,
          width: 0,
          height: pitches.length * CELL_HEIGHT,
          zIndex: 10,
          transform: 'translateX(-50%)',
          willChange: 'left',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        {...scrubHandlers}
      >
        {/* Triangle indicator at top */}
        <div style={{
          width: 0, height: 0,
          borderLeft: `${Math.max(8, 10 * zoom)}px solid transparent`,
          borderRight: `${Math.max(8, 10 * zoom)}px solid transparent`,
          borderTop: `${Math.max(10, 12 * zoom)}px solid #ef4444`,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          flexShrink: 0,
          marginTop: '-1px',
        }} />
        {/* Vertical line */}
        <div style={{
          width: Math.max(2, 2 * zoom),
          flex: 1,
          backgroundColor: '#ef4444',
          boxShadow: '0 0 6px rgba(239,68,68,0.6)',
        }} />
      </div>

      {/* Drag ghost notes */}
      {dragState?.isDragging && originalDragNotes && originalDragNotes.map((note, idx) => {
        const newPitchIdx = pitches.indexOf(note.pitch) + dragOffset.pitchDelta;
        const newBeat = note.beat + dragOffset.beatDelta;
        if (newPitchIdx < 0 || newPitchIdx >= pitches.length) return null;
        const duration = note.duration || DEFAULT_DURATION;
        const noteWidth = duration * CELL_WIDTH - 4;
        return (
          <div
            key={`ghost-${idx}`}
            className="fixed rounded flex items-center justify-start pl-1 shadow-xl pointer-events-none"
            style={{
              left: `${gridRect.left + 56 + newBeat * CELL_WIDTH - scrollLeft + 2}px`,
              top: `${gridRect.top + newPitchIdx * CELL_HEIGHT - scrollTop + 2}px`,
              width: noteWidth,
              height: CELL_HEIGHT - 4,
              backgroundColor: getVelocityColor(note.velocity ?? 0.8),
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