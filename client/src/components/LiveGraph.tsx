import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GraphData } from "../types";
import { IconX } from "@tabler/icons-react";
import { useMemo } from "react";

interface LiveGraphProps {
  title: string;
  data: GraphData[];
  onRemove: () => void;
  isDarkMode: boolean;
}

function LiveGraph({ title, data, onRemove, isDarkMode }: LiveGraphProps) {
  const gridStroke = isDarkMode ? "#ddd" : "#111";
  const axisTickFill = isDarkMode ? "#ddd" : "#777";
  const tooltipContentStyle = {
    background: isDarkMode ? "#333" : "#fff",
    border: isDarkMode ? "1px solid #ddd" : "1px solid #333",
    color: isDarkMode ? "#ddd" : "#333",
  };

  // Calculate domains based on data
  const domains = useMemo(() => {
    if (data.length === 0) return { x: [0, 100], y: [0, 100] };

    const xValues = data.map((d) => d.x);
    const yValues = data.map((d) => d.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Add some padding to the domains
    const xPadding = (xMax - xMin) * 0.01;
    const yPadding = (yMax - yMin) * 0.01;

    return {
      x: [xMin - xPadding, xMax + xPadding],
      y: [yMin - yPadding, yMax + yPadding],
    };
  }, [data]);

  return (
    <div className="flex h-[300px] w-[450px] flex-col rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          onClick={onRemove}
          className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          aria-label="Remove graph"
        >
          <IconX size={16} />
        </button>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              type="number"
              dataKey="x"
              stroke={axisTickFill}
              domain={domains.x}
              allowDataOverflow={true}
              tickFormatter={(x) => `${Math.round(x * 100) / 100}`}
            />
            <YAxis
              type="number"
              stroke={axisTickFill}
              domain={domains.y}
              allowDataOverflow={true}
              tickFormatter={(y) => `${Math.round(y * 100) / 100}`}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelFormatter={(x) => `X: ${x}`}
              formatter={(y: number) => [
                `${Math.round(y * 100) / 100}`,
                "Value",
              ]}
            />
            <Line
              type="monotone"
              dataKey="y"
              stroke="#8884d8"
              dot={false}
              isAnimationActive={false}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LiveGraph;
