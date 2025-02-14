interface ImageData {
  image_data: string;
  scale: number;
  flip: boolean;
}

interface GraphData {
  timestamp: number;
  value: number;
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
  graph_data: Map<string, Array<GraphData>>;
  string_data: Map<string, StringData>;
  robot_position: RobotPosition;
}

export type { ImageData, GraphData, StringData, RobotPosition, RobotData };
