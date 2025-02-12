import { useState } from "react";
import { IconFileFilled, IconPower } from "@tabler/icons-react";
import { useWebSocket } from "./hooks/useWebSocket";
import Notifications from "./components/Notifications";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import gameField from "./assets/game_field.png";

const notifications: number = 1;

function App() {
  const { isConnected, graphData, imageData } = useWebSocket();
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

  return (
    <>
      <div className="h-screen w-full overflow-hidden">
        {/* Nav bar */}
        <nav className="mb-2 flex justify-between border-b p-2">
          <div className="flex items-center gap-1">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
            <p className="rounded-md border p-1 text-sm">
              {/* Operating mode: {stringData.mode} */}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus connectionStatus={isConnected} />
            {/* <SignalStatus
              signalStrength={telemetryData.communications.signal_strength}
            />
            <BatteryStatus
              batteryVoltage={telemetryData.power.battery_voltage}
            /> */}
            <Notifications notifications={notifications} />
            <div>
              <div className="m-1 ml-6 flex items-center rounded bg-red-500 p-1 text-white">
                <IconPower size={20} />
              </div>
            </div>
          </div>
        </nav>

        {/* Sensor readings */}
        <div className="m-2 flex justify-between">
          {Array.from(graphData.entries()).map(([key, value]) => (
            <div
              key={key}
              className={`flex cursor-pointer flex-col items-center rounded-md border p-2 transition-colors ${
                activeGraphs.has(key)
                  ? "border-blue-200 bg-blue-50"
                  : "hover:bg-gray-50"
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
          <div className="m-2 rounded-lg border bg-gray-50 p-4">
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
