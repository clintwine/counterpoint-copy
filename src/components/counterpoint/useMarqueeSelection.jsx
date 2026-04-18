import { useRef, useCallback } from 'react';

export function useMarqueeSelection() {
  const autoScrollRef = useRef(null);

  const handleMarqueeMove = useCallback((coords, gridRef, marquee, setMarquee) => {
    setMarquee(prev => ({ ...prev, endX: coords.clientX, endY: coords.clientY }));
    
    // Auto-scroll when marquee selection approaches grid edges
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const edgeThreshold = 60;
      const maxSpeed = 14;
      let vx = 0, vy = 0;
      
      if (coords.clientX > rect.right - edgeThreshold)
        vx = maxSpeed * Math.min(1, (coords.clientX - (rect.right - edgeThreshold)) / edgeThreshold);
      else if (coords.clientX < rect.left + edgeThreshold + 56)
        vx = -maxSpeed * Math.min(1, ((rect.left + edgeThreshold + 56) - coords.clientX) / edgeThreshold);
      
      if (coords.clientY > rect.bottom - edgeThreshold)
        vy = maxSpeed * Math.min(1, (coords.clientY - (rect.bottom - edgeThreshold)) / edgeThreshold);
      else if (coords.clientY < rect.top + edgeThreshold)
        vy = -maxSpeed * Math.min(1, ((rect.top + edgeThreshold) - coords.clientY) / edgeThreshold);

      if (vx !== 0 || vy !== 0) {
        if (!autoScrollRef.current) {
          const loop = () => {
            if (!autoScrollRef.current) return;
            if (gridRef.current) {
              gridRef.current.scrollLeft += autoScrollRef.current.vx;
              gridRef.current.scrollTop += autoScrollRef.current.vy;
            }
            autoScrollRef.current.raf = requestAnimationFrame(loop);
          };
          autoScrollRef.current = { vx, vy, raf: requestAnimationFrame(loop) };
        } else {
          autoScrollRef.current.vx = vx;
          autoScrollRef.current.vy = vy;
        }
      } else if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current.raf);
        autoScrollRef.current = null;
      }
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current.raf);
      autoScrollRef.current = null;
    }
  }, []);

  return { handleMarqueeMove, stopAutoScroll, autoScrollRef };
}