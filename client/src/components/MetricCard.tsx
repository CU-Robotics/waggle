import { useMemo } from "react";
import { GraphData } from "../types";

interface MetricCardProps {
  title: string;
  data: GraphData[];
  isActive: boolean;
  onClick: () => void;
}

function Sparkline({
  data,
  color,
  width = 80,
  height = 28,
}: {
  data: GraphData[];
  color: string;
  width?: number;
  height?: number;
}) {
  const path = useMemo(() => {
    if (data.length < 2) return "";

    // Use last 60 points for sparkline
    const slice = data.length > 60 ? data.slice(data.length - 60) : data;
    const yValues = slice.map((d) => d.y);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const yRange = yMax - yMin || 1;

    const points = slice.map((d, i) => {
      const x = (i / (slice.length - 1)) * width;
      const y = height - ((d.y - yMin) / yRange) * height;
      return `${x},${y}`;
    });

    return `M${points.join("L")}`;
  }, [data, width, height]);

  if (!path) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
}

function MetricCard({ title, data, isActive, onClick }: MetricCardProps) {
  const currentValue = data.length > 0 ? data[data.length - 1].y : 0;

  return (
    <button
      onClick={onClick}
      className={`glass-panel glow-hover flex flex-col gap-2 p-3 text-left cursor-pointer transition-all duration-200 min-w-[150px] ${
        isActive
          ? "ring-1 ring-[var(--color-accent)] shadow-[0_0_16px_var(--color-accent-glow)]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] truncate">
          {title}
        </span>
        <div
          className={`size-1.5 rounded-full shrink-0 bg-[#6366f1] ${isActive ? "opacity-100" : "opacity-30"}`}
        />
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-bold font-mono tabular-nums leading-none text-[#6366f1]">
          {currentValue.toFixed(2)}
        </span>
        <Sparkline data={data} color="#6366f1" />
      </div>
    </button>
  );
}

export default MetricCard;
