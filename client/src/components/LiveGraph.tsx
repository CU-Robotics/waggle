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
}

function LiveGraph({ title, data, onRemove }: LiveGraphProps) {
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
          className="rounded-full p-1 hover:bg-gray-100"
          aria-label="Remove graph"
        >
          <IconX size={16} />
        </button>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              domain={domains.x}
              allowDataOverflow={true}
              tickFormatter={(x) => `${Math.round(x * 100) / 100}`}
            />
            <YAxis
              type="number"
              domain={domains.y}
              allowDataOverflow={true}
              tickFormatter={(y) => `${Math.round(y * 100) / 100}`}
            />
            <Tooltip
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
