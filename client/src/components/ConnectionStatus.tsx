import { useEffect, useState } from "react";

function ConnectionStatus({
  connectionStatus,
}: {
  connectionStatus: boolean;
}) {
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    setShowLabel(true);
    const timer = setTimeout(() => setShowLabel(false), 4000);
    return () => clearTimeout(timer);
  }, [connectionStatus]);

  return (
    <div className="flex items-center gap-2.5 group">
      <div className="relative flex items-center justify-center">
        {connectionStatus && (
          <span className="absolute size-3 rounded-full bg-emerald-400/40 pulse-ring" />
        )}
        <span
          className={`relative size-2.5 rounded-full ${
            connectionStatus
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
          }`}
        />
      </div>
      <span
        className={`text-xs font-medium transition-opacity duration-500 ${
          showLabel ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } ${connectionStatus ? "text-emerald-400" : "text-red-400"}`}
      >
        {connectionStatus ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

export default ConnectionStatus;
