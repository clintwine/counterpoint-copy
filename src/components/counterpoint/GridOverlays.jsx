import React, { useRef, useLayoutEffect, useEffect, useCallback } from 'react';

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
  headerRef,
  scrubberRef
}) {
  const playheadRef = useRef(null);
  const gridRectRef = useRef(null);
  const headerRectRef = useRef(null);
  const scrubberRectRef = useRef(null);
  const smoothPlayheadRef = useRef(smoothPlayhead);
  const cellWidthRef = useRef(CELL_WIDTH);
  const rafRef = useRef(null);

  // Cache rects — refresh on resize
  useLayoutEffect(() => {
    const update = () => {
      if (gridRef?.current) gridRectRef.current = gridRef.current.getBoundingClientRect();
      if (headerRef?.current) headerRectRef.current = headerRef.current.getBoundingClientRect();
      if (scrubberRef?.current) scrubberRectRef.current = scrubberRef.current.getBoundingClientRect();
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Schedule a single rAF to apply the playhead position — deduplicates scroll + prop updates
  const schedulePlayheadUpdate = useCallback(() => {
    if (rafRef.current) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!playheadRef.current || !gridRef?.current || !gridRectRef.current) return;
      const x = gridRectRef.current.left + 56 + smoothPlayheadRef.current * cellWidthRef.current - gridRef.current.scrollLeft;
      playheadRef.current.style.transform = `translateX(${x}px)`;
    });
  }, []);

  // Keep refs in sync with latest props and schedule update
  useLayoutEffect(() => {
    smoothPlayheadRef.current = smoothPlayhead;
    cellWidthRef.current = CELL_WIDTH;
    schedulePlayheadUpdate();
  }, [smoothPlayhead, CELL_WIDTH]);

  // Subscribe to grid scroll events — schedule via rAF to coalesce with prop updates
  useEffect(() => {
    const grid = gridRef?.current;
    if (!grid) return;
    const onScroll = () => schedulePlayheadUpdate();
    grid.addEventListener('scroll', onScroll, { passive: true });
    return () => grid.removeEventListener('scroll', onScroll);
  }, [gridRef?.current, schedulePlayheadUpdate]);

  if (!gridRef?.current) return null;
  const gridRect = gridRectRef.current || gridRef.current.getBoundingClientRect();
  const headerRect = headerRectRef.current || gridRect;
  const scrubberRect = scrubberRectRef.current || (scrubberRef?.current ? scrubberRef.current.getBoundingClientRect() : headerRect);
  const scrollLeft = gridRef.current.scrollLeft;
  const scrollTop = gridRef.current.scrollTop;
  const contentLeft = gridRect.left + 56;

  const makeScrubHandlers = () => ({
    onMouseDown: (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScrubbing(true);
      let autoScrollRaf = null;
      let scrollSpeed = 0;

      const stopAutoScroll = () => {
        scrollSpeed = 0;
        if (autoScrollRaf) { cancelAnimationFrame(autoScrollRaf); autoScrollRaf = null; }
      };

      // Auto-scroll loop: runs independently, scrolls grid and updates seek
      const autoScrollLoop = () => {
        if (!gridRef.current || scrollSpeed === 0) { autoScrollRaf = null; return; }
        gridRef.current.scrollLeft += scrollSpeed;
        // Recompute current beat from the playhead's content position
        const currentBeatPos = smoothPlayheadRef.current;
        const newBeat = Math.max(0, Math.min(totalBeats - 1, currentBeatPos + scrollSpeed / CELL_WIDTH));
        setScrubPosition(newBeat);
        onSeek && onSeek(newBeat);
        autoScrollRaf = requestAnimationFrame(autoScrollLoop);
      };

      const onMove = (moveEvent) => {
        if (!gridRef.current) return;
        const grid = gridRef.current;

        // Compute which beat the cursor maps to in content space
        const rect = grid.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left - 56 + grid.scrollLeft;
        let beat = Math.max(0, Math.min(totalBeats - 1, x / CELL_WIDTH));
        if (snapToGrid) beat = Math.round(beat / quantizeGrid) * quantizeGrid;

        // Compute visible beat range
        const visibleStartBeat = grid.scrollLeft / CELL_WIDTH;
        const visibleEndBeat = (grid.scrollLeft + grid.clientWidth - 56) / CELL_WIDTH;
        const beatThreshold = 4; // beats from edge before scrolling kicks in
        const maxSpeed = 16;

        // Always seek to beat (keep playhead locked to mouse)
        setScrubPosition(beat);
        onSeek && onSeek(beat);

        if (beat > visibleEndBeat - beatThreshold) {
          // Near right edge — scroll right proportionally
          const overflow = beat - (visibleEndBeat - beatThreshold);
          scrollSpeed = Math.min(maxSpeed, overflow * CELL_WIDTH * 0.1);
          if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(autoScrollLoop);
        } else if (beat < visibleStartBeat + beatThreshold) {
          // Near left edge — scroll left proportionally
          const overflow = (visibleStartBeat + beatThreshold) - beat;
          scrollSpeed = -Math.min(maxSpeed, overflow * CELL_WIDTH * 0.1);
          if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(autoScrollLoop);
        } else {
          stopAutoScroll();
        }
      };
      const onUp = () => {
        stopAutoScroll();
        setIsScrubbing(false);
        setScrubPosition(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      onMove(e);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    onTouchStart: (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsScrubbing(true);
      const onMove = (moveEvent) => {
        if (!gridRef.current || !moveEvent.touches[0]) return;
        const rect = gridRef.current.getBoundingClientRect();
        const x = moveEvent.touches[0].clientX - rect.left - 56 + gridRef.current.scrollLeft;
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
  const initialX = contentLeft + smoothPlayhead * CELL_WIDTH - scrollLeft;

  return (
    <>
      {/*
        Playhead — fixed so it doesn't scroll vertically.
        Position is driven entirely by direct DOM writes (never by React re-renders),
        keeping it perfectly in sync with no jitter.
        zIndex is kept low so it sits behind the sticky pitch-label column.
      */}
      <div
        ref={playheadRef}
        className="fixed pointer-events-auto cursor-ew-resize"
        style={{
          left: 0,
          top: `${scrubberRect.top}px`,
          transform: `translateX(${initialX}px)`,
          willChange: 'transform',
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 0,
        }}
        {...scrubHandlers}
      >
        {/* Triangle */}
        <div style={{
          width: 0, height: 0,
          borderLeft: `${Math.max(8, 10 * zoom)}px solid transparent`,
          borderRight: `${Math.max(8, 10 * zoom)}px solid transparent`,
          borderTop: `${Math.max(10, 12 * zoom)}px solid #ef4444`,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          flexShrink: 0,
        }} />
        {/* Line */}
        <div style={{
          width: Math.max(2, 2 * zoom),
          height: gridRef?.current ? gridRef.current.clientHeight + 64 : pitches.length * CELL_HEIGHT,
          backgroundColor: '#ef4444',
          boxShadow: '0 0 8px rgba(239,68,68,0.6)',
          flexShrink: 0,
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
              left: `${contentLeft + newBeat * CELL_WIDTH - scrollLeft + 2}px`,
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