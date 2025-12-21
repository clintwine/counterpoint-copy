import React, { useRef, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { getAnalyser } from './audioEngine';

export default function VolumeSlider({ value, onChange, className = '' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const [leftLevel, setLeftLevel] = React.useState(0);
  const [rightLevel, setRightLevel] = React.useState(0);

  useEffect(() => {
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const analyserNode = getAnalyser();
      
      if (analyserNode) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        // Calculate RMS (root mean square) for each channel approximation
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avgValue = sum / bufferLength;
        const normalizedLevel = Math.min(1, (avgValue / 255) * 3.5); // 3.5x boost for better visualization

        // Update levels with slight variation for stereo effect
        setLeftLevel(Math.min(1, normalizedLevel * (0.93 + Math.random() * 0.14)));
        setRightLevel(Math.min(1, normalizedLevel * (0.93 + Math.random() * 0.14)));
      } else {
        setLeftLevel(0);
        setRightLevel(0);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const updateValue = (clientX) => {
      const x = clientX - rect.left;
      const newValue = Math.max(0, Math.min(100, (x / rect.width) * 100));
      onChange(newValue);
    };

    updateValue(e.clientX);

    const handleMouseMove = (moveEvent) => {
      updateValue(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getLevelColor = (level) => {
    if (level < 0.6) return '#10b981';
    if (level < 0.85) return '#f59e0b';
    return '#ef4444';
  };

  const getLevelGradient = (level) => {
    if (level < 0.6) {
      return 'linear-gradient(to right, #10b981, #10b981)';
    } else if (level < 0.85) {
      return 'linear-gradient(to right, #10b981 0%, #10b981 60%, #f59e0b 60%, #f59e0b 100%)';
    } else {
      return 'linear-gradient(to right, #10b981 0%, #10b981 60%, #f59e0b 60%, #f59e0b 85%, #ef4444 85%, #ef4444 100%)';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Volume2 className="w-4 h-4 text-white/60 flex-shrink-0" />
      <div
        ref={containerRef}
        className="relative cursor-pointer rounded border border-slate-600 overflow-hidden bg-slate-700"
        onMouseDown={handleMouseDown}
        style={{ width: '140px', height: '24px' }}
      >
        {/* Left channel (top) */}
        <div className="absolute top-0.5 left-0.5 right-0.5 h-[9px] bg-slate-800 rounded-sm overflow-hidden">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${leftLevel * 100}%`,
              background: getLevelGradient(leftLevel)
            }}
          />
        </div>

        {/* Right channel (bottom) */}
        <div className="absolute bottom-0.5 left-0.5 right-0.5 h-[9px] bg-slate-800 rounded-sm overflow-hidden">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${rightLevel * 100}%`,
              background: getLevelGradient(rightLevel)
            }}
          />
        </div>

        {/* Volume slider knob */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-100 shadow-lg pointer-events-none border border-slate-300"
          style={{ left: `calc(${value}% - 8px)` }}
        >
          <div className="absolute inset-1 rounded-full bg-slate-200" />
        </div>
      </div>
      <span className="text-xs text-white/60 w-8 text-right flex-shrink-0">{Math.round(value)}</span>
    </div>
  );
}