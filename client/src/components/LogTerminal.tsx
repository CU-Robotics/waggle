import {useCallback, useEffect, useRef, useState} from "react";
import {LogLine} from "../types";

interface LogTerminalProps {
    title: string;
    lines: LogLine[];
    isDarkMode: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
    ERROR: "#ef4444",
    WARN: "#eab308",
    INFO: "#22d3ee",
    DEBUG: "#a3a3a3",
    TRACE: "#737373",
};

function getLineColor(line: LogLine): string | undefined {
    if (line.color) return line.color;
    for (const [level, color] of Object.entries(LEVEL_COLORS)) {
        if (line.text.startsWith(`[${level}]`)) return color;
    }
    return undefined;
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
                {lines.map((line, i) => (
                    <div
                        key={i}
                        className="whitespace-pre-wrap break-all"
                        style={getLineColor(line) ? {color: getLineColor(line)} : undefined}
                    >
                        {line.text}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LogTerminal;
