import { useEffect, useRef, useMemo, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { GraphData } from "../types";
import { IconX } from "@tabler/icons-react";

interface LiveGraphProps {
  title: string;
  data: GraphData[];
  onRemove: () => void;
}

const STROKE_COLOR = "#6366f1";
const FILL_COLOR = "rgba(99, 102, 241, 0.08)";

function LiveGraph({ title, data, onRemove }: LiveGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  const latestValue = data.length > 0 ? data[data.length - 1].y : 0;

  // Convert [{x,y},...] to uPlot's columnar [[xs],[ys]]
  const aligned = useMemo((): [number[], number[]] => {
    const xs = new Array(data.length);
    const ys = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
      xs[i] = data[i].x;
      ys[i] = data[i].y;
    }
    return [xs, ys];
  }, [data]);

  const makeOpts = useCallback(
    (width: number): uPlot.Options => ({
      width,
      height: 200,
      cursor: {
        show: true,
        drag: { x: true, y: false },
      },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true, range: (_u, min, max) => {
          const pad = (max - min) * 0.05 || 1;
          return [min - pad, max + pad];
        }},
      },
      axes: [
        {
          stroke: "var(--color-text-muted)",
          grid: { show: false },
          ticks: { show: false },
          font: "10px var(--font-mono)",
          gap: 4,
          size: 28,
          values: (_u, vals) => vals.map((v) => v.toFixed(1)),
        },
        {
          stroke: "var(--color-text-muted)",
          grid: { show: false },
          ticks: { show: false },
          font: "10px var(--font-mono)",
          gap: 4,
          size: 50,
          values: (_u, vals) => vals.map((v) => v.toFixed(2)),
        },
      ],
      series: [
        {},
        {
          stroke: STROKE_COLOR,
          width: 1.5,
          fill: FILL_COLOR,
          points: { show: false },
        },
      ],
    }),
    [],
  );

  // Create uPlot instance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth;
    const opts = makeOpts(width);
    const plot = new uPlot(opts, aligned, el);
    uplotRef.current = plot;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && uplotRef.current) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0 && w !== uplotRef.current.width) {
          uplotRef.current.setSize({ width: w, height: 200 });
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plot.destroy();
      uplotRef.current = null;
    };
  }, [makeOpts]);

  // Update data without recreating the chart
  useEffect(() => {
    if (uplotRef.current && aligned[0].length > 0) {
      uplotRef.current.setData(aligned);
    }
  }, [aligned]);

  return (
    <div className="glass-panel glow-hover flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 border-[var(--color-border)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-2 rounded-full shrink-0 bg-[#6366f1]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold tabular-nums text-[#6366f1]">
            {latestValue.toFixed(2)}
          </span>
          <button
            onClick={onRemove}
            className="rounded-md p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            aria-label="Remove graph"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      {/* Chart - uPlot mounts here */}
      <div ref={containerRef} className="no-transition w-full" />
    </div>
  );
}

export default LiveGraph;
