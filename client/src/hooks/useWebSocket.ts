/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useEffect } from "react";
import { RobotData } from "../types";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<RobotData["graph_data"]>(new Map());
  const [imageData, setImageData] = useState<RobotData["images"]>(new Map());
  const [stringData, setStringData] = useState<RobotData["string_data"]>(new Map());
  const [robotPosition, setRobotPosition] = useState<RobotData["robot_position"]>({x: 0, y: 0, heading: 0});
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
    wsRef.current = new WebSocket(`ws://localhost:8765/ws`);

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



  const handleIncomingMessage = (data: RobotData) => {
    //  Append graph data
    if (data.graph_data) {
      setGraphData((prevData) => {
        for (const [key, value] of Object.entries(data.graph_data)) {
          if (prevData.has(key)) {
            const array = prevData.get(key);
            const maxPoint = 10000;

            if (array && array.length > maxPoint) {
              array.splice(0, array.length - maxPoint);
            }

            array?.push(...value);
          } else {
            prevData.set(key, value);
          }
        }
        return prevData;
      });
    }

    // Update image data
    if (data.images) {
      setImageData((prevData) => {
        const newData = new Map(prevData);
        for (const [key, value] of Object.entries(data.images)) {
          newData.set(key, value);
        }
        return newData;
      });
    }

    // Update string data
    if (data.string_data) {
      setStringData((prevData) => {
        const newData = new Map(prevData);
        for (const [key, value] of Object.entries(data.string_data)) {
          newData.set(key, value);
        }
        return newData;
      });
    }

    // Update robot position
    if (data.robot_position) {
      setRobotPosition(data.robot_position);
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
