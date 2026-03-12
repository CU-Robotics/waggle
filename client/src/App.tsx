import {useEffect, useState} from "react";
import {useWebSocket} from "./hooks/useWebSocket";
import {
  IconActivity,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconLayoutDashboard,
  IconMoonFilled,
  IconPhoto,
  IconSettings,
  IconSun,
  IconTerminal2,
  IconVectorSpline,
} from "@tabler/icons-react";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import LogTerminal from "./components/LogTerminal";
import MetricCard from "./components/MetricCard";
import {GraphDataToCSV, saveFile} from "./csvHelpter";

function App() {
    const {
        isConnected,
        graphData,
        imageData,
        svgData,
        stringData,
        logData,
        maxDataPoints,
        setMaxDataPoints,
        maxLogLines,
        setMaxLogLines,
    } = useWebSocket();

    const [isDarkMode, setIsDarkMode] = useState(true);
    const [activeGraphs, setActiveGraphs] = useState<Set<string>>(new Set());
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleDownloadData = () => {
        const csvData = GraphDataToCSV(graphData);
        saveFile("data.csv", csvData);
    };

    const toggleGraph = (key: string) => {
        setActiveGraphs((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const removeGraph = (key: string) => {
        setActiveGraphs((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    };

    const handleToggle = () => {
        setIsDarkMode((prev) => !prev);
        document.documentElement.classList.toggle("dark");
        document.documentElement.classList.toggle("light");
        localStorage.theme = document.documentElement.classList.contains("dark")
            ? "dark"
            : "light";
    };

    useEffect(() => {
        const prefersDark =
            localStorage.theme === "dark" ||
            (!("theme" in localStorage) &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        setIsDarkMode(prefersDark);
        if (prefersDark) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
        } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
        }
    }, []);

    const hasGraphs = Object.keys(graphData).length > 0;
    const hasLogs = Object.keys(logData).length > 0;
    const hasImages = Object.keys(imageData).length > 0;
    const hasSvg = Object.keys(svgData).length > 0;
    const hasStrings = Object.keys(stringData).length > 0;

    return (
        <div className="min-h-screen flex flex-col bg-[var(--color-surface-0)]">
            {/* ─── Header ─── */}
            <header
                className="sticky top-0 z-50 border-b border-[var(--color-border)] backdrop-blur-xl bg-[var(--color-glass)]">
                <div className="flex items-center justify-between px-5 py-3">
                    {/* Left: Brand */}
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold tracking-tight">
                            Waggle
                        </h1>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-4">
                        <ConnectionStatus connectionStatus={isConnected}/>

                        <div className="h-4 w-px bg-[var(--color-border-bright)]"/>

                        <button
                            onClick={() => setSettingsOpen((p) => !p)}
                            className="rounded-lg p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                            aria-label="Settings"
                        >
                            <IconSettings size={18}/>
                        </button>

                        <button
                            onClick={handleDownloadData}
                            className="rounded-lg p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                            aria-label="Download CSV"
                        >
                            <IconDownload size={18}/>
                        </button>

                        <button
                            onClick={handleToggle}
                            className="rounded-lg p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                            aria-label="Toggle theme"
                        >
                            {isDarkMode ? <IconMoonFilled size={18}/> : <IconSun size={18}/>}
                        </button>
                    </div>
                </div>

                {/* Settings drawer */}
                {settingsOpen && (
                    <div
                        className="border-t border-[var(--color-border)] px-5 py-3 flex flex-wrap gap-6 items-center text-sm bg-[var(--color-surface-1)]">
                        <div className="flex items-center gap-2">
                            <label className="text-[var(--color-text-secondary)] text-xs font-medium">
                                Max graph points
                            </label>
                            <input
                                type="number"
                                min="100"
                                step="500"
                                value={maxDataPoints}
                                onChange={(e) => setMaxDataPoints(parseInt(e.target.value) || 5000)}
                                className="w-24 rounded-md border border-[var(--color-border-bright)] px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[var(--color-text-secondary)] text-xs font-medium">
                                Max log lines
                            </label>
                            <input
                                type="number"
                                min="100"
                                step="500"
                                value={maxLogLines}
                                onChange={(e) => setMaxLogLines(parseInt(e.target.value) || 1000)}
                                className="w-24 rounded-md border border-[var(--color-border-bright)] px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                            />
                        </div>
                    </div>
                )}
            </header>

            {/* ─── Main Content ─── */}
            <main className="flex-1 p-4 space-y-5 max-w-[1920px] mx-auto w-full">

                {/* ─── Metric Cards ─── */}
                {hasGraphs && (
                    <Section
                        icon={<IconActivity size={16}/>}
                        title="Telemetry"
                        count={Object.keys(graphData).length}
                    >
                        <div
                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
                            {Object.entries(graphData).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                <MetricCard
                                    key={key}
                                    title={key}
                                    data={value}
                                    isActive={activeGraphs.has(key)}
                                    onClick={() => toggleGraph(key)}
                                />
                            ))}
                        </div>
                    </Section>
                )}

                {/* ─── Active Graphs ─── */}
                {activeGraphs.size > 0 && (
                    <Section
                        icon={<IconVectorSpline size={16}/>}
                        title="Live Graphs"
                        count={activeGraphs.size}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {Array.from(activeGraphs).sort((a, b) => a.localeCompare(b)).map((key) => (
                                <LiveGraph
                                    key={key}
                                    title={key}
                                    data={graphData[key] || []}
                                    onRemove={() => removeGraph(key)}
                                />
                            ))}
                        </div>
                    </Section>
                )}

                {/* ─── String Data + Images + SVG row ─── */}
                {(hasStrings || hasImages || hasSvg) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* String Data */}
                        {hasStrings && (
                            <div className="glass-panel overflow-hidden lg:col-span-1">
                                <div
                                    className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
                                    <IconActivity size={14} className="text-[var(--color-accent-bright)]"/>
                                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Status
                  </span>
                                </div>
                                <div className="divide-y divide-[var(--color-border)]">
                                    {Object.entries(stringData).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors"
                                        >
                      <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                        {key}
                      </span>
                                            <span
                                                className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">
                        {value.value}
                      </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Images */}
                        {hasImages && (
                            <div
                                className={`glass-panel overflow-hidden ${hasStrings ? "lg:col-span-2" : "lg:col-span-3"}`}>
                                <div
                                    className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
                                    <IconPhoto size={14} className="text-[var(--color-accent-bright)]"/>
                                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Camera Feeds
                  </span>
                                </div>
                                <div className="p-3 flex flex-wrap gap-3">
                                    {Object.entries(imageData).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                        <div key={key} className="flex flex-col items-center gap-1.5">
                                            <img
                                                src={value.blobUrl}
                                                className={`rounded-lg border border-[var(--color-border)] max-h-[300px] ${value.flip ? "-scale-x-100" : ""} ${value.scale > 2 ? "[image-rendering:pixelated]" : ""}`}
                                                alt={key}
                                            />
                                            <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
                        {key}
                      </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SVG Data */}
                {hasSvg && (
                    <Section
                        icon={<IconVectorSpline size={16}/>}
                        title="Visualizations"
                        count={Object.keys(svgData).length}
                    >
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(svgData).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                <div key={key}
                                     className="glass-panel overflow-hidden p-4 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {key}
                  </span>
                                    <div dangerouslySetInnerHTML={{__html: value.svg_string}}/>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ─── Logs ─── */}
                {hasLogs && (
                    <Section
                        icon={<IconTerminal2 size={16}/>}
                        title="Logs"
                        count={Object.keys(logData).length}
                    >
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {Object.entries(logData).sort(([a], [b]) => a.localeCompare(b)).map(([key, lines]) => (
                                <LogTerminal key={key} title={key} lines={lines}/>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Empty state */}
                {!hasGraphs && !hasLogs && !hasImages && !hasSvg && !hasStrings && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div
                            className="size-16 rounded-2xl bg-[var(--color-surface-3)] flex items-center justify-center mb-4">
                            <IconLayoutDashboard size={32} className="text-[var(--color-text-muted)]"/>
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-1">
                            {isConnected ? "Waiting for data..." : "No connection"}
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)] max-w-md">
                            {isConnected
                                ? "The WebSocket is connected. Data will appear here as it arrives."
                                : "Attempting to connect to the WebSocket server. Make sure the backend is running."}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

/* ─── Section wrapper ─── */
function Section({
                     icon,
                     title,
                     count,
                     children,
                 }: {
    icon: React.ReactNode;
    title: string;
    count: number;
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <section>
            <button
                onClick={() => setCollapsed((p) => !p)}
                className="flex items-center gap-2 mb-3 group cursor-pointer"
            >
                <span className="text-[var(--color-accent-bright)]">{icon}</span>
                <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {title}
                </h2>
                <span
                    className="text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
                <span
                    className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
          {collapsed ? <IconChevronDown size={14}/> : <IconChevronUp size={14}/>}
        </span>
            </button>
            {!collapsed && children}
        </section>
    );
}

export default App;
