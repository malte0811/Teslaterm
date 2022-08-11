export const TT_GAUGE = 1;
export const TT_GAUGE_CONF = 2;
export const TT_CHART = 3;
export const TT_CHART_DRAW = 4;
export const TT_CHART_CONF = 5;
export const TT_CHART_CLEAR = 6;
export const TT_CHART_LINE = 7;
export const TT_CHART_TEXT = 8;
export const TT_CHART_TEXT_CENTER = 9;
export const TT_STATE_SYNC = 10;
export const TT_CONFIG_GET = 11;
export const TT_EVENT = 12;
export const TT_GAUGE32 = 13;
export const TT_GAUGE32_CONF = 14;
export const TT_CHART32 = 16;
export const TT_CHART32_CONF = 17;

export const UNITS: string[] = ['', 'V', 'A', 'W', 'Hz', '°C', 'kW', 'RPM'];

export const DATA_TYPE = 0;
export const DATA_NUM = 1;

export const FEATURE_TIMEBASE = "timebase";
export const FEATURE_TIMECOUNT = "time_count";
export const FEATURE_NOTELEMETRY = "notelemetry_supported";
export const FEATURE_MINSID = "min_sid_support";

// Connection types
export enum UD3ConnectionType {
    udp_min,
    serial_min,
    serial_plain,
    dummy,
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

export enum UD3AlarmLevel {
    info = 0,
    warn = 1,
    alarm = 2,
    critical = 3,
}

