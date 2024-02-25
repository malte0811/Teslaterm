import {TelemetryEvent} from "./constants";
import {ScopeTraceConfig} from "./IPCConstantsToRenderer";

export interface MeasuredValue {
    type: TelemetryEvent.GAUGE | TelemetryEvent.GAUGE32 | TelemetryEvent.CHART | TelemetryEvent.CHART32;
    value: number;
    index: number;
}

export interface GaugeConf {
    type: TelemetryEvent.GAUGE32_CONF | TelemetryEvent.GAUGE_CONF;
    meterId: number;
    min: number;
    max: number;
    scale: number;
    name: string;
}

export interface TraceConf {
    type: TelemetryEvent.CHART32_CONF | TelemetryEvent.CHART_CONF;
    config: ScopeTraceConfig;
}

export interface ChartLine {
    type: TelemetryEvent.CHART_LINE;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    colorIndex: number;
}

export interface ChartText {
    type: TelemetryEvent.CHART_TEXT_CENTER | TelemetryEvent.CHART_TEXT;
    text: string;
    x: number;
    y: number;
    colorIndex: number;
    size: number;
}

export interface StateSync {
    type: TelemetryEvent.STATE_SYNC;
    packedState: number;
    maxPw?: number;
    maxPrf?: number;
}

export type TelemetryFrame = MeasuredValue |
    GaugeConf |
    TraceConf |
    {type: TelemetryEvent.CHART_DRAW} |
    {type: TelemetryEvent.CHART_CLEAR, title: string} |
    ChartLine |
    ChartText |
    StateSync |
    { type: TelemetryEvent.CONFIG_GET | TelemetryEvent.EVENT, data: string } |
    {type: TelemetryEvent.UNKNOWN, data: number[]};
