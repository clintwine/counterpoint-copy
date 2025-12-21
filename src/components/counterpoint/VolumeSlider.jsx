import React, { useRef, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { getAnalyser } from './audioEngine';

export default function VolumeSlider({ value, onChange, className = '' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = 140;
    const height = 24;
    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const analyserNode = getAnalyser();
      
      // Clear background
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, width, height);

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

        // Draw level bars for both channels (simulated stereo)
        const channelHeight = 10;
        const gap = 2;
        
        // Left channel (top) - with slight variation for stereo effect
        const leftLevel = Math.min(1, normalizedLevel * (0.93 + Math.random() * 0.14));
        const leftWidth = Math.min(width - 4, (leftLevel * (width - 4)));
        
        // Gradient based on level
        const leftGradient = ctx.createLinearGradient(2, 2, width - 2, 2);
        if (leftLevel < 0.6) {
          leftGradient.addColorStop(0, '#10b981');
          leftGradient.addColorStop(1, '#10b981');
        } else if (leftLevel < 0.85) {
          leftGradient.addColorStop(0, '#10b981');
          leftGradient.addColorStop(0.6, '#f59e0b');
          leftGradient.addColorStop(1, '#f59e0b');
        } else {
          leftGradient.addColorStop(0, '#10b981');
          leftGradient.addColorStop(0.6, '#f59e0b');
          leftGradient.addColorStop(0.85, '#ef4444');
          leftGradient.addColorStop(1, '#ef4444');
        }

        ctx.fillStyle = leftGradient;
        ctx.fillRect(2, 2, leftWidth, channelHeight);

        // Right channel (bottom) - with slight variation for stereo effect
        const rightLevel = Math.min(1, normalizedLevel * (0.93 + Math.random() * 0.14));
        const rightWidth = Math.min(width - 4, (rightLevel * (width - 4)));
        
        const rightGradient = ctx.createLinearGradient(2, 2 + channelHeight + gap, width - 2, 2 + channelHeight + gap);
        if (rightLevel < 0.6) {
          rightGradient.addColorStop(0, '#10b981');
          rightGradient.addColorStop(1, '#10b981');
        } else if (rightLevel < 0.85) {
          rightGradient.addColorStop(0, '#10b981');
          rightGradient.addColorStop(0.6, '#f59e0b');
          rightGradient.addColorStop(1, '#f59e0b');
        } else {
          rightGradient.addColorStop(0, '#10b981');
          rightGradient.addColorStop(0.6, '#f59e0b');
          rightGradient.addColorStop(0.85, '#ef4444');
          rightGradient.addColorStop(1, '#ef4444');
        }

        ctx.fillStyle = rightGradient;
        ctx.fillRect(2, 2 + channelHeight + gap, rightWidth, channelHeight);
      }

      // Draw volume slider knob position
      const knobX = 2 + (value / 100) * (width - 24);
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(knobX + 10, height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner knob highlight
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(knobX + 10, height / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Volume2 className="w-4 h-4 text-white/60 flex-shrink-0" />
      <canvas
        ref={canvasRef}
        width={140}
        height={24}
        className="cursor-pointer rounded border border-slate-600"
        onMouseDown={handleMouseDown}
        style={{ width: '140px', height: '24px' }}
      />
      <span className="text-xs text-white/60 w-8 text-right flex-shrink-0">{Math.round(value)}</span>
    </div>
  );
}