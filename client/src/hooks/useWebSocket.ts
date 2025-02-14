/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useEffect } from "react";
import { GraphData, RobotData } from "../types";

let frame_timestamps: number[] = [];

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<RobotData["graph_data"]>(
    new Map(),
  );
  const [imageData, setImageData] = useState<RobotData["images"]>(new Map());
  const [stringData, setStringData] = useState<RobotData["string_data"]>(
    new Map(),
  );
  const [robotPosition, setRobotPosition] = useState<
    RobotData["robot_position"]
  >({ x: 0, y: 0, heading: 0 });
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

    // TODO - Change to dynamic URL
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
      const data: RobotData[] = JSON.parse(event.data);
      frame_timestamps.push(Date.now());

      if (frame_timestamps.length > 100) {
        frame_timestamps.shift();
        const fps =
          1000 /
          ((frame_timestamps[frame_timestamps.length - 1] -
            frame_timestamps[0]) /
            frame_timestamps.length);
        const fps_data: GraphData = {
          timestamp: Date.now(),
          value: fps,
        };
        const map = new Map<string, GraphData[]>(
          Object.entries(data[data.length - 1].graph_data),
        );
        map.set("WAGGLE_FPS", [fps_data]);

        //@ts-ignore
        data[data.length - 1].graph_data = Object.fromEntries(map);
      }
      handleIncomingMessage(data);

      if (wsRef.current) {
        const responseData = {
          initially_sent_timestamp: data[data.length - 1].sent_timestamp,
        };
        wsRef.current.send(responseData.toString());
      } else {
        console.log("wsRef.current is null");
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

  const handleIncomingMessage = (all_data: RobotData[]) => {
    for (let i = 0; i < all_data.length; i++) {
      const data = all_data[i];
      const lastFrame = i === all_data.length - 1;
      //  Append graph data
      if (data.graph_data) {
        setGraphData((prevData) => {
          // Create a new Map for this update
          const newData = new Map(prevData);
          for (const [key, value] of Object.entries(data.graph_data)) {
            if (newData.has(key)) {
              const updatedArray = [...(newData.get(key) || []), ...value];
              const maxPoint = 5000;
              const trimmedArray =
                updatedArray.length > maxPoint
                  ? updatedArray.slice(updatedArray.length - maxPoint)
                  : updatedArray;
              newData.set(key, trimmedArray);
            } else {
              newData.set(key, [...value]);
            }
          }
          return newData;
        });
      }

      // Update image data
      if (data.images && lastFrame) {
        setImageData((prevData) => {
          const newData = new Map(prevData);
          for (const [key, value] of Object.entries(data.images)) {
            newData.set(key, value);
          }
          return newData;
        });
      }

      // Update string data
      if (data.string_data && lastFrame) {
        setStringData((prevData) => {
          const newData = new Map(prevData);
          for (const [key, value] of Object.entries(data.string_data)) {
            newData.set(key, value);
          }
          return newData;
        });
      }

      // Update robot position
      if (data.robot_position && lastFrame) {
        setRobotPosition(data.robot_position);
      }
    }
  };

  return {
    isConnected,
    graphData,
    imageData,
    stringData,
    robotPosition,
  };
}
