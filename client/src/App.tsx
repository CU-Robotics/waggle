import { IconFileFilled, IconPower } from "@tabler/icons-react";
import BatteryStatus from "./components/BatteryStatus";
import SignalStatus from "./components/SignalStatus";
import Notifications from "./components/Notifications";
import gameField from "./assets/game_field.png";

// all constants up here will be api data at some point
const data = [
  { name: "speed", value: "5 m/s" },
  { name: "pitch", value: "18%" },
  { name: "yaw", value: "18%" },
  { name: "cpu usage", value: "18%" },
  { name: "mem usage", value: "25%" },
  { name: "motor 1 temp", value: "97°" },
  { name: "motor 2 temp", value: "102°" },
  { name: "motor 3 temp", value: "93°" },
  { name: "motor 4 temp", value: "99°" },
  { name: "other data", value: "other data" },
];

const signnalStrength: number = 75;
const batteryStatus: number = 92;
const notifications: number = 1;

function App() {
  return (
    <>
      <div className="m-5">
        {/* <!-- ! Nav bar --> */}
        <nav className="flex justify-between border p-2">
          <div className="flex gap-1 items-center">
            <IconFileFilled size={20} />
            <p className="underline">
              <a href="/">file editor</a>
            </p>
          </div>
          <div className="flex gap-1 items-center">
            <div className="flex gap-4">
              <SignalStatus signalStrength={signnalStrength} />
              <BatteryStatus batteryStatus={batteryStatus} />
              <Notifications notifications={notifications} />
            </div>
            <div>
              <div className="flex items-center bg-red-500 text-white p-1 rounded m-1 ml-6">
                <IconPower size={20} />
              </div>
            </div>
          </div>
        </nav>
        {/* <!-- ! sensor readings --> */}
        <div className="flex justify-between border">
          {data.map((item) => (
            <div
              className="border flex flex-col items-center p-2"
              onClick={() => console.log(item.name)}
            >
              <p>{item.name}</p>
              <p className="text-xl">{item.value}</p>
            </div>
          ))}
        </div>
        {/* <!-- ! main view camera feed --> */}
        <div className="flex border">
          <div className="border w-1/4">
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">more data</div>
            <div className="border">
              minimap
              <img src={gameField} alt="" />
            </div>
          </div>
          <div className="border w-3/4 flex justify-center items-center">
            raw cam feed w edge detection toggle
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
