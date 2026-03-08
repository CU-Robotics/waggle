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

interface LogLine {
    text: string;
    color?: string;
}

interface LogData {
    lines: LogLine[];
}

interface WaggleData {
    sent_timestamp: number;
    images: { [key: string]: ImageData };
    svg_data: { [key: string]: SvgData };
    graph_data: { [key: string]: Array<GraphDataPoint> };
    string_data: { [key: string]: StringData };
    log_data: { [key: string]: LogData };
}

export type {
    ImageData,
    GraphDataPoint as GraphData,
    StringData,
    LogLine,
    LogData,
    WaggleData,
};
