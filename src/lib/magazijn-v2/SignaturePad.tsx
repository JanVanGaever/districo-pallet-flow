import { useEffect, useRef, useState } from "react";

type Props = { onChange: (hasSig: boolean) => void };

export function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!has) {
      setHas(true);
      onChange(true);
    }
  };
  const end = () => {
    drawing.current = false;
  };

  const simulate = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.65);
    ctx.bezierCurveTo(w * 0.25, h * 0.25, w * 0.35, h * 0.85, w * 0.45, h * 0.45);
    ctx.bezierCurveTo(w * 0.52, h * 0.2, w * 0.58, h * 0.8, w * 0.68, h * 0.5);
    ctx.bezierCurveTo(w * 0.75, h * 0.3, w * 0.8, h * 0.7, w * 0.88, h * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.78);
    ctx.lineTo(w * 0.8, h * 0.72);
    ctx.stroke();
    setHas(true);
    onChange(true);
  };

  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHas(false);
    onChange(false);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="block h-48 w-full touch-none rounded-xl border-2 border-dashed border-neutral-300 bg-white"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={simulate}
          className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700"
        >
          Handtekening simuleren
        </button>
        <button
          onClick={clear}
          className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700"
        >
          Wissen
        </button>
      </div>
    </div>
  );
}
