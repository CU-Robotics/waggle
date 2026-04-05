import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useWebSocket} from "./hooks/useWebSocket";
import {useReplayPlayer} from "./hooks/useReplayPlayer";
import type {WaggleData} from "./types";
import {IconBrightnessDownFilled, IconDownload, IconMoonFilled,} from "@tabler/icons-react";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import LogTerminal from "./components/LogTerminal";
import PlayBar from "./components/PlayBar";
import {GraphDataToCSV, saveFile} from "./csvHelpter";
import {createBlobUrl} from "./parseBinary";

function App() {
    const ws = useWebSocket();
    const {
        replay,
        loadFile,
        close: closeReplay,
        setFrameIndex,
        togglePlay,
        setSpeed,
        stepForward,
        stepBackward,
        getImagesForFrame,
    } = useReplayPlayer();

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [activeGraphs, setActiveGraphs] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [replayImageData, setReplayImageData] = useState<WaggleData["images"]>({});
    /** Tracks first-appearance order of image keys during replay */
    const imageKeyOrder = useRef<string[]>([]);

    const inReplayMode = replay !== null;

    // Incremental accumulators — only process new frames since last render,
    // recompute from scratch only when scrubbing backwards.
    const lastIdx = useRef(-1);
    const accGraphs = useRef<{ [key: string]: { x: number; y: number }[] }>({});
    const accSvg = useRef<WaggleData["svg_data"]>({});
    const accStrings = useRef<WaggleData["string_data"]>({});
    const accLogs = useRef<{ [key: string]: string[] }>({});

    const replayFrameIndex = replay?.frameIndex ?? -1;
    const replayFrames = replay?.frames;

    useMemo(() => {
        if (!replayFrames) {
            lastIdx.current = -1;
            accGraphs.current = {};
            accSvg.current = {};
            accStrings.current = {};
            accLogs.current = {};
            return;
        }

        const target = replayFrameIndex;

        // Scrubbed backwards — reset and recompute from 0
        if (target < lastIdx.current) {
            accGraphs.current = {};
            accSvg.current = {};
            accStrings.current = {};
            accLogs.current = {};
            lastIdx.current = -1;
        }

        const start = lastIdx.current + 1;
        for (let i = start; i <= target; i++) {
            const frame = replayFrames[i];

            if (frame.graph_data) {
                for (const [key, points] of Object.entries(frame.graph_data)) {
                    if (!accGraphs.current[key]) accGraphs.current[key] = [];
                    for (const p of points) {
                        if ((p as any).settings?.clear_data) {
                            accGraphs.current[key] = [];
                            continue;
                        }
                        accGraphs.current[key].push(p);
                    }
                }
            }

            if (frame.svg_data) {
                for (const [k, v] of Object.entries(frame.svg_data)) {
                    accSvg.current[k] = v;
                }
            }

            if (frame.string_data) {
                for (const [k, v] of Object.entries(frame.string_data)) {
                    accStrings.current[k] = v;
                }
            }

            if (frame.log_data) {
                for (const [k, v] of Object.entries(frame.log_data)) {
                    if (!accLogs.current[k]) accLogs.current[k] = [];
                    accLogs.current[k] = accLogs.current[k].concat(v.lines);
                }
            }
        }

        lastIdx.current = target;
    }, [replayFrames, replayFrameIndex]);

    // Lazy-load images from file for the current replay frame
    useEffect(() => {
        if (!replay) {
            setReplayImageData((prev) => {
                for (const img of Object.values(prev)) {
                    if (img.blob_url) URL.revokeObjectURL(img.blob_url);
                }
                return {};
            });
            imageKeyOrder.current = [];
            return;
        }
        let cancelled = false;
        getImagesForFrame(replay.frameIndex).then((images) => {
            if (cancelled) return;
            setReplayImageData((prev) => {
                // Merge: keep previous images, update with new ones
                const result: WaggleData["images"] = {...prev};
                for (const [k, v] of Object.entries(images)) {
                    // Revoke old blob URL for this key
                    if (result[k]?.blob_url) {
                        URL.revokeObjectURL(result[k].blob_url!);
                    }
                    v.blob_url = createBlobUrl(v);
                    result[k] = v;
                    // Track insertion order
                    if (!imageKeyOrder.current.includes(k)) {
                        imageKeyOrder.current.push(k);
                    }
                }
                return result;
            });
        });
        return () => { cancelled = true; };
    }, [replay?.frameIndex, replay === null, getImagesForFrame]);

    const replayGraphData = accGraphs.current;
    const replaySvg = accSvg.current;
    const replayStrings = accStrings.current;
    const replayLogs = accLogs.current;

    const graphData = inReplayMode ? replayGraphData : ws.graphData;
    const imageData = inReplayMode ? replayImageData : ws.imageData;
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
            if (!file) {
                console.warn("[replay] drop event had no files");
                return;
            }
            console.log(`[replay] dropped file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB, type: "${file.type}")`);
            if (!file.name.endsWith(".waggle")) {
                console.warn(`[replay] rejected file: expected .waggle extension`);
                return;
            }
            loadFile(file);
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
                                {(inReplayMode
                                    ? imageKeyOrder.current.filter(k => imageData[k]).map(k => [k, imageData[k]] as const)
                                    : Object.entries(imageData)
                                ).map(([key, value]) => {
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
