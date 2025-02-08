import { IconFileFilled, IconPower } from "@tabler/icons-react";
import { useWebSocket } from "./hooks/useWebSocket";
import BatteryStatus from "./components/BatteryStatus";
import SignalStatus from "./components/SignalStatus";
import Notifications from "./components/Notifications";
import ConnectionStatus from "./components/ConnectionStatus";
import gameField from "./assets/game_field.png";
import Toggle from "./components/Toggle";
import RecordSession from "./components/RecordSession";

const notifications: number = 1;

function App() {
  const { isConnected, telemetryData, cameraFeeds } = useWebSocket();

  return (
    <>
      <div className="w-100% h-screen overflow-hidden">
        {/* <!-- ! Nav bar --> */}
        <nav className="mb-2 flex justify-between border-b p-2">
          <div className="flex items-center gap-1">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
            <p className="rounded-md border p-1 text-sm">
              Operating mode: {telemetryData.status.mode}
            </p>
            <p className="rounded-md border p-1 text-sm">
              Game state: {telemetryData.status.game_state}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus connectionStatus={isConnected} />
            <SignalStatus
              signalStrength={telemetryData.communications.signal_strength}
            />
            <BatteryStatus
              batteryVoltage={telemetryData.power.battery_voltage}
            />
            <Notifications notifications={notifications} />
            <div>
              <div className="m-1 ml-6 flex items-center rounded bg-red-500 p-1 text-white">
                <IconPower size={20} />
              </div>
            </div>
          </div>
        </nav>
        {/* <!-- ! sensor readings --> */}
        {/* would be cool to have views here */}
        <div className="m-2 flex justify-between">
          {Object.keys(telemetryData).map((item) => (
            <div
              className="flex w-1/10 flex-col items-center rounded-md border p-2"
              onClick={() => console.log(item)}
              key={item}
            >
              <p className="text-sm font-bold">{item}</p>
            </div>
          ))}
        </div>
        {/* <!-- ! main view camera feed --> */}
        <div className="flex">
          <div className="flex w-1/3 flex-col justify-between">
            <div className="m-2 rounded-md border">
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
            </div>
            <img src={gameField} alt="" className="m-2 rounded-md border" />
          </div>
          <div className="m-2 flex w-3/4 flex-col rounded-md border">
            <div className="flex items-center justify-between border-b p-2">
              <div className="flex gap-2 p-2">
                {/* <p>Edge detection mode</p>
                <Toggle defaultChecked /> */}
              </div>
              <RecordSession />
            </div>
            <div className="flex items-center justify-center">
              <div className="m-2 flex w-1/2 flex-col items-center">
                <p>main camera</p>
                <img
                  src={`data:image/png;base64,${cameraFeeds.main_camera}`}
                  className="w-full rounded-md border"
                  alt="no source"
                />
              </div>
              <div className="m-2 flex w-1/2 flex-col items-center">
                <p>edge detection</p>
                <img
                  src={`data:image/png;base64,${cameraFeeds.main_camera}`}
                  className="w-full rounded-md border"
                  alt="no source"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
