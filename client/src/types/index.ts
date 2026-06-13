interface ImageData {
  image_data: Uint8Array;
  scale: number;
  flip: boolean;
  show_base: boolean;
  blob_url?: string;
  svg_overlays?: { [key: string]: string };
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

interface LogData {
  lines: string[];
}

interface ConfigurableVarData {
  configurable_ints: { [key: string]: number };
  configurable_doubles: { [key: string]: number };
  configurable_strings: { [key: string]: string };
}

interface WaggleNonImageData {
  sent_timestamp: number;
  svg_data: { [key: string]: SvgData };
  graph_data: { [key: string]: Array<GraphDataPoint> };
  string_data: { [key: string]: StringData };
  log_data: { [key: string]: LogData };
  configurable_vars?: ConfigurableVarData;
}

interface WaggleData {
  sent_timestamp: number;
  images: { [key: string]: ImageData };
  svg_data: { [key: string]: SvgData };
  graph_data: { [key: string]: Array<GraphDataPoint> };
  string_data: { [key: string]: StringData };
  log_data: { [key: string]: LogData };
  configurable_vars: ConfigurableVarData;
}

export type {
  ImageData,
  GraphDataPoint as GraphData,
  StringData,
  LogData,
  WaggleData,
  WaggleNonImageData,
  ConfigurableVarData,
};
