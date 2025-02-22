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
              dataKey="x"
              domain={["auto", "auto"]}
              // tickFormatter={(x) => {
              //   const date = new Date(x);
              //   return `${date.getMinutes()}:${date.getSeconds()}`;
              // }}
            />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(x) => {
                return `X: ${x}`;
              }}
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
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LiveGraph;
