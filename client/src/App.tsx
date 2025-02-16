import { useState, useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { IconMoonFilled, IconBrightnessDownFilled } from '@tabler/icons-react';
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import gameField from "./assets/game_field.png";

function App() {
  const { isConnected, graphData, imageData } = useWebSocket();
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
    setIsDarkMode(prevMode => !prevMode);

    document.documentElement.classList.toggle('dark');

    if (document.documentElement.classList.contains('dark')) {
      localStorage.theme = 'dark';
    } else {
      localStorage.theme = 'light'; // Could add ability to clear theme and default to system theme 
    }
  };

  useEffect(() => {
    const initialTheme = localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    setIsDarkMode(initialTheme);
    if (initialTheme) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <>
      <div className="h-screen w-full dark:bg-gray-900 dark:text-white">
        <nav className="mb-2 flex justify-between border-b p-2">
          <div className="flex items-center gap-1">
            {/* <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p> */}
            <p className="rounded-md border p-1 text-sm">
              {/* Operating mode: {stringData.mode} */}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus connectionStatus={isConnected} />
            <button onClick={handleToggle}>
              {isDarkMode ? <IconMoonFilled size={20} /> : <IconBrightnessDownFilled size={20} />}
            </button>
            {/* <SignalStatus
              signalStrength={telemetryData.communications.signal_strength}
            />
            <BatteryStatus
              batteryVoltage={telemetryData.power.battery_voltage}
            /> */}
            {/* <Notifications notifications={notifications} /> */}
            {/* <div>
              <div className="m-1 ml-6 flex items-center rounded bg-red-500 p-1 text-white">
                <IconPower size={20} />
              </div>
            </div> */}
          </div>
        </nav>

        {/* Sensor readings */}
        <div className="m-2 flex flex-wrap gap-4">
          {Array.from(graphData.entries()).map(([key, value]) => (
            <div
              key={key}
              className={`flex cursor-pointer flex-col items-center rounded-md border p-2 transition-colors ${activeGraphs.has(key)
                  ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-800"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              onClick={() => toggleGraph(key)}
            >
              <p>{key}</p>
              <p>{Math.round(value[value.length - 1].value * 100) / 100}</p>
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
                  data={graphData.get(key) || []}
                  onRemove={() => removeGraph(key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main view camera feed */}
        <div className="flex">
          <div className="flex w-1/3 flex-col justify-between">
            {/* <div className="m-2 rounded-md border">
              <div className="flex items-center justify-between border-b p-2">
                <p>Hive Mode</p>
                <Toggle size="small" />
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <p>Servo</p>
                <Toggle size="small" />
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <p>Emergency stop</p>
                <Toggle size="small" />
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <p>Auto aim</p>
                <Toggle size="small" defaultChecked />
              </div>
              <div className="flex items-center justify-between border-b p-2">
                <p>Example toggle</p>
                <Toggle size="small" defaultChecked />
              </div>
              <div className="flex items-center justify-between p-2">
                <p>Add more data/modes</p>
              </div>
            </div> */}
            <img src={gameField} alt="" className="m-2 rounded-md border" />
          </div>
          <div className="m-2 flex w-3/4 flex-col rounded-md border">
            <div className="flex items-center justify-center">
              <div className="m-2 flex flex-wrap">
                {Array.from(imageData.entries()).map(([key, value]) => {
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
