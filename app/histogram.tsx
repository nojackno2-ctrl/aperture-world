"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  image: string;
};

type Mode = "all" | "luminance" | "channels";

export function Histogram({ image }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [stats, setStats] = useState<{ shadowPercent: number; highlightPercent: number; meanLum: number } | null>(null);

  useEffect(() => {
    let canceled = false;
    const img = new Image();
    img.src = image;

    img.onload = () => {
      if (canceled) return;
      const sampleWidth = 320;
      const sampleHeight = Math.round((img.height / img.width) * 320) || 180;

      const offCanvas = document.createElement("canvas");
      offCanvas.width = sampleWidth;
      offCanvas.height = sampleHeight;
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
      const imgData = offCtx.getImageData(0, 0, sampleWidth, sampleHeight);
      const data = imgData.data;

      const rBins = new Uint32Array(256);
      const gBins = new Uint32Array(256);
      const bBins = new Uint32Array(256);
      const yBins = new Uint32Array(256);

      let totalLum = 0;
      let shadowPixels = 0;
      let highlightPixels = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        rBins[r]++;
        gBins[g]++;
        bBins[b]++;
        yBins[y]++;

        totalLum += y;
        if (y < 12) shadowPixels++;
        if (y > 244) highlightPixels++;
      }

      setStats({
        shadowPercent: Math.round((shadowPixels / totalPixels) * 100),
        highlightPercent: Math.round((highlightPixels / totalPixels) * 100),
        meanLum: Math.round(totalLum / totalPixels),
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = 256;
      const height = 110;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      // Background graph box
      ctx.fillStyle = "rgba(8, 12, 10, 0.88)";
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(ratio => {
        const x = Math.round(width * ratio);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(0, Math.round(height * 0.5));
      ctx.lineTo(width, Math.round(height * 0.5));
      ctx.stroke();

      const findMax = (bins: Uint32Array) => {
        const sorted = Array.from(bins).sort((a, b) => a - b);
        const p99 = sorted[Math.floor(sorted.length * 0.99)] || 1;
        return Math.max(p99, 1);
      };

      const maxY = findMax(yBins);
      const maxR = findMax(rBins);
      const maxG = findMax(gBins);
      const maxB = findMax(bBins);

      const drawChannel = (bins: Uint32Array, maxVal: number, strokeStyle: string, fillStyle?: string) => {
        ctx.beginPath();
        for (let i = 0; i < 256; i++) {
          const val = bins[i];
          const h = Math.min(height, (val / maxVal) * (height - 6));
          const x = (i / 255) * (width - 1);
          const y = height - h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        if (fillStyle) {
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.closePath();
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };

      if (mode === "luminance") {
        drawChannel(yBins, maxY, "#e2e8e4", "rgba(226, 232, 228, 0.3)");
      } else if (mode === "channels") {
        drawChannel(rBins, maxR, "rgba(255, 90, 90, 0.85)");
        drawChannel(gBins, maxG, "rgba(90, 225, 110, 0.85)");
        drawChannel(bBins, maxB, "rgba(90, 175, 255, 0.85)");
      } else {
        drawChannel(yBins, maxY, "rgba(240, 245, 242, 0.9)", "rgba(200, 205, 202, 0.25)");
        drawChannel(rBins, maxR, "rgba(255, 90, 90, 0.7)");
        drawChannel(gBins, maxG, "rgba(90, 225, 110, 0.7)");
        drawChannel(bBins, maxB, "rgba(90, 175, 255, 0.7)");
      }
    };

    return () => {
      canceled = true;
    };
  }, [image, mode]);

  return (
    <div className="playback-histogram glass">
      <div className="histogram-header">
        <span className="histogram-title">色階分布圖</span>
        <div className="histogram-modes">
          <button
            type="button"
            className={mode === "all" ? "active" : ""}
            onClick={() => setMode("all")}
          >
            RGB+Y
          </button>
          <button
            type="button"
            className={mode === "luminance" ? "active" : ""}
            onClick={() => setMode("luminance")}
          >
            輝度
          </button>
          <button
            type="button"
            className={mode === "channels" ? "active" : ""}
            onClick={() => setMode("channels")}
          >
            RGB
          </button>
        </div>
      </div>
      <div className="histogram-canvas-wrap">
        <canvas ref={canvasRef} className="histogram-canvas" style={{ width: 256, height: 110 }} />
        <div className="histogram-axis">
          <span>0 暗部</span>
          <span>128</span>
          <span>255 高光</span>
        </div>
      </div>
      {stats && (
        <div className="histogram-stats">
          <span className={stats.shadowPercent > 12 ? "warn" : ""}>
            暗部 <b>{stats.shadowPercent}%</b>
          </span>
          <span>
            均值 <b>{stats.meanLum}</b>
          </span>
          <span className={stats.highlightPercent > 12 ? "warn" : ""}>
            高光 <b>{stats.highlightPercent}%</b>
          </span>
        </div>
      )}
    </div>
  );
}
