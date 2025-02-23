import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { IconFileFilled } from "@tabler/icons-react";
import ConnectionStatus from "./components/ConnectionStatus";
import LiveGraph from "./components/LiveGraph";
import gameField from "./assets/game_field.png";

function App() {
  const { isConnected, graphData, imageData, stringData } = useWebSocket();
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
      <div className="h-screen w-full">
        {/* Nav bar */}
        <div className="mb-2 flex justify-between border-b p-2">
          <div className="flex items-center gap-1">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
          </div>
          <ConnectionStatus connectionStatus={isConnected} />
        </div>

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
              <p>{Math.round(value[value.length - 1].y * 100) / 100}</p>
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

        {/* String Data Section */}
        <div className="flex">
          <div className="flex w-1/3 flex-col justify-between">
            <div className="m-2 rounded-md border border-b-0">
              {Array.from(stringData).map(([key, value]) => (
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
            <img src={gameField} alt="" className="m-2 rounded-md border" />
          </div>
          {/* Main view camera feed */}
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
