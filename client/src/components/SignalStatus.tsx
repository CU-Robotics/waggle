import {
  IconAntennaBarsOff,
  IconAntennaBars1,
  IconAntennaBars2,
  IconAntennaBars3,
  IconAntennaBars4,
  IconAntennaBars5,
} from "@tabler/icons-react";

const icon_size = 25;

function SignalStatus({ signalStrength }: { signalStrength: number }) {
  // signal strength is in dBm, value closer to 0 is better
  // TODO add latency and packet loss to signal status, amybe its a dropdown or something
  switch (true) {
    case signalStrength <= -90 || signalStrength === 0:
      return <IconAntennaBarsOff size={icon_size} />;
    case signalStrength <= -80:
      return <IconAntennaBars1 size={icon_size} />;
    case signalStrength <= -70:
      return <IconAntennaBars2 size={icon_size} />;
    case signalStrength <= -50:
      return <IconAntennaBars3 size={icon_size} />;
    case signalStrength <= -30:
      return <IconAntennaBars4 size={icon_size} />;
    default:
      return <IconAntennaBars5 size={icon_size} />;
  }
}

export default SignalStatus;
