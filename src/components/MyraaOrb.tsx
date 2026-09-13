import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CompanionState } from '../types';
import { AudioEngine } from '../services/audioEngine';

interface MyraaOrbProps {
  state: CompanionState;
  micLevel: number;
  outputLevel: number;
  audioEngine: AudioEngine | null;
}

export const MyraaOrb: React.FC<MyraaOrbProps> = ({
  state,
  micLevel,
  outputLevel,
  audioEngine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    const freqArray = new Uint8Array(64);

    const render = () => {
      time += 0.03;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine active level and audio data
      let activeLevel = 0;
      if (state === 'MYRAA_SPEAKING') {
        activeLevel = Math.max(outputLevel, 0.2);
        if (audioEngine) audioEngine.getOutputFrequencyData(freqArray);
      } else if (state === 'USER_SPEAKING') {
        activeLevel = Math.max(micLevel, 0.25);
        if (audioEngine) audioEngine.getMicFrequencyData(freqArray);
      } else if (state === 'LISTENING') {
        activeLevel = 0.08 + Math.sin(time * 1.8) * 0.04;
      } else if (state === 'STANDBY') {
        activeLevel = 0.04 + Math.sin(time * 0.9) * 0.02;
      } else if (state === 'CONNECTING') {
        activeLevel = 0.15 + Math.sin(time * 3.5) * 0.08;
      }

      // Outer glow layer
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        150 + activeLevel * 90
      );

      if (state === 'ERROR') {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
        gradient.addColorStop(0.5, 'rgba(220, 38, 38, 0.25)');
        gradient.addColorStop(1, 'rgba(185, 28, 28, 0)');
      } else if (state === 'MYRAA_SPEAKING') {
        gradient.addColorStop(0, 'rgba(244, 114, 182, 0.65)');
        gradient.addColorStop(0.4, 'rgba(168, 85, 247, 0.4)');
        gradient.addColorStop(0.8, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
      } else if (state === 'USER_SPEAKING') {
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
        gradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.35)');
        gradient.addColorStop(1, 'rgba(3, 105, 161, 0)');
      } else if (state === 'INTERRUPTED') {
        gradient.addColorStop(0, 'rgba(251, 146, 60, 0.7)');
        gradient.addColorStop(0.6, 'rgba(249, 115, 22, 0.3)');
        gradient.addColorStop(1, 'rgba(194, 65, 12, 0)');
      } else if (state === 'CONNECTING') {
        gradient.addColorStop(0, 'rgba(192, 132, 252, 0.55)');
        gradient.addColorStop(0.6, 'rgba(147, 51, 234, 0.25)');
        gradient.addColorStop(1, 'rgba(107, 33, 168, 0)');
      } else if (state === 'LISTENING') {
        gradient.addColorStop(0, 'rgba(147, 51, 234, 0.4)');
        gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(67, 56, 202, 0)');
      } else {
        // DISCONNECTED / STANDBY
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(100, 116, 139, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 170 + activeLevel * 70, 0, Math.PI * 2);
      ctx.fill();

      // Fluid audio-reactive perimeter points
      const numPoints = 64;
      const baseRadius = 65 + activeLevel * 35;

      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const index = i % numPoints;
        const angle = (index / numPoints) * Math.PI * 2;
        const freqVal = (freqArray[index] || 0) / 255;
        let distortion = 0;

        if (state === 'MYRAA_SPEAKING' || state === 'USER_SPEAKING') {
          distortion =
            Math.sin(angle * 6 + time * 4) * 8 * activeLevel +
            Math.cos(angle * 4 - time * 3) * 6 * activeLevel +
            freqVal * 32;
        } else if (state === 'LISTENING' || state === 'CONNECTING') {
          distortion = Math.sin(angle * 4 + time * 2.5) * 4;
        }

        const r = baseRadius + distortion;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Core Orb Fill
      const innerGradient = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );

      if (state === 'ERROR') {
        innerGradient.addColorStop(0, '#f87171');
        innerGradient.addColorStop(1, '#dc2626');
      } else if (state === 'MYRAA_SPEAKING') {
        innerGradient.addColorStop(0, '#f472b6');
        innerGradient.addColorStop(0.4, '#c084fc');
        innerGradient.addColorStop(1, '#818cf8');
      } else if (state === 'USER_SPEAKING') {
        innerGradient.addColorStop(0, '#38bdf8');
        innerGradient.addColorStop(0.5, '#60a5fa');
        innerGradient.addColorStop(1, '#3b82f6');
      } else if (state === 'INTERRUPTED') {
        innerGradient.addColorStop(0, '#fbbf24');
        innerGradient.addColorStop(1, '#f97316');
      } else if (state === 'CONNECTING') {
        innerGradient.addColorStop(0, '#c084fc');
        innerGradient.addColorStop(1, '#6366f1');
      } else if (state === 'LISTENING') {
        innerGradient.addColorStop(0, '#c084fc');
        innerGradient.addColorStop(0.6, '#818cf8');
        innerGradient.addColorStop(1, '#6366f1');
      } else {
        innerGradient.addColorStop(0, '#93c5fd');
        innerGradient.addColorStop(0.5, '#a855f7');
        innerGradient.addColorStop(1, '#4f46e5');
      }

      ctx.fillStyle = innerGradient;
      ctx.fill();

      // Core highlight shimmer
      const highlight = ctx.createRadialGradient(
        centerX - baseRadius * 0.3,
        centerY - baseRadius * 0.35,
        2,
        centerX,
        centerY,
        baseRadius
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      highlight.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)');
      highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state, micLevel, outputLevel, audioEngine]);

  return (
    <div id="myraa-orb-container" className="relative flex flex-col items-center justify-center">
      {/* Canvas for dynamic audio-reactive fluid rendering */}
      <canvas
        ref={canvasRef}
        width={380}
        height={380}
        className="w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] pointer-events-none drop-shadow-2xl"
      />
      {/* State Dot Indicator */}
      <motion.div
        layout
        className="mt-2 flex items-center justify-center p-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg"
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            state === 'MYRAA_SPEAKING'
              ? 'bg-pink-500 animate-ping'
              : state === 'USER_SPEAKING'
              ? 'bg-sky-400 animate-pulse'
              : state === 'LISTENING'
              ? 'bg-indigo-400 animate-pulse'
              : state === 'STANDBY'
              ? 'bg-sky-400 animate-pulse'
              : state === 'CONNECTING'
              ? 'bg-purple-400 animate-spin'
              : state === 'INTERRUPTED'
              ? 'bg-amber-400'
              : state === 'SAVING_MEMORY'
              ? 'bg-emerald-400 animate-pulse'
              : state === 'ERROR'
              ? 'bg-red-500 animate-bounce'
              : 'bg-slate-500'
          }`}
        />
      </motion.div>
    </div>
  );
};
