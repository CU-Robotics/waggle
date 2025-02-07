import {
  IconBattery,
  IconBattery1,
  IconBattery2,
  IconBattery3,
  IconBattery4,
} from "@tabler/icons-react";

const icon_size = 25;

function BatteryStatus({ batteryStatus }: { batteryStatus: number }) {
  // TODO add useEffect for api call to get battery status

  switch (true) {
    case batteryStatus <= 10:
      return (
        <>
          <div className="flex items-center gap-1">
            <IconBattery size={icon_size} color="red" />
            <p className="text-sm">{batteryStatus}%</p>
          </div>
        </>
      );
    case batteryStatus <= 25:
      return (
        <>
          <div className="flex items-center gap-1">
            <IconBattery1 size={icon_size} color="orange" />
            <p className="text-sm">{batteryStatus}%</p>
          </div>
        </>
      );
    case batteryStatus <= 50:
      return (
        <>
          <div className="flex items-center gap-1">
            <IconBattery2 size={icon_size} />
            <p className="text-sm">{batteryStatus}%</p>
          </div>
        </>
      );
    case batteryStatus <= 75:
      return (
        <>
          <div className="flex items-center gap-1">
            <IconBattery3 size={icon_size} />
            <p className="text-sm">{batteryStatus}%</p>
          </div>
        </>
      );
    default:
      return (
        <>
          <div className="flex items-center gap-1">
            <IconBattery4 size={icon_size} />
            <p className="text-sm">{batteryStatus}%</p>
          </div>
        </>
      );
  }
}

export default BatteryStatus;
