import {useCallback, useEffect, useMemo, useState} from "react";
import {useWebSocket} from "./hooks/useWebSocket";
import {useReplayPlayer} from "./hooks/useReplayPlayer";
import type {WaggleData} from "./types";
import {IconBrightnessDownFilled, IconDownload, IconMoonFilled,} from "@tabler/icons-react";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import LogTerminal from "./components/LogTerminal";
import PlayBar from "./components/PlayBar";
import {GraphDataToCSV, saveFile} from "./csvHelpter";

function App() {
    const ws = useWebSocket();
    const {
        replay,
        currentFrame,
        loadFile,
        close: closeReplay,
        setFrameIndex,
        togglePlay,
        setSpeed,
        stepForward,
        stepBackward,
    } = useReplayPlayer();

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [activeGraphs, setActiveGraphs] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);

    const inReplayMode = replay !== null;

    const replayGraphData = useMemo(() => {
        if (!replay || !currentFrame) return {};
        const acc: { [key: string]: { x: number; y: number }[] } = {};
        for (let i = 0; i <= replay.frameIndex; i++) {
            const frame = replay.frames[i];
            if (!frame.graph_data) continue;
            for (const [key, points] of Object.entries(frame.graph_data)) {
                if (!acc[key]) acc[key] = [];
                for (const p of points) {
                    if (p.settings?.clear_data) {
                        acc[key] = [];
                        continue;
                    }
                    acc[key].push(p);
                }
            }
        }
        return acc;
    }, [replay, currentFrame, replay?.frameIndex]);

    const replayImages = useMemo(() => {
        if (!replay) return {};
        const acc: WaggleData["images"] = {};
        for (let i = 0; i <= replay.frameIndex; i++) {
            const frame = replay.frames[i];
            if (frame.images) {
                for (const [k, v] of Object.entries(frame.images)) {
                    acc[k] = v;
                }
            }
        }
        return acc;
    }, [replay, replay?.frameIndex]);

    const replaySvg = useMemo(() => {
        if (!replay) return {};
        const acc: WaggleData["svg_data"] = {};
        for (let i = 0; i <= replay.frameIndex; i++) {
            const frame = replay.frames[i];
            if (frame.svg_data) {
                for (const [k, v] of Object.entries(frame.svg_data)) {
                    acc[k] = v;
                }
            }
        }
        return acc;
    }, [replay, replay?.frameIndex]);

    const replayStrings = useMemo(() => {
        if (!replay) return {};
        const acc: WaggleData["string_data"] = {};
        for (let i = 0; i <= replay.frameIndex; i++) {
            const frame = replay.frames[i];
            if (frame.string_data) {
                for (const [k, v] of Object.entries(frame.string_data)) {
                    acc[k] = v;
                }
            }
        }
        return acc;
    }, [replay, replay?.frameIndex]);

    const replayLogs = useMemo(() => {
        if (!replay) return {};
        const acc: { [key: string]: string[] } = {};
        for (let i = 0; i <= replay.frameIndex; i++) {
            const frame = replay.frames[i];
            if (frame.log_data) {
                for (const [k, v] of Object.entries(frame.log_data)) {
                    if (!acc[k]) acc[k] = [];
                    acc[k] = acc[k].concat(v.lines);
                }
            }
        }
        return acc;
    }, [replay, replay?.frameIndex]);

    const graphData = inReplayMode ? replayGraphData : ws.graphData;
    const imageData = inReplayMode ? replayImages : ws.imageData;
    const svgData = inReplayMode ? replaySvg : ws.svgData;
    const stringData = inReplayMode ? replayStrings : ws.stringData;
    const logData = inReplayMode ? replayLogs : ws.logData;
    const isConnected = inReplayMode ? false : ws.isConnected;
    const maxDataPoints = ws.maxDataPoints;
    const setMaxDataPoints = ws.setMaxDataPoints;
    const maxLogLines = ws.maxLogLines;
    const setMaxLogLines = ws.setMaxLogLines;

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith(".waggle")) {
                loadFile(file);
            }
        },
        [loadFile],
    );

    const handleDownloadData = () => {
        console.log(Date.now());
        const csvData = GraphDataToCSV(graphData);
        saveFile("data.csv", csvData);
    };

    const toggleGraph = (key: string) => {
        setActiveGraphs((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const removeGraph = (key: string) => {
        setActiveGraphs((prev) => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
        });
    };

    const handleToggle = () => {
        setIsDarkMode((prevMode) => !prevMode);

        document.documentElement.classList.toggle("dark");

        if (document.documentElement.classList.contains("dark")) {
            localStorage.theme = "dark";
        } else {
            localStorage.theme = "light";
        }
    };

    useEffect(() => {
        const initialTheme =
            localStorage.theme === "dark" ||
            (!("theme" in localStorage) &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);

        setIsDarkMode(initialTheme);
        if (initialTheme) {
            document.documentElement.classList.add("dark");
        }
    }, []);

    return (
        <>
            <div
                className="min-h-screen w-full dark:bg-neutral-800 dark:text-white"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag overlay */}
                {isDragging && (
                    <div
                        className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-blue-500/20 backdrop-blur-sm">
                        <div
                            className="rounded-2xl border-4 border-dashed border-blue-500 bg-white/80 px-12 py-8 text-xl font-bold text-blue-700 dark:bg-neutral-800/80 dark:text-blue-300">
                            Drop .waggle replay file
                        </div>
                    </div>
                )}

                {/* Replay play bar */}
                {replay && (
                    <PlayBar
                        replay={replay}
                        onTogglePlay={togglePlay}
                        onSeek={setFrameIndex}
                        onStepForward={stepForward}
                        onStepBackward={stepBackward}
                        onSetSpeed={setSpeed}
                        onClose={closeReplay}
                    />
                )}

                <div className="mb-2 flex justify-between border-b p-2">
                    <div className="flex items-center w-full gap-4">
                        <div className="flex-grow"></div>
                        {!inReplayMode && (
                            <ConnectionStatus connectionStatus={isConnected}/>
                        )}
                        {inReplayMode && (
                            <span
                                className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900 dark:text-orange-200">
                REPLAY
              </span>
                        )}
                        <button onClick={handleToggle}>
                            {isDarkMode ? (
                                <IconMoonFilled size={20}/>
                            ) : (
                                <IconBrightnessDownFilled size={20}/>
                            )}
                        </button>
                    </div>
                </div>

                <div className="m-2 rounded-lg border bg-white p-4 dark:bg-neutral-700">
                    <div className="mb-4">
                        <h2 className="mb-4 text-lg font-semibold">Settings</h2>
                        <label htmlFor="maxDataPoints" className="mb-2 block">
                            Max Data Points per Graph:
                        </label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                min="1"
                                value={maxDataPoints}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setMaxDataPoints(value);
                                }}
                                className="w-36 rounded border px-2 py-1 dark:bg-neutral-800"
                            />
                        </div>
                        <label htmlFor="maxLogLines" className="mb-2 mt-4 block">
                            Max Log Lines per Terminal:
                        </label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                min="1"
                                value={maxLogLines}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    setMaxLogLines(value);
                                }}
                                className="w-36 rounded border px-2 py-1 dark:bg-neutral-800"
                            />
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={handleDownloadData}
                                className="flex items-center gap-2 rounded-md border bg-slate-300 px-3 py-2 text-black hover:bg-slate-600 dark:bg-slate-700 dark:text-white"
                            >
                                <IconDownload size={18}/>
                                Download All Data
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sensor readings */}
                <div className="m-2 flex flex-wrap gap-2">
                    {Object.entries(graphData).map(([key, value]) => (
                        <div
                            key={key}
                            className={`flex cursor-pointer flex-col items-center rounded-md border p-2 transition-colors ${
                                activeGraphs.has(key)
                                    ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-800"
                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            }`}
                            onClick={() => toggleGraph(key)}
                        >
                            <p>{key}</p>
                            <p>{Math.round(value[value.length - 1].y * 100) / 100}</p>
                        </div>
                    ))}
                </div>

                {/* Live Graphs Section */}
                {activeGraphs.size > 0 && (
                    <div className="m-2 rounded-lg border p-4">
                        <h2 className="mb-4 text-lg font-semibold">Live Graphs</h2>
                        <div className="flex flex-wrap gap-4">
                            {Array.from(activeGraphs).map((key) => (
                                <LiveGraph
                                    key={key}
                                    title={key}
                                    data={graphData[key] || []}
                                    onRemove={() => removeGraph(key)}
                                    isDarkMode={isDarkMode}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Log Data Section */}
                {Object.keys(logData).length > 0 && (
                    <div className="m-2 rounded-lg border p-4">
                        <h2 className="mb-4 text-lg font-semibold">Logs</h2>
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(logData).map(([key, lines]) => (
                                <LogTerminal
                                    key={key}
                                    title={key}
                                    lines={lines}
                                    isDarkMode={isDarkMode}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* String Data Section */}
                <div className="flex">
                    <div className="flex w-1/3 flex-col justify-between">
                        <div className="m-2 rounded-md border border-b-0">
                            {Object.entries(stringData).map(([key, value]) => (
                                <div
                                    className="flex items-center justify-between border-b p-2"
                                    key={key}
                                >
                                    <p>
                                        {key}: {value.value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {/* <img src={gameField} alt="" className="m-2 rounded-md border" /> */}
                    </div>
                    {/* Main view camera feed */}
                    <div className="m-2 flex w-3/4 flex-col rounded-md border">
                        <div className="flex items-center justify-center">
                            <div className="m-2 flex flex-wrap">
                                {Object.entries(imageData).map(([key, value]) => {
                                    return (
                                        <div className="m-2 flex flex-col items-center" key={key}>
                                            <p>{key}</p>
                                            <img
                                                src={value.blob_url}
                                                className="rounded-md border"
                                                alt="no source"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="m-2 flex w-3/4 flex-col rounded-md border">
                        <div className="flex items-center justify-center">
                            <div className="m-2 flex flex-wrap">
                                {Object.entries(svgData).map(([key, value]) => {
                                    return (
                                        <div className="m-2 flex flex-col items-center" key={key}>
                                            <p>{key}</p>
                                            <div
                                                dangerouslySetInnerHTML={{__html: value.svg_string}}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default App;
