import { useCallback, useEffect, useRef, useState } from "react";
import { GraphData, WaggleData } from "../types";

const event_timestamps: number[] = [];

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [maxDataPoints, setMaxDataPoints] = useState<number>(5000);
  const [maxLogLines, setMaxLogLines] = useState<number>(1000);

  // Use refs to accumulate data between animation frames
  const graphDataRef = useRef<WaggleData["graph_data"]>({});
  const imageDataRef = useRef<WaggleData["images"]>({});
  const svgDataRef = useRef<WaggleData["svg_data"]>({});
  const stringDataRef = useRef<WaggleData["string_data"]>({});
  const logDataRef = useRef<{ [key: string]: string[] }>({});
  const dirtyRef = useRef(false);
  const rafRef = useRef<number>(0);

  // State that triggers re-renders (flushed via RAF)
  const [graphData, setGraphData] = useState<WaggleData["graph_data"]>({});
  const [imageData, setImageData] = useState<WaggleData["images"]>({});
  const [svgData, setSvgData] = useState<WaggleData["svg_data"]>({});
  const [stringData, setStringData] = useState<WaggleData["string_data"]>({});
  const [logData, setLogData] = useState<{ [key: string]: string[] }>({});

  const maxDataPointsRef = useRef(maxDataPoints);
  const maxLogLinesRef = useRef(maxLogLines);
  useEffect(() => {
    maxDataPointsRef.current = maxDataPoints;
  }, [maxDataPoints]);
  useEffect(() => {
    maxLogLinesRef.current = maxLogLines;
  }, [maxLogLines]);

  // Track actual DOM render FPS via RAF timestamps
  const renderTimestamps = useRef<number[]>([]);

  // Flush accumulated ref data to state on animation frame.
  // Must create new array references so React detects changes.
  const flushToState = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    // Measure real render FPS from RAF callback timing
    const now = performance.now();
    const rt = renderTimestamps.current;
    rt.push(now);
    if (rt.length > 61) rt.shift();
    if (rt.length >= 2) {
      const elapsed = rt[rt.length - 1] - rt[0];
      const fps = ((rt.length - 1) / elapsed) * 1000;
      if (!graphDataRef.current.WAGGLE_FPS) {
        graphDataRef.current.WAGGLE_FPS = [];
      }
      graphDataRef.current.WAGGLE_FPS.push({ x: Date.now(), y: fps });
      const mdp = maxDataPointsRef.current;
      if (graphDataRef.current.WAGGLE_FPS.length > mdp) {
        graphDataRef.current.WAGGLE_FPS = graphDataRef.current.WAGGLE_FPS.slice(-mdp);
      }
    }

    const gd: WaggleData["graph_data"] = {};
    for (const k in graphDataRef.current) {
      gd[k] = graphDataRef.current[k].slice();
    }
    setGraphData(gd);

    setImageData({ ...imageDataRef.current });
    setSvgData({ ...svgDataRef.current });
    setStringData({ ...stringDataRef.current });

    const ld: { [key: string]: string[] } = {};
    for (const k in logDataRef.current) {
      ld[k] = logDataRef.current[k].slice();
    }
    setLogData(ld);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(flushToState);
    }
  }, [flushToState]);

  const handleIncomingMessage = useCallback(
    (all_data: WaggleData[]) => {
      const mdp = maxDataPointsRef.current;
      const mll = maxLogLinesRef.current;

      for (let i = 0; i < all_data.length; i++) {
        const data = all_data[i];
        const lastFrame = i === all_data.length - 1;

        // Accumulate graph data directly into ref
        if (data.graph_data) {
          for (const [graph_name, _graph_points] of Object.entries(
            data.graph_data,
          )) {
            const graph_points: GraphData[] = _graph_points;
            if (!graphDataRef.current[graph_name]) {
              graphDataRef.current[graph_name] = [];
            }
            const arr = graphDataRef.current[graph_name];

            for (const point of graph_points) {
              if (point.settings?.clear_data) {
                arr.length = 0;
                continue;
              }
              arr.push(point);
            }

            if (arr.length > mdp) {
              graphDataRef.current[graph_name] = arr.slice(arr.length - mdp);
            }
          }
        }

        if (data.images && lastFrame) {
          for (const [key, value] of Object.entries(data.images)) {
            imageDataRef.current[key] = value;
          }
        }

        if (data.svg_data && lastFrame) {
          for (const [key, value] of Object.entries(data.svg_data)) {
            svgDataRef.current[key] = value;
          }
        }

        if (data.string_data && lastFrame) {
          for (const [key, value] of Object.entries(data.string_data)) {
            stringDataRef.current[key] = value;
          }
        }

        if (data.log_data) {
          for (const [key, value] of Object.entries(data.log_data)) {
            if (!logDataRef.current[key]) {
              logDataRef.current[key] = [];
            }
            const updated = logDataRef.current[key];
            updated.push(...value.lines);
            if (updated.length > mll) {
              logDataRef.current[key] = updated.slice(updated.length - mll);
            }
          }
        }
      }

      scheduleFlush();
    },
    [scheduleFlush],
  );

  useEffect(() => {
    const wsRef: { current: WebSocket | null } = { current: null };
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 20;
    const reconnectDelay = 5000;

    const connectWebSocket = () => {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      if (reconnectAttempts >= maxReconnectAttempts) {
        return;
      }

      wsRef.current = new WebSocket(`ws://${window.location.host}/ws`);

      wsRef.current.onopen = (event) => {
        console.log("WebSocket Connected", event);
        setIsConnected(true);
        reconnectAttempts = 0;
        if (wsRef.current) {
          wsRef.current.send("Hello from client");
        }
      };

      wsRef.current.onmessage = (event) => {
        const robot_data: WaggleData[] = JSON.parse(event.data);

        if (robot_data.length === 0) {
          if (wsRef.current) {
            wsRef.current.send("{}");
          }
        }

        if (robot_data.length > 0) {
          event_timestamps.push(Date.now());
        }

        if (event_timestamps.length > 100) {
          event_timestamps.shift();
          const eps =
            1000 /
            ((event_timestamps[event_timestamps.length - 1] -
              event_timestamps[0]) /
              event_timestamps.length);
          const eps_data: GraphData = { x: Date.now(), y: eps };
          if (robot_data.length > 0) {
            const last = robot_data[robot_data.length - 1];
            if (!last.graph_data) last.graph_data = {};
            last.graph_data.EVENTS_PER_SECOND = [eps_data];
          }
        }

        handleIncomingMessage(robot_data);

        if (wsRef.current) {
          wsRef.current.send("{}");
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket Disconnected", event);
        setIsConnected(false);
        reconnectAttempts += 1;
        setTimeout(connectWebSocket, reconnectDelay);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };
    };

    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleIncomingMessage]);

  return {
    isConnected,
    graphData,
    imageData,
    svgData,
    stringData,
    logData,
    maxDataPoints,
    setMaxDataPoints,
    maxLogLines,
    setMaxLogLines,
  };
}
