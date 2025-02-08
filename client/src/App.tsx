import { IconFileFilled, IconPower } from "@tabler/icons-react";
import BatteryStatus from "./components/BatteryStatus";
import SignalStatus from "./components/SignalStatus";
import Notifications from "./components/Notifications";
import Toggle from "./components/Toggle";
import gameField from "./assets/game_field.png";

// all constants up here will be api data at some point
const data = [
  { name: "speed", value: "5 m/s", key: 1 },
  { name: "pitch", value: "18%", key: 2 },
  { name: "yaw", value: "18%", key: 3 },
  { name: "cpu usage", value: "18%", key: 4 },
  { name: "mem usage", value: "25%", key: 5 },
  { name: "motor 1 temp", value: "97°", key: 6 },
  { name: "motor 2 temp", value: "102°", key: 7 },
  { name: "motor 3 temp", value: "93°", key: 8 },
  { name: "motor 4 temp", value: "99°", key: 9 },
  { name: "other data", value: "other data", key: 10 },
];

const signnalStrength: number = 75;
const batteryStatus: number = 92;
const notifications: number = 1;

function App() {
  return (
    <>
      <div className="m-5 rounded-md border">
        {/* <!-- ! Nav bar --> */}
        <nav className="flex justify-between p-2">
          <div className="flex items-center gap-1">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex gap-4">
              <SignalStatus signalStrength={signnalStrength} />
              <BatteryStatus batteryStatus={batteryStatus} />
              <Notifications notifications={notifications} />
            </div>
            <div>
              <div className="m-1 ml-6 flex items-center rounded bg-red-500 p-1 text-white">
                <IconPower size={20} />
              </div>
            </div>
          </div>
        </nav>
        {/* <!-- ! sensor readings --> */}
        <div className="flex justify-between">
          {data.map((item) => (
            <div
              className="flex flex-col items-center rounded-md border p-2"
              onClick={() => console.log(item.name)}
              key={item.key}
            >
              <p>{item.name}</p>
              <p className="text-xl">{item.value}</p>
            </div>
          ))}
        </div>
        {/* <!-- ! main view camera feed --> */}
        <div className="flex">
          <div className="w-1/4">
            <div className="mt-2 mb-2">
              <div className="flex items-center justify-between rounded-tr-md border border-b-0 border-l-0 p-2">
                <p>Hive Mode</p>
                <Toggle size="small" />
              </div>
              <div className="flex items-center justify-between rounded-br-md border border-l-0 p-2">
                <p>Servo</p>
                <Toggle size="small" />
              </div>
            </div>
            <div className="">
              <img src={gameField} alt="" />
            </div>
          </div>
          <div className="flex w-3/4 flex-col">
            <div className="flex gap-2 p-2">
              <p>Edge detection mode</p>
              <Toggle />
            </div>
            <div className="flex h-full items-center justify-center">
              <p>raw cam feed w edge detection toggle</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
