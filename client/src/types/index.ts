interface ImageData {
  image_data: string;
  scale: number;
  flip: boolean;
}

interface GraphDataPoint {
  x: number;
  y: number;
}

interface StringData {
  value: string;
}

interface RobotPosition {
  x: number;
  y: number;
  heading: number;
}

interface RobotData {
  sent_timestamp: number;
  images: Map<string, ImageData>;
  graph_data: Map<string, Array<GraphDataPoint>>;
  string_data: Map<string, StringData>;
  robot_position: RobotPosition;
}

export type {
  ImageData,
  GraphDataPoint as GraphData,
  StringData,
  RobotPosition,
  RobotData,
};
