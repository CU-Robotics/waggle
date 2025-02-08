/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useEffect } from "react";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [telemetryData, setTelemetryData] = useState({
    status: {
      mode: "UNKNOWN",
      game_state: "UNKNOWN",
      system_health: "UNKNOWN",
      score: 0,
    },
    position: {
      x: 0,
      y: 0,
      orientation: 0,
    },
    power: {
      battery_voltage: 0,
      battery_current: 0,
      cpu_temp: 0,
    },
    motors: {
      temperatures: {},
      currents: {},
    },
    weapons: {
      ammo_count: 0,
      shots_fired: 0,
      barrel_temp: 0,
    },
    communications: {
      signal_strength: 0,
      latency: 0,
      packet_loss: 0,
    },
    vision: {
      target_acquired: false,
      fps: 0,
      confidence: 0,
    },
  });
  const [cameraFeeds, setCameraFeeds] = useState({
    main_camera: null,
    thermal_camera: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 20;
  const reconnectDelay = 5000;

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWebSocket = () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket is already connected or connecting");
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("Max reconnection attempts reached. Stopping reconnection.");
      return;
    }

    wsRef.current = new WebSocket(`ws://${window.location.host}/ws`);

    wsRef.current.onopen = (event) => {
      console.log("WebSocket Connected", event);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      if (wsRef.current) {
        wsRef.current.send("Hello from client");
      }
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleIncomingMessage(data);
      console.log(data)

      if (wsRef.current) {
        wsRef.current.send("Hello from client");
      }
    };

    wsRef.current.onclose = (event) => {
      console.log("WebSocket Disconnected", event);
      setIsConnected(false);
      reconnectAttemptsRef.current += 1;
      setTimeout(connectWebSocket, reconnectDelay);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  };
  // @ts-ignore

  const handleIncomingMessage = (data) => {
    if (data.type === "batch") {
      // Update telemetry data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cv_mats, graphable_numbers, ...telemetry } = data.data;
      setTelemetryData((prevData) => ({
        ...prevData,
        ...telemetry,
      }));

      // Update camera feeds
      if (data.data["cv-mats"]) {
        setCameraFeeds(data.data["cv-mats"]);
      }

      // Update graphs
      if (data.data["graphable-numbers"]) {
        Object.entries(data.data["graphable-numbers"]).forEach(
          ([name, values]) => {
              // @ts-ignore

            if (window.addDataToGraph) {
                // @ts-ignore

              window.addDataToGraph(name, values);
            }
          },
        );
      }

      // Update robot position on minimap
        // @ts-ignore

      if (data.data.position && window.moveRobotIcon) {
          // @ts-ignore

        window.moveRobotIcon(data.data.position.x, data.data.position.y);
      }
    }
  };
  // @ts-ignore
  const sendCommand = (command) => {
      // @ts-ignore

    if (wsRef.current.readyState === WebSocket.OPEN) {
        // @ts-ignore

      wsRef.current.send(JSON.stringify(command));
    } else {
      console.error("Not connected to server. Please wait...");
    }
  };

  return {
    isConnected,
    telemetryData,
    cameraFeeds,
    sendCommand,
  };
}
