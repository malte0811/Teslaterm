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
export const TT_GAUGE32 = 13;
export const TT_GAUGE32_CONF = 14;
export const UNITS: string[] = ['', 'V', 'A', 'W', 'Hz', '°C', 'kW', 'RPM'];

export const TYPE_UNSIGNED = 0;
export const TYPE_SIGNED = 1;
export const TYPE_FLOAT = 2;
export const TYPE_CHAR = 3;
export const TYPE_STRING = 4;

export const DATA_TYPE = 0;
export const DATA_NUM = 1;

export const FEATURE_TIMEBASE = "timebase";
export const FEATURE_TIMECOUNT = "time_count";

// Connection types
export const eth_node = "eth";
export const serial_min = "min";
export const serial_plain = "serial";
export const connection_types = new Map<string, string>();
connection_types.set(eth_node, "Ethernet to UD3-node");
connection_types.set(serial_min, "Serial (MIN)");
connection_types.set(serial_plain, "Serial (Plain)");

