import {MeterConfig, ScopeTraceConfig} from "./IPCConstantsToRenderer";
import {TelemetryFrame} from "./TelemetryTypes";

export enum FlightEventType {
    data_from_ud3,
    data_to_ud3,
    transmit_error,
    connection_state_change,
}

/**
 * This type is only used at runtime, using the fact that we can quickly "copy" a SharedArrayBuffer to a worker thread
 * (unlike "standard" objects). Therefore, the binary event format can be changed without any concern of breaking
 * existing flight recording files.
 * For some vague thread-safety guarantee, note that we never write to any bytes before the writeIndex (and never
 * decrease the writeIndex), while the export worker only ever reads bytes before the writeIndex.
 */
export interface FlightRecordingBuffer {
    // Event format:
    // type: 1 byte/FlightEventType
    // time: 4 bytes/u32
    // dataLength: 4 bytes/u32
    // data: dataLength bytes/u8[]
    buffer: SharedArrayBuffer;
    initialScopeConfig: FRScopeConfigs;
    initialMeterConfig: FRMeterConfigs;
    writeIndex: number;
}
export const FR_HEADER_BYTES = 1 + 4 + 4;

export enum FRDisplayEventType {
    terminal_data,
    terminal_start_stop,
    telemetry,
    feature_sync,
    set_synth,
    event_info,
    unknown,
}

export function getEventTypeDesc(ev: FRDisplayEventType) {
    switch (ev) {
        case FRDisplayEventType.terminal_data:
            return 'Terminal data';
        case FRDisplayEventType.terminal_start_stop:
            return 'Terminal start/stop';
        case FRDisplayEventType.telemetry:
            return 'Telemetry';
        case FRDisplayEventType.feature_sync:
            return 'Feature sync';
        case FRDisplayEventType.set_synth:
            return 'Synth change';
        case FRDisplayEventType.event_info:
            return 'Event/info';
        case FRDisplayEventType.unknown:
            return 'Unknown';
    }
}

interface ParsedEventBase {
    time: number;
    toUD3: boolean;
    desc: string;
}

type ParsedEventExtra = {type: FRDisplayEventType.terminal_data, printed: string} |
    {type: FRDisplayEventType.telemetry, frame: TelemetryFrame} |
    {type: FRDisplayEventType.event_info, infoObject?: any} |
    {
        type: FRDisplayEventType.feature_sync |
            FRDisplayEventType.terminal_start_stop |
            FRDisplayEventType.set_synth |
            FRDisplayEventType.unknown,
    };

export type ParsedEvent = ParsedEventBase & ParsedEventExtra;

export type FREventSet = {
    [K in FRDisplayEventType]: boolean;
};

export function makeEmptyEventSet(): FREventSet {
    return {
        [FRDisplayEventType.terminal_data]: false,
        [FRDisplayEventType.terminal_start_stop]: false,
        [FRDisplayEventType.telemetry]: false,
        [FRDisplayEventType.feature_sync]: false,
        [FRDisplayEventType.set_synth]: false,
        [FRDisplayEventType.event_info]: false,
        [FRDisplayEventType.unknown]: false,
    };
}

export const allFREvents = (() => {
    const values: FRDisplayEventType[] = [];
    for (const candidate of Object.values(FRDisplayEventType)) {
        if (typeof(candidate) !== 'string') {
            values.push(candidate);
        }
    }
    return values;
})();

export type FRMeterConfigs = MeterConfig[];
export type FRScopeConfigs = ScopeTraceConfig[];

export interface InitialFRState {
    meterConfigs: FRMeterConfigs;
    traceConfigs: FRScopeConfigs;
}

