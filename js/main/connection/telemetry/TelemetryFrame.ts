import {DATA_NUM, DATA_TYPE, TelemetryEvent, UD3AlarmLevel, UNITS} from "../../../common/constants";
import {UD3ConfigOption, UD3ConfigType} from "../../../common/IPCConstantsToRenderer";
import {bytes_to_signed, convertBufferToString, Endianness, from_32_bit_bytes} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {commands} from "../connection";
import {addAlarm} from "./Alarms";
import {updateStateFromTelemetry} from "./UD3State";

export type UD3ConfigConsumer = (cfg: UD3ConfigOption[]) => any;
let configRequestQueue: UD3ConfigConsumer[] = [];

export function requestConfig(out: UD3ConfigConsumer) {
    configRequestQueue.push(out);
    if (configRequestQueue.length === 1) {
        commands.sendCommand("config_get\r").catch((err) => console.error("While getting config:", err));
    }
}

let udconfig: UD3ConfigOption[] = [];

interface MeasuredValue {
    type: TelemetryEvent.GAUGE | TelemetryEvent.GAUGE32 | TelemetryEvent.CHART | TelemetryEvent.CHART32;
    value: number;
    index: number;
}

interface GaugeConf {
    type: TelemetryEvent.GAUGE32_CONF | TelemetryEvent.GAUGE_CONF;
    index: number;
    min: number;
    max: number;
    divider: number;
    name: string;
}

interface TraceConf {
    type: TelemetryEvent.CHART32_CONF | TelemetryEvent.CHART_CONF;
    traceId: number;
    min: number;
    max: number;
    offset: number;
    unit: string;
    divider: number;
    name: string;
}

interface ChartLine {
    type: TelemetryEvent.CHART_LINE;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    colorIndex: number;
}

interface ChartText {
    type: TelemetryEvent.CHART_TEXT_CENTER | TelemetryEvent.CHART_TEXT;
    text: string;
    x: number;
    y: number;
    colorIndex: number;
    size: number;
}

interface StateSync {
    type: TelemetryEvent.STATE_SYNC;
    packedState: number;
    maxPw?: number;
    maxPrf?: number;
}

type TelemetryFrame = MeasuredValue |
    GaugeConf |
    TraceConf |
    {type: TelemetryEvent.CHART_DRAW} |
    {type: TelemetryEvent.CHART_CLEAR, title: string} |
    ChartLine |
    ChartText |
    StateSync |
    { type: TelemetryEvent.CONFIG_GET | TelemetryEvent.EVENT, data: string } |
    {type: TelemetryEvent.UNKNOWN, data: number[]};

export class TelemetryFrameParser {
    private readonly length: number;
    private readonly data: number[];

    constructor(length: number) {
        this.length = length;
        this.data = [];
    }

    public addByte(byte: number): TelemetryFrame | undefined {
        this.data.push(byte);
        if (this.data.length >= this.length) {
            return this.convertFrame();
        } else {
            return undefined;
        }
    }

    private convertFrame(): TelemetryFrame {
        const type = this.data[DATA_TYPE];
        const num = this.data[DATA_NUM];
        switch (type) {
            case TelemetryEvent.GAUGE:
                return {
                    index: num,
                    type,
                    value: bytes_to_signed(this.data[2], this.data[3]),
                };
            case TelemetryEvent.GAUGE32:
                return {
                    index: num,
                    type,
                    value: from_32_bit_bytes(this.data.slice(2), Endianness.LITTLE_ENDIAN),
                };
            case TelemetryEvent.GAUGE_CONF:
                return {
                    divider: 1,
                    index: num,
                    max: bytes_to_signed(this.data[4], this.data[5]),
                    min: bytes_to_signed(this.data[2], this.data[3]),
                    name: convertBufferToString(this.data.slice(6)),
                    type,
                };
            case TelemetryEvent.GAUGE32_CONF:
                return {
                    divider: from_32_bit_bytes(this.data.slice(10, 14), Endianness.LITTLE_ENDIAN),
                    index: num,
                    max: from_32_bit_bytes(this.data.slice(6, 10), Endianness.LITTLE_ENDIAN),
                    min: from_32_bit_bytes(this.data.slice(2, 6), Endianness.LITTLE_ENDIAN),
                    name: convertBufferToString(this.data.slice(14)),
                    type,
                };
            case TelemetryEvent.CHART32_CONF:
                return {
                    divider: from_32_bit_bytes(this.data.slice(14, 18), Endianness.LITTLE_ENDIAN),
                    max: from_32_bit_bytes(this.data.slice(6, 10), Endianness.LITTLE_ENDIAN),
                    min: from_32_bit_bytes(this.data.slice(2, 6), Endianness.LITTLE_ENDIAN),
                    name: convertBufferToString(this.data.slice(19)),
                    offset: from_32_bit_bytes(this.data.slice(10, 14), Endianness.LITTLE_ENDIAN),
                    traceId: num,
                    type,
                    unit: UNITS[this.data[18]],
                };
            case TelemetryEvent.CHART_CONF:
                return {
                    divider: 1,
                    max: bytes_to_signed(this.data[4], this.data[5]),
                    min: bytes_to_signed(this.data[2], this.data[3]),
                    name: convertBufferToString(this.data.slice(9)),
                    offset: bytes_to_signed(this.data[6], this.data[7]),
                    traceId: num,
                    type,
                    unit: UNITS[this.data[8]],
                };
            case TelemetryEvent.CHART:
                return {
                    index: num,
                    type,
                    value: bytes_to_signed(this.data[2], this.data[3]),
                };
            case TelemetryEvent.CHART32:
                return {
                    index: num,
                    type,
                    value: from_32_bit_bytes(this.data.slice(2), Endianness.LITTLE_ENDIAN),
                };
            case TelemetryEvent.CHART_DRAW:
                return {type};
            case TelemetryEvent.CHART_CLEAR:
                return {type, title: convertBufferToString(this.data.slice(1)) || 'Plot'};
            case TelemetryEvent.CHART_LINE:
                return {
                    colorIndex: this.data[9],
                    type,
                    x1: bytes_to_signed(this.data[1], this.data[2]),
                    x2: bytes_to_signed(this.data[5], this.data[6]),
                    y1: bytes_to_signed(this.data[3], this.data[4]),
                    y2: bytes_to_signed(this.data[7], this.data[8]),
                };
            case TelemetryEvent.CHART_TEXT:
            case TelemetryEvent.CHART_TEXT_CENTER:
                return parseStringDraw(this.data, type);
            case TelemetryEvent.STATE_SYNC:
                if (this.data.length >= 6) {
                    return {
                        maxPrf: this.data[4] | (this.data[5] << 8),
                        maxPw: this.data[2] | (this.data[3] << 8),
                        packedState: this.data[1],
                        type,
                    };
                } else {
                    return {type, packedState: this.data[1]};
                }
            case TelemetryEvent.CONFIG_GET:
            case TelemetryEvent.EVENT:
                return {data: convertBufferToString(this.data.slice(1)), type};
            default:
                console.warn(`Unknown telemetry event: ${this.data}`);
                return {type: TelemetryEvent.UNKNOWN, data: this.data};
        }
    }
}

export function sendTelemetryFrame(frame: TelemetryFrame, source: object, initializing: boolean) {
    switch (frame.type) {
        case TelemetryEvent.GAUGE32:
        case TelemetryEvent.GAUGE: {
            ipcs.meters.setValue(frame.index, frame.value);
            break;
        }
        case TelemetryEvent.GAUGE32_CONF:
        case TelemetryEvent.GAUGE_CONF: {
            ipcs.meters.configure(frame.index, frame.min, frame.max, frame.divider, frame.name);
            break;
        }
        case TelemetryEvent.CHART_CONF:
        case TelemetryEvent.CHART32_CONF: {
            ipcs.scope.configure(
                frame.traceId, frame.min, frame.max, frame.offset, frame.divider, frame.unit, frame.name,
            );
            break;
        }
        case TelemetryEvent.CHART32:
        case TelemetryEvent.CHART: {
            ipcs.scope.addValue(frame.index, frame.value);
            break;
        }
        case TelemetryEvent.CHART_DRAW: {
            ipcs.scope.drawChart();
            break;
        }
        case TelemetryEvent.CHART_CLEAR: {
            ipcs.scope.startControlledDraw(frame.title, source);
            break;
        }
        case TelemetryEvent.CHART_LINE: {
            ipcs.scope.drawLine(frame.x1, frame.y1, frame.x2, frame.y2, frame.colorIndex, source);
            break;
        }
        case TelemetryEvent.CHART_TEXT_CENTER:
        case TelemetryEvent.CHART_TEXT: {
            const center = frame.type === TelemetryEvent.CHART_TEXT_CENTER;
            ipcs.scope.drawText(frame.x, frame.y, frame.colorIndex, frame.size, frame.text, center, source);
            break;
        }
        case TelemetryEvent.STATE_SYNC: {
            updateStateFromTelemetry(frame.packedState);
            if (frame.maxPw !== undefined) {
                ipcs.sliders.setSliderRanges(frame.maxPw, frame.maxPrf).catch(
                    (err) => console.log("While updating slider ranges", err),
                );
            }
            break;
        }
        case TelemetryEvent.CONFIG_GET: {
            const str = frame.data;
            if (str === "NULL;NULL") {
                for (const request of configRequestQueue) {
                    request(udconfig);
                }
                udconfig = [];
                configRequestQueue = [];
            } else {
                const substrings = str.split(";");
                const type = getOptionType(substrings[2]);
                if (type !== undefined) {
                    udconfig.push({
                        current: substrings[1],
                        help: substrings[6],
                        max: parseOptionMinMax(substrings[5]),
                        min: parseOptionMinMax(substrings[4]),
                        name: substrings[0],
                        type,
                    });
                } else {
                    console.error("Unknown type in option ", str);
                }
            }
            break;
        }
        case TelemetryEvent.EVENT: {
            const [levelStr, timestampStr, message, valueStr] = frame.data.split(';');
            const level = Number.parseInt(levelStr, 10) as UD3AlarmLevel;
            const timestamp = Number.parseInt(timestampStr, 10);
            const value = valueStr === 'NULL' ? undefined : Number.parseInt(valueStr, 10);
            addAlarm({message, value, level, timestamp}, initializing);
            break;
        }
    }
}
function parseOptionMinMax(value: string) {
    if (value === 'NULL') {
        return undefined;
    } else {
        return parseFloat(value);
    }
}

function getOptionType(idStr: string): UD3ConfigType | undefined {
    const id = parseInt(idStr, 10);
    switch (id) {
        case 0:
            return UD3ConfigType.TYPE_UNSIGNED;
        case 1:
            return UD3ConfigType.TYPE_SIGNED;
        case 2:
            return UD3ConfigType.TYPE_FLOAT;
        case 4:
            return UD3ConfigType.TYPE_STRING;
    }
    return undefined;
}

function parseStringDraw(dat: number[], type: TelemetryEvent.CHART_TEXT | TelemetryEvent.CHART_TEXT_CENTER): ChartText {
    return {
        colorIndex: dat[5],
        size: Math.max(dat[6], 6),
        text: convertBufferToString(dat.slice(7)),
        type,
        x: bytes_to_signed(dat[1], dat[2]),
        y: bytes_to_signed(dat[3], dat[4]),
    };
}

