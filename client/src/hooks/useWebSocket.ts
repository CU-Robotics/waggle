/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useEffect } from "react";
import { GraphData, RobotData } from "../types";

const frame_timestamps: number[] = [];

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [graphData, setGraphData] = useState<RobotData["graph_data"]>({});
  const [imageData, setImageData] = useState<RobotData["images"]>({});
  const [stringData, setStringData] = useState<RobotData["string_data"]>({});

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
      const robot_data: RobotData[] = JSON.parse(event.data);
      frame_timestamps.push(Date.now());

      if (frame_timestamps.length > 100) {
        frame_timestamps.shift();
        const fps =
          1000 /
          ((frame_timestamps[frame_timestamps.length - 1] -
            frame_timestamps[0]) /
            frame_timestamps.length);
        const fps_data: GraphData = {
          x: Date.now(),
          y: fps,
        };

        robot_data[robot_data.length - 1].graph_data.WAGGLE_FPS = [fps_data];
      }
      handleIncomingMessage(robot_data);

      if (wsRef.current) {
        const responseData = {};
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
          const newData = { ...prevData };

          for (const [graph_name, _graph_points] of Object.entries(
            data.graph_data,
          )) {
            const graph_points: GraphData[] = _graph_points;
            if (newData[graph_name]) {
              const updatedArray = [...newData[graph_name]];

              for (const point of graph_points) {
                updatedArray.push(point);

                if (point.settings?.clear_data) {
                  console.log(`Clearing ${graph_name}`);
                  // Clear the array if the setting is triggered
                  updatedArray.splice(0, updatedArray.length);
                }
              }

              const maxPoint = 5000;
              const trimmedArray =
                updatedArray.length > maxPoint
                  ? updatedArray.slice(updatedArray.length - maxPoint)
                  : updatedArray;
              newData[graph_name] = trimmedArray;
            } else {
              newData[graph_name] = [...graph_points];
            }
          }
          return newData;
        });
      }

      // Update image data
      if (data.images && lastFrame) {
        setImageData((prevData) => {
          const newData = { ...prevData };
          for (const [key, value] of Object.entries(data.images)) {
            newData[key] = value;
          }
          return newData;
        });
      }

      if (data.string_data && lastFrame) {
        setStringData((prevData) => {
          const newData = { ...prevData };
          for (const [key, value] of Object.entries(data.string_data)) {
            newData[key] = value;
          }
          return newData;
        });
      }

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
