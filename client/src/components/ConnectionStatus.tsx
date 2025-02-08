import { useEffect, useState } from "react";

function ConnectionStatus({ connectionStatus }: { connectionStatus: boolean }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [connectionStatus]);

  return (
    <div className="group relative flex items-center">
      <div
        className={`absolute right-full mr-2 whitespace-nowrap transition-all duration-500 ease-in-out ${isVisible ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}
      >
        <p className="text-sm">
          {connectionStatus
            ? "Connected to the server"
            : "Not connected to the server"}
        </p>
      </div>
      <span
        className={`size-3 rounded-full ${connectionStatus ? "bg-green-500" : "bg-red-500"}`}
      ></span>
    </div>
  );
}

export default ConnectionStatus;
