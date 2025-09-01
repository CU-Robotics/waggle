interface ImageData {
  image_data: string;
  scale: number;
  flip: boolean;
}

interface SvgData {
  svg_string: string;
}

interface GraphDataSettings {
  clear_data: boolean;
}

interface GraphDataPoint {
  x: number;
  y: number;
  settings?: GraphDataSettings;
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
  images: { [key: string]: ImageData };
  svg_data: { [key: string]: SvgData };
  graph_data: { [key: string]: Array<GraphDataPoint> };
  string_data: { [key: string]: StringData };
  robot_position: RobotPosition;
}

export type {
  ImageData,
  GraphDataPoint as GraphData,
  StringData,
  RobotPosition,
  RobotData,
};
