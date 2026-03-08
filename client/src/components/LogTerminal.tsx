import {useCallback, useEffect, useMemo, useRef, useState} from "react";

interface LogTerminalProps {
    title: string;
    lines: string[];
    isDarkMode: boolean;
}

interface AnsiSpan {
    text: string;
    style: React.CSSProperties;
}

const ANSI_COLORS: Record<number, string> = {
    30: "#1e1e1e", 31: "#ef4444", 32: "#22c55e", 33: "#eab308",
    34: "#3b82f6", 35: "#a855f7", 36: "#22d3ee", 37: "#d4d4d4",
    90: "#737373", 91: "#fca5a5", 92: "#86efac", 93: "#fde047",
    94: "#93c5fd", 95: "#d8b4fe", 96: "#67e8f9", 97: "#ffffff",
};

const ANSI_BG_COLORS: Record<number, string> = {
    40: "#1e1e1e", 41: "#ef4444", 42: "#22c55e", 43: "#eab308",
    44: "#3b82f6", 45: "#a855f7", 46: "#22d3ee", 47: "#d4d4d4",
    100: "#737373", 101: "#fca5a5", 102: "#86efac", 103: "#fde047",
    104: "#93c5fd", 105: "#d8b4fe", 106: "#67e8f9", 107: "#ffffff",
};

function parseAnsi(line: string): AnsiSpan[] {
    const spans: AnsiSpan[] = [];
    // eslint-disable-next-line no-control-regex
    const regex = /\x1b\[([0-9;]*)m/g;
    let style: React.CSSProperties = {};
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            spans.push({text: line.slice(lastIndex, match.index), style: {...style}});
        }
        const codes = match[1].split(";").map(Number);
        for (const code of codes) {
            if (code === 0 || isNaN(code)) {
                style = {};
            } else if (code === 1) {
                style.fontWeight = "bold";
            } else if (code === 2) {
                style.opacity = 0.7;
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
            }
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
        spans.push({text: line.slice(lastIndex), style: {...style}});
    }
    if (spans.length === 0) {
        spans.push({text: line, style: {}});
    }
    return spans;
}

function LogTerminal({title, lines, isDarkMode}: LogTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
        setAutoScroll(atBottom);
    }, []);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines, autoScroll]);

    const parsedLines = useMemo(() => lines.map(parseAnsi), [lines]);

    return (
        <div className="flex flex-col w-full ">
            <div
                className={`px-3 py-1.5 text-sm font-semibold rounded-t-md flex items-center justify-between ${
                    isDarkMode
                        ? "bg-neutral-600 text-neutral-200"
                        : "bg-neutral-200 text-neutral-700"
                }`}
            >
                <span>{title}</span>
                {!autoScroll && (
                    <button
                        className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
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
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={`h-64 overflow-y-auto font-mono text-xs leading-5 p-2 rounded-b-md border ${
                    isDarkMode
                        ? "bg-neutral-900 text-green-400 border-neutral-600"
                        : "bg-neutral-950 text-green-400 border-neutral-300"
                }`}
            >
                {parsedLines.map((spans, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                        {spans.map((span, j) => (
                            <span key={j} style={span.style}>{span.text}</span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LogTerminal;
