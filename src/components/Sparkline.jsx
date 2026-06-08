import { useEffect, useRef } from 'react';

// Tiny BTC price sparkline (~80px wide) drawn from gameState.btcPriceHistory.
export default function Sparkline({ data, width = 84, height = 30, color = '#f7931a' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pts = (data && data.length ? data : [0]).slice(-60);
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = max - min || 1;
    const x = (i) => (pts.length === 1 ? width : (i / (pts.length - 1)) * width);
    const y = (v) => height - 3 - ((v - min) / span) * (height - 6);

    // area fill
    ctx.beginPath();
    ctx.moveTo(0, height);
    pts.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(247,147,26,0.18)';
    ctx.fill();

    // line
    ctx.beginPath();
    pts.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();

    // last-point dot
    const lx = x(pts.length - 1), ly = y(pts[pts.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  return <canvas ref={ref} style={{ width, height, display: 'block' }} />;
}
