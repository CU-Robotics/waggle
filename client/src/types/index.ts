interface ImageData {
    image_data: Uint8Array;
    scale: number;
    flip: boolean;
    blob_url?: string;
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

interface EventTraceData {
    sequence: number;
    virtual_timestamp_secs: number;
    operation: string;
    channel_name: string;
    payload_json?: string;
}

interface WaggleNonImageData {
    sent_timestamp: number;
    svg_data: { [key: string]: SvgData };
    graph_data: { [key: string]: Array<GraphDataPoint> };
    string_data: { [key: string]: StringData };
    log_data: { [key: string]: LogData };
    event_trace_data: { [key: string]: Array<EventTraceData> };
}

interface WaggleData {
    sent_timestamp: number;
    images: { [key: string]: ImageData };
    svg_data: { [key: string]: SvgData };
    graph_data: { [key: string]: Array<GraphDataPoint> };
    string_data: { [key: string]: StringData };
    log_data: { [key: string]: LogData };
    event_trace_data: { [key: string]: Array<EventTraceData> };
}

export type {
    ImageData,
    GraphDataPoint as GraphData,
    StringData,
    LogData,
    EventTraceData,
    WaggleData,
    WaggleNonImageData,
};
