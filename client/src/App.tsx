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
import {buildAviDib} from "./aviWriter";

type ImageViewSelection = {
    base?: boolean;
    overlays?: { [key: string]: boolean };
};

type VideoExportProgress = {
    label: string;
    stage: "rendering" | "encoding" | "downloading";
    currentFrame: number;
    totalFrames: number;
    progress: number;
};

function getImageOverlayEntries(value: WaggleData["images"][string]) {
    if (value.svg_overlays) {
        const entries = Object.entries(value.svg_overlays).sort(([a], [b]) =>
            a.localeCompare(b),
        );
        if (entries.length > 0) return entries;
    }

    if (!value.svg_overlay) {
        return [];
    }

    try {
        const parsed = JSON.parse(value.svg_overlay) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return Object.entries(parsed)
                .filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string",
                )
                .sort(([a], [b]) => a.localeCompare(b));
        }
    } catch {
        // Plain SVG overlays are kept as a single default overlay.
    }

    return [["overlay", value.svg_overlay]];
}

function saveBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = filename;
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    // Chrome can cancel large blob downloads if the object URL is revoked
    // before the browser has handed the blob off to the download manager.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function sanitizeFilenamePart(value: string) {
    return value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(blob);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to decode image frame."));
        };
        image.src = url;
    });
}

function normalizeSvgForImage(svg: string) {
    if (!svg.trimStart().startsWith("<svg") || svg.includes("xmlns=")) {
        return svg;
    }

    return svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

async function renderImageFrame(
    imageData: WaggleData["images"][string],
    overlaySvg?: string,
) {
    const baseImage = await loadImage(
        new Blob([imageData.image_data], {type: "image/jpeg"}),
    );
    const width = baseImage.naturalWidth || baseImage.width;
    const height = baseImage.naturalHeight || baseImage.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Could not create video export canvas.");
    }

    context.drawImage(baseImage, 0, 0, width, height);

    if (overlaySvg) {
        const overlayImage = await loadImage(
            new Blob([normalizeSvgForImage(overlaySvg)], {type: "image/svg+xml"}),
        );
        context.drawImage(overlayImage, 0, 0, width, height);
    }

    return {
        width,
        height,
        data: context.getImageData(0, 0, width, height).data,
    };
}

function getReplayVideoFps(frames: WaggleData[]) {
    if (frames.length < 2) return 1;

    const start = frames[0].sent_timestamp;
    const end = frames[frames.length - 1].sent_timestamp;
    const msPerUnit = start > 1e11 ? 1 : 1000;
    const durationSeconds = (Math.abs(end - start) * msPerUnit) / 1000;
    if (durationSeconds <= 0) return 30;

    return Math.max(
        1,
        Math.min(120, Math.round((frames.length - 1) / durationSeconds)),
    );
}

function App() {
    const ws = useWebSocket();
    const {
        replay,
        loadingReplay,
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
    const [imageViewSelections, setImageViewSelections] = useState<{
        [key: string]: ImageViewSelection;
    }>({});
    const [exportingVideo, setExportingVideo] = useState<string | null>(null);
    const [videoExportProgress, setVideoExportProgress] =
        useState<VideoExportProgress | null>(null);

    const inReplayMode = replay !== null;

    // Incremental accumulators — only process new frames since last render,
    // recompute from scratch only when scrubbing backwards.
    const lastIdx = useRef(-1);
    const accGraphs = useRef<{ [key: string]: { x: number; y: number }[] }>({});
    const accImages = useRef<WaggleData["images"]>({});
    const accSvg = useRef<WaggleData["svg_data"]>({});
    const accStrings = useRef<WaggleData["string_data"]>({});
    const accLogs = useRef<{ [key: string]: string[] }>({});

    const replayFrameIndex = replay?.frameIndex ?? -1;
    const replayFrames = replay?.frames;

    useMemo(() => {
        if (!replayFrames) {
            lastIdx.current = -1;
            accGraphs.current = {};
            accImages.current = {};
            accSvg.current = {};
            accStrings.current = {};
            accLogs.current = {};
            return;
        }

        const target = replayFrameIndex;

        // Scrubbed backwards — reset and recompute from 0
        if (target < lastIdx.current) {
            accGraphs.current = {};
            accImages.current = {};
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
                        if (p.settings?.clear_data) {
                            accGraphs.current[key] = [];
                            continue;
                        }
                        accGraphs.current[key].push(p);
                    }
                }
            }
            if (frame.images) {
                const images = Object.entries(frame.images);
                images.sort((a, b) => a[0].localeCompare(b[0]));
                for (const [k, v] of images) {
                    accImages.current[k] = v;
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

    const replayGraphData = accGraphs.current;
    const replayImages = accImages.current;
    const replaySvg = accSvg.current;
    const replayStrings = accStrings.current;
    const replayLogs = accLogs.current;

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
    const replayLoadPercent = loadingReplay
        ? Math.round(loadingReplay.progress * 100)
        : 0;

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

    const setImageBaseView = (imageKey: string, checked: boolean) => {
        setImageViewSelections((prev) => ({
            ...prev,
            [imageKey]: {
                ...prev[imageKey],
                base: checked,
            },
        }));
    };

    const setImageOverlayView = (
        imageKey: string,
        overlayKey: string,
        checked: boolean,
    ) => {
        setImageViewSelections((prev) => ({
            ...prev,
            [imageKey]: {
                ...prev[imageKey],
                overlays: {
                    ...prev[imageKey]?.overlays,
                    [overlayKey]: checked,
                },
            },
        }));
    };

    const exportReplayImageVideo = async (
        imageKey: string,
        overlayKey?: string,
    ) => {
        if (!replay || exportingVideo) return;

        const exportKey = overlayKey
            ? `${imageKey}-${overlayKey}`
            : `${imageKey}-base`;
        const exportLabel = overlayKey
            ? `${imageKey}: base image + ${overlayKey}`
            : `${imageKey}: base image`;
        setExportingVideo(exportKey);
        try {
            const renderedFrames: Uint8ClampedArray[] = [];
            let width = 0;
            let height = 0;
            const sourceFrames = replay.frames.filter(
                (frame) => frame.images?.[imageKey],
            );
            setVideoExportProgress({
                label: exportLabel,
                stage: "rendering",
                currentFrame: 0,
                totalFrames: sourceFrames.length,
                progress: 0,
            });

            for (let i = 0; i < sourceFrames.length; i++) {
                const image = sourceFrames[i].images[imageKey];
                const overlaySvg = overlayKey
                    ? getImageOverlayEntries(image).find(
                        ([key]) => key === overlayKey,
                    )?.[1]
                    : undefined;
                const rendered = await renderImageFrame(image, overlaySvg);

                if (i === 0) {
                    width = rendered.width;
                    height = rendered.height;
                }
                if (rendered.width === width && rendered.height === height) {
                    renderedFrames.push(rendered.data);
                }

                if (i % 10 === 0 || i === sourceFrames.length - 1) {
                    setVideoExportProgress({
                        label: exportLabel,
                        stage: "rendering",
                        currentFrame: i + 1,
                        totalFrames: sourceFrames.length,
                        progress:
                            sourceFrames.length === 0 ? 0 : (i + 1) / sourceFrames.length,
                    });
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                }
            }

            if (renderedFrames.length === 0) return;

            setVideoExportProgress({
                label: exportLabel,
                stage: "encoding",
                currentFrame: renderedFrames.length,
                totalFrames: renderedFrames.length,
                progress: 1,
            });
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const fps = getReplayVideoFps(sourceFrames);
            const video = buildAviDib(width, height, fps, renderedFrames);
            const nameParts = [
                sanitizeFilenamePart(replay.fileName.replace(/\.waggle$/i, "")),
                sanitizeFilenamePart(imageKey),
                overlayKey ? `overlay_${sanitizeFilenamePart(overlayKey)}` : "base",
            ].filter(Boolean);
            setVideoExportProgress({
                label: exportLabel,
                stage: "downloading",
                currentFrame: renderedFrames.length,
                totalFrames: renderedFrames.length,
                progress: 1,
            });
            await new Promise((resolve) => requestAnimationFrame(resolve));
            saveBlob(`${nameParts.join("_")}.avi`, video);
        } catch (error) {
            console.error("Failed to export replay image video", error);
            alert("Failed to export image sequence video.");
        } finally {
            setExportingVideo(null);
            setVideoExportProgress(null);
        }
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

                {loadingReplay && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                        <div
                            className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg dark:border-neutral-600 dark:bg-neutral-900">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                        {loadingReplay.stage === "reading"
                                            ? "Reading replay file"
                                            : "Parsing replay frames"}
                                    </p>
                                    <p className="truncate text-xs opacity-70">
                                        {loadingReplay.fileName}
                                    </p>
                                </div>
                                <span className="font-mono text-sm font-semibold">
                  {replayLoadPercent}%
                </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                <div
                                    className="h-full rounded-full bg-blue-500 transition-all duration-150 ease-out"
                                    style={{width: `${replayLoadPercent}%`}}
                                />
                            </div>
                            {loadingReplay.stage === "parsing" && (
                                <p className="mt-3 text-xs opacity-70">
                                    {loadingReplay.framesLoaded.toLocaleString()} frames loaded
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {videoExportProgress && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                        <div
                            className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg dark:border-neutral-600 dark:bg-neutral-900">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                        {videoExportProgress.stage === "rendering"
                                            ? "Rendering video frames"
                                            : videoExportProgress.stage === "encoding"
                                                ? "Encoding AVI"
                                                : "Starting download"}
                                    </p>
                                    <p className="truncate text-xs opacity-70">
                                        {videoExportProgress.label}
                                    </p>
                                </div>
                                <span className="font-mono text-sm font-semibold">
                  {Math.round(videoExportProgress.progress * 100)}%
                </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                <div
                                    className="h-full rounded-full bg-blue-500 transition-all duration-150 ease-out"
                                    style={{
                                        width: `${Math.round(videoExportProgress.progress * 100)}%`,
                                    }}
                                />
                            </div>
                            <p className="mt-3 text-xs opacity-70">
                                {videoExportProgress.currentFrame.toLocaleString()} /{" "}
                                {videoExportProgress.totalFrames.toLocaleString()} frames
                            </p>
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
                    <div className="flex w-full items-center gap-4">
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
                        <label htmlFor="maxLogLines" className="mt-4 mb-2 block">
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
                                    const overlayEntries = getImageOverlayEntries(value);
                                    const viewSelection = imageViewSelections[key];
                                    const showBase = viewSelection?.base ?? true;
                                    const visibleOverlays = overlayEntries.filter(
                                        ([overlayKey]) =>
                                            viewSelection?.overlays?.[overlayKey] ?? true,
                                    );
                                    return (
                                        <div
                                            className="m-2 flex w-full flex-col items-center"
                                            key={key}
                                        >
                                            <div className="mb-2 flex flex-wrap items-center justify-center gap-3">
                                                <p>{key}</p>
                                                <label
                                                    className="flex items-center gap-1 rounded border px-2 py-1 text-xs dark:border-neutral-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={showBase}
                                                        onChange={(e) =>
                                                            setImageBaseView(key, e.target.checked)
                                                        }
                                                    />
                                                    Base image
                                                </label>
                                                {overlayEntries.map(([overlayKey]) => (
                                                    <label
                                                        className="flex items-center gap-1 rounded border px-2 py-1 text-xs dark:border-neutral-600"
                                                        key={`toggle-${overlayKey}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                viewSelection?.overlays?.[overlayKey] ?? true
                                                            }
                                                            onChange={(e) =>
                                                                setImageOverlayView(
                                                                    key,
                                                                    overlayKey,
                                                                    e.target.checked,
                                                                )
                                                            }
                                                        />
                                                        {overlayKey}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex w-full flex-wrap justify-center gap-2">
                                                {showBase && (
                                                    <div className="max-w-full min-w-64 flex-1">
                                                        <div
                                                            className="mb-1 flex items-center justify-center gap-1 text-xs opacity-70">
                                                            <span>Base image</span>
                                                            {replay && (
                                                                <button
                                                                    className="rounded p-0.5 opacity-80 hover:bg-neutral-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-700"
                                                                    disabled={exportingVideo !== null}
                                                                    onClick={() => exportReplayImageVideo(key)}
                                                                    title={
                                                                        exportingVideo === `${key}-base`
                                                                            ? "Exporting base AVI"
                                                                            : "Download base AVI"
                                                                    }
                                                                >
                                                                    <IconDownload size={14}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <img
                                                            src={value.blob_url}
                                                            className="block h-auto w-full rounded-md border"
                                                            alt="no source"
                                                        />
                                                    </div>
                                                )}
                                                {visibleOverlays.map(([overlayKey, overlaySvg]) => (
                                                    <div
                                                        className="max-w-full min-w-64 flex-1"
                                                        key={overlayKey}
                                                    >
                                                        <div
                                                            className="mb-1 flex items-center justify-center gap-1 text-xs opacity-70">
                                                            <span>Base image + {overlayKey}</span>
                                                            {replay && (
                                                                <button
                                                                    className="rounded p-0.5 opacity-80 hover:bg-neutral-200 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-700"
                                                                    disabled={exportingVideo !== null}
                                                                    onClick={() =>
                                                                        exportReplayImageVideo(key, overlayKey)
                                                                    }
                                                                    title={
                                                                        exportingVideo === `${key}-${overlayKey}`
                                                                            ? `Exporting ${overlayKey} AVI`
                                                                            : `Download ${overlayKey} AVI`
                                                                    }
                                                                >
                                                                    <IconDownload size={14}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="relative">
                                                            <img
                                                                src={value.blob_url}
                                                                className="block h-auto w-full rounded-md border"
                                                                alt="no source"
                                                            />
                                                            <div
                                                                className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: overlaySvg,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
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
