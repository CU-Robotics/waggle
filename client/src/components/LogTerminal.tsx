import { useCallback, useEffect, useRef, useState } from "react";

interface LogTerminalProps {
  title: string;
  lines: string[];
}

interface AnsiSpan {
  text: string;
  style: React.CSSProperties;
}

const ANSI_COLORS: Record<number, string> = {
  30: "#6b7280",
  31: "#f87171",
  32: "#34d399",
  33: "#fbbf24",
  34: "#60a5fa",
  35: "#c084fc",
  36: "#22d3ee",
  37: "#e2e8f0",
  90: "#9ca3af",
  91: "#fca5a5",
  92: "#6ee7b7",
  93: "#fde047",
  94: "#93c5fd",
  95: "#d8b4fe",
  96: "#67e8f9",
  97: "#f8fafc",
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: "#1e1e1e",
  41: "#991b1b",
  42: "#166534",
  43: "#854d0e",
  44: "#1e40af",
  45: "#6b21a8",
  46: "#155e75",
  47: "#d4d4d4",
  100: "#404040",
  101: "#fca5a5",
  102: "#86efac",
  103: "#fde047",
  104: "#93c5fd",
  105: "#d8b4fe",
  106: "#67e8f9",
  107: "#ffffff",
};

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

function parseAnsi(line: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  ANSI_REGEX.lastIndex = 0;
  let style: React.CSSProperties = {};
  let lastIndex = 0;
  let match;

  while ((match = ANSI_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        text: line.slice(lastIndex, match.index),
        style: { ...style },
      });
    }
    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0 || isNaN(code)) {
        style = {};
      } else if (code === 1) {
        style.fontWeight = "bold";
      } else if (code === 2) {
        style.opacity = 0.6;
      } else if (code === 3) {
        style.fontStyle = "italic";
      } else if (code === 4) {
        style.textDecoration = "underline";
      } else if (code === 9) {
        style.textDecoration = "line-through";
      } else if (ANSI_COLORS[code]) {
        style.color = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        style.backgroundColor = ANSI_BG_COLORS[code];
        style.borderRadius = "2px";
        style.padding = "0 2px";
      }
    }
    lastIndex = ANSI_REGEX.lastIndex;
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex), style: { ...style } });
  }
  if (spans.length === 0) {
    spans.push({ text: line, style: {} });
  }
  return spans;
}

const LINE_HEIGHT = 20;
const OVERSCAN = 10;

function LogTerminal({ title, lines }: LogTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(320);

  const parsedCacheRef = useRef<Map<string, AnsiSpan[]>>(new Map());

  const getParsed = useCallback((line: string): AnsiSpan[] => {
    const cache = parsedCacheRef.current;
    let result = cache.get(line);
    if (!result) {
      result = parseAnsi(line);
      cache.set(line, result);
      if (cache.size > 5000) {
        const iter = cache.keys();
        for (let i = 0; i < 1000; i++) {
          const key = iter.next().value;
          if (key !== undefined) cache.delete(key);
        }
      }
    }
    return result;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewHeight(el.clientHeight);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const totalHeight = lines.length * LINE_HEIGHT;
  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN,
  );
  const endIdx = Math.min(
    lines.length,
    Math.ceil((scrollTop + viewHeight) / LINE_HEIGHT) + OVERSCAN,
  );

  return (
    <div className="glass-panel flex flex-col overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-yellow-400/80" />
            <span className="size-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
            {lines.length} lines
          </span>
          {!autoScroll && (
            <button
              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-bright)] transition-colors"
              onClick={() => {
                setAutoScroll(true);
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
            >
              Resume
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto font-mono text-xs p-3 no-transition bg-[var(--color-surface-0)] text-[var(--color-text-secondary)]"
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {lines.slice(startIdx, endIdx).map((line, i) => {
            const idx = startIdx + i;
            const spans = getParsed(line);
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  top: idx * LINE_HEIGHT,
                  left: 0,
                  right: 0,
                  height: LINE_HEIGHT,
                  lineHeight: `${LINE_HEIGHT}px`,
                }}
                className="whitespace-pre-wrap break-all hover:bg-[var(--color-surface-2)] px-1 rounded-sm"
              >
                <span className="text-[var(--color-text-muted)] select-none mr-3 inline-block w-8 text-right">
                  {idx + 1}
                </span>
                {spans.map((span, j) => (
                  <span key={j} style={span.style}>
                    {span.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LogTerminal;
