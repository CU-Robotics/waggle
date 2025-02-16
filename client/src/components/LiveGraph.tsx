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

interface LiveGraphProps {
  title: string;
  data: GraphData[];
  onRemove: () => void;
}

function LiveGraph({ title, data, onRemove }: LiveGraphProps) {
  return (
    <div className="flex h-[300px] w-[450px] flex-col rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          onClick={onRemove}
          className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
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
              dataKey="timestamp"
              domain={["auto", "auto"]}
              tickFormatter={(timestamp) => {
                const date = new Date(timestamp);
                return `${date.getMinutes()}:${date.getSeconds()}`;
              }}
            />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(timestamp) => {
                const date = new Date(timestamp);
                return `Time: ${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
              }}
              formatter={(value: number) => [
                `${Math.round(value * 100) / 100}`,
                "Value",
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LiveGraph;
