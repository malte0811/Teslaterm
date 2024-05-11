export enum TelemetryEvent {
    GAUGE = 1,
    GAUGE_CONF = 2,
    CHART = 3,
    CHART_DRAW = 4,
    CHART_CONF = 5,
    CHART_CLEAR = 6,
    CHART_LINE = 7,
    CHART_TEXT = 8,
    CHART_TEXT_CENTER = 9,
    STATE_SYNC = 10,
    CONFIG_GET = 11,
    EVENT = 12,
    GAUGE32 = 13,
    GAUGE32_CONF = 14,
    CHART32 = 16,
    CHART32_CONF = 17,
    // "Synthetic" type for any unknown events
    UNKNOWN,
}

export const UNITS: string[] = ['', 'V', 'A', 'W', 'Hz', '°C', 'kW', 'RPM'];

export const DATA_TYPE = 0;
export const DATA_NUM = 1;

export const FEATURE_TIMEBASE = "timebase";
export const FEATURE_TIMECOUNT = "time_count";
export const FEATURE_NOTELEMETRY = "notelemetry_supported";
export const FEATURE_MINSID = "min_sid_support";
export const FEATURE_PROTOCOL_VERSION = "protocol";
export const LAST_SUPPORTED_PROTOCOL = 3.0;

// Connection types
export enum UD3ConnectionType {
    udp_min,
    serial_min,
    serial_plain,
}

export const CONNECTION_TYPES_BY_NAME = new Map<string, UD3ConnectionType>();
CONNECTION_TYPES_BY_NAME.set('udpmin', UD3ConnectionType.udp_min);
CONNECTION_TYPES_BY_NAME.set('min', UD3ConnectionType.serial_min);
CONNECTION_TYPES_BY_NAME.set('serial', UD3ConnectionType.serial_plain);

export const CONNECTION_TYPE_DESCS = new Map<UD3ConnectionType, string>();
CONNECTION_TYPE_DESCS.set(UD3ConnectionType.udp_min, "MIN over UDP");
CONNECTION_TYPE_DESCS.set(UD3ConnectionType.serial_min, "Serial (MIN)");
CONNECTION_TYPE_DESCS.set(UD3ConnectionType.serial_plain, "Serial (Plain)");
// connection_types.set(dummy, "Dummy connection (debug only!)");

//export interface CoilID {
//    id: number;
//}
export type CoilID = number;

export function coilSuffix(coil: CoilID) {
    return coil.toString();
}

export enum UD3AlarmLevel {
    info = 0,
    warn = 1,
    alarm = 2,
    critical = 3,
}

