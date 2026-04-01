import {
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import type { ReplayState } from "../hooks/useReplayPlayer";

interface PlayBarProps {
  replay: ReplayState;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSetSpeed: (speed: number) => void;
  onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export default function PlayBar({
  replay,
  onTogglePlay,
  onSeek,
  onStepForward,
  onStepBackward,
  onSetSpeed,
  onClose,
}: PlayBarProps) {
  const { frames, frameIndex, isPlaying, speed, fileName } = replay;
  const totalFrames = frames.length;

  const formatTimestamp = (index: number) => {
    if (totalFrames === 0) return "0:00";
    const t0 = frames[0].sent_timestamp;
    const t = frames[index].sent_timestamp;
    const msPerUnit = t0 > 1e11 ? 1 : 1000;
    const diffSec = Math.abs(t - t0) * msPerUnit / 1000;
    const mins = Math.floor(diffSec / 60);
    const secs = Math.floor(diffSec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b bg-white px-4 py-2 shadow-sm dark:border-neutral-600 dark:bg-neutral-900">
      {/* Close */}
      <button
        onClick={onClose}
        className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Close replay"
      >
        <IconX size={18} />
      </button>

      {/* File name */}
      <span className="max-w-48 truncate text-sm font-medium opacity-70">
        {fileName}
      </span>

      <div className="mx-1 h-6 w-px bg-neutral-300 dark:bg-neutral-600" />

      {/* Jump to start */}
      <button
        onClick={() => onSeek(0)}
        className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Jump to start"
      >
        <IconPlayerSkipBackFilled size={16} />
      </button>

      {/* Step backward */}
      <button
        onClick={onStepBackward}
        className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Previous frame"
      >
        <IconChevronLeft size={18} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="rounded-full bg-blue-500 p-2 text-white hover:bg-blue-600"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <IconPlayerPauseFilled size={18} />
        ) : (
          <IconPlayerPlayFilled size={18} />
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={onStepForward}
        className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Next frame"
      >
        <IconChevronRight size={18} />
      </button>

      {/* Jump to end */}
      <button
        onClick={() => onSeek(totalFrames - 1)}
        className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Jump to end"
      >
        <IconPlayerSkipForwardFilled size={18} />
      </button>

      <div className="mx-1 h-6 w-px bg-neutral-300 dark:bg-neutral-600" />

      {/* Timeline scrubber */}
      <span className="w-12 text-right font-mono text-xs">
        {formatTimestamp(frameIndex)}
      </span>
      <input
        type="range"
        min={0}
        max={totalFrames - 1}
        value={frameIndex}
        onChange={(e) => onSeek(parseInt(e.target.value))}
        className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-500"
      />
      <span className="w-12 font-mono text-xs">
        {formatTimestamp(totalFrames - 1)}
      </span>

      <div className="mx-1 h-6 w-px bg-neutral-300 dark:bg-neutral-600" />

      {/* Frame counter */}
      <span className="font-mono text-xs">
        {frameIndex + 1}/{totalFrames}
      </span>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => onSetSpeed(parseFloat(e.target.value))}
        className="rounded border px-1 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </div>
  );
}
