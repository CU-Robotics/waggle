import {
  IconAntennaBarsOff,
  IconAntennaBars1,
  IconAntennaBars2,
  IconAntennaBars3,
  IconAntennaBars4,
  IconAntennaBars5,
} from "@tabler/icons-react";

const icon_size = 20;

function SignalStatus({ signalStrength }: { signalStrength: number }) {
  // TODO add useEffect for api call to get signalStrength

  switch (true) {
    case signalStrength <= 0:
      return <IconAntennaBarsOff size={icon_size} />;
    case signalStrength <= 10:
      return <IconAntennaBars1 size={icon_size} />;
    case signalStrength <= 25:
      return <IconAntennaBars2 size={icon_size} />;
    case signalStrength <= 50:
      return <IconAntennaBars3 size={icon_size} />;
    case signalStrength <= 75:
      return <IconAntennaBars4 size={icon_size} />;
    default:
      return <IconAntennaBars5 size={icon_size} />;
  }
}

export default SignalStatus;
