import { useState, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import {
  IconFileFilled,
  IconMoonFilled,
  IconBrightnessDownFilled,
} from "@tabler/icons-react";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
// import gameField from "./assets/game_field.png";

function App() {
  const {
    isConnected,
    graphData,
    imageData,
    stringData,
    maxDataPoints,
    setMaxDataPoints,
  } = useWebSocket();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeGraphs, setActiveGraphs] = useState<Set<string>>(new Set());

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
      localStorage.theme = "light"; // Could add ability to clear theme and default to system theme
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
      <div className="h-screen w-full dark:bg-neutral-800 dark:text-white">
        <div className="mb-2 flex justify-between border-b p-2">
          <div className="flex items-center gap-1">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus connectionStatus={isConnected} />
            <button onClick={handleToggle}>
              {isDarkMode ? (
                <IconMoonFilled size={20} />
              ) : (
                <IconBrightnessDownFilled size={20} />
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
                        src={`data:image/png;base64,${value.image_data}`}
                        className="rounded-md border"
                        alt="no source"
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
