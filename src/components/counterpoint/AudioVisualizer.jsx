import React, { useRef, useEffect } from 'react';
import { getAnalyser } from './audioEngine';

export default function AudioVisualizer() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const smoothingFactor = 0.7;
    let previousData = null;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      const analyserNode = getAnalyser();
      if (!analyserNode) {
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, rect.width, rect.height);
        return;
      }

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      if (previousData) {
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = previousData[i] * smoothingFactor + dataArray[i] * (1 - smoothingFactor);
        }
      }
      previousData = new Uint8Array(dataArray);

      const bgGradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      bgGradient.addColorStop(0, '#1A1A1A');
      bgGradient.addColorStop(1, '#0F0F0F');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      const numBars = 80;
      const barWidth = rect.width / numBars;
      const gap = 1.5;

      for (let i = 0; i < numBars; i++) {
        const startIdx = Math.floor((i / numBars) * bufferLength);
        const endIdx = Math.floor(((i + 1) / numBars) * bufferLength);
        let sum = 0, count = 0;
        for (let j = startIdx; j < endIdx; j++) { sum += dataArray[j]; count++; }
        const value = count > 0 ? sum / count : 0;
        const boosted = Math.pow(value / 255, 0.7) * 255;
        const barHeight = (boosted / 255) * (rect.height - 16) * 1.8;
        const x = i * barWidth;

        const gradient = ctx.createLinearGradient(x, rect.height - barHeight, x, rect.height);
        if (barHeight < rect.height * 0.3) {
          gradient.addColorStop(0, '#00D4FF'); gradient.addColorStop(1, '#0088FF');
        } else if (barHeight < rect.height * 0.6) {
          gradient.addColorStop(0, '#00FF88'); gradient.addColorStop(0.5, '#88FF00'); gradient.addColorStop(1, '#00D4FF');
        } else if (barHeight < rect.height * 0.8) {
          gradient.addColorStop(0, '#FFCC00'); gradient.addColorStop(0.5, '#00FF88'); gradient.addColorStop(1, '#00D4FF');
        } else {
          gradient.addColorStop(0, '#FF3333'); gradient.addColorStop(0.3, '#FFAA00'); gradient.addColorStop(0.6, '#00FF88'); gradient.addColorStop(1, '#00D4FF');
        }

        ctx.fillStyle = gradient;
        const radius = 2;
        ctx.beginPath();
        ctx.moveTo(x, rect.height);
        ctx.lineTo(x, rect.height - barHeight + radius);
        ctx.arcTo(x, rect.height - barHeight, x + barWidth - gap, rect.height - barHeight, radius);
        ctx.lineTo(x + barWidth - gap, rect.height);
        ctx.closePath();
        ctx.fill();

        if (value > 180) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = barHeight > rect.height * 0.8 ? '#FF3333' : '#00FF88';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const y = (rect.height / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
      }

      const freqMarkers = [
        { freq: '20Hz', pos: 0.02 }, { freq: '100Hz', pos: 0.15 }, { freq: '500Hz', pos: 0.35 },
        { freq: '1kHz', pos: 0.5 }, { freq: '5kHz', pos: 0.75 }, { freq: '10kHz', pos: 0.9 }
      ];
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      freqMarkers.forEach(marker => ctx.fillText(marker.freq, marker.pos * rect.width, 10));
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="rounded w-full h-full block" />;
}