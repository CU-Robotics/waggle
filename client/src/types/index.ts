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

interface WaggleNonImageData {
    sent_timestamp: number;
    svg_data: { [key: string]: SvgData };
    graph_data: { [key: string]: Array<GraphDataPoint> };
    string_data: { [key: string]: StringData };
    log_data: { [key: string]: LogData };
}

interface WaggleData {
    sent_timestamp: number;
    images: { [key: string]: ImageData };
    svg_data: { [key: string]: SvgData };
    graph_data: { [key: string]: Array<GraphDataPoint> };
    string_data: { [key: string]: StringData };
    log_data: { [key: string]: LogData };
}

interface ConfigurableVarData {
    configurable_int: {[key: string]: number};
    configurable_double: {[key: string]: number};
}

interface WaggleDataWebSocketMessage{
    kind: "waggle_data",
    data: WaggleData[],
}

interface ConfigurableVarDataWebSocketMessage{
    kind: "configurable_var_data",
    data: ConfigurableVarData,
}

type WebSocketMessage = WaggleDataWebSocketMessage | ConfigurableVarDataWebSocketMessage;
export type {
    ImageData,
    GraphDataPoint as GraphData,
    StringData,
    LogData,
    WaggleData,
    WaggleNonImageData,
    ConfigurableVarData,
    ConfigurableVarDataWebSocketMessage,
    WaggleDataWebSocketMessage,
    WebSocketMessage
};
