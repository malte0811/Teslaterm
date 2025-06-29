import {CoilID, DATA_NUM, DATA_TYPE, TelemetryEvent, UD3AlarmLevel, UNITS} from "../../../common/constants";
import {UD3Alarm, UD3ConfigOption, UD3ConfigType} from "../../../common/IPCConstantsToRenderer";
import {ChartText, TelemetryFrame} from "../../../common/TelemetryTypes";
import {bytes_to_signed, convertBufferToString, Endianness, from_32_bit_bytes} from "../../helper";
import {ipcs} from "../../ipc/IPCProvider";
import {getCoilCommands} from "../connection";
import {addAlarm} from "./Alarms";
import {updateStateFromTelemetry} from "./UD3State";

export type UD3ConfigConsumer = (cfg: UD3ConfigOption[]) => any;
let configRequestQueue: UD3ConfigConsumer[] = [];

export function requestConfig(coil: CoilID, out: UD3ConfigConsumer) {
    configRequestQueue.push(out);
    if (configRequestQueue.length === 1) {
        getCoilCommands(coil).sendCommand("config_get\r").catch((err) => console.error("While getting config:", err));
    }
}

let udconfig: UD3ConfigOption[] = [];

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
                    max: bytes_to_signed(this.data[4], this.data[5]),
                    meterId: num,
                    min: bytes_to_signed(this.data[2], this.data[3]),
                    name: convertBufferToString(this.data.slice(6)),
                    scale: 1,
                    type,
                };
            case TelemetryEvent.GAUGE32_CONF:
                return {
                    max: from_32_bit_bytes(this.data.slice(6, 10), Endianness.LITTLE_ENDIAN),
                    meterId: num,
                    min: from_32_bit_bytes(this.data.slice(2, 6), Endianness.LITTLE_ENDIAN),
                    name: convertBufferToString(this.data.slice(14)),
                    scale: from_32_bit_bytes(this.data.slice(10, 14), Endianness.LITTLE_ENDIAN),
                    type,
                };
            case TelemetryEvent.CHART32_CONF:
                return {
                    config: {
                        div: from_32_bit_bytes(this.data.slice(14, 18), Endianness.LITTLE_ENDIAN),
                        id: num,
                        max: from_32_bit_bytes(this.data.slice(6, 10), Endianness.LITTLE_ENDIAN),
                        min: from_32_bit_bytes(this.data.slice(2, 6), Endianness.LITTLE_ENDIAN),
                        name: convertBufferToString(this.data.slice(19)),
                        offset: from_32_bit_bytes(this.data.slice(10, 14), Endianness.LITTLE_ENDIAN),
                        unit: UNITS[this.data[18]],
                    },
                    type,
                };
            case TelemetryEvent.CHART_CONF:
                return {
                    config: {
                        div: 1,
                        id: num,
                        max: bytes_to_signed(this.data[4], this.data[5]),
                        min: bytes_to_signed(this.data[2], this.data[3]),
                        name: convertBufferToString(this.data.slice(9)),
                        offset: bytes_to_signed(this.data[6], this.data[7]),
                        unit: UNITS[this.data[8]],
                    },
                    type,
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

export function ud3ToTTAlarm(data: string): UD3Alarm {
    const [levelStr, timestampStr, message, valueStr] = data.split(';');
    const level = Number.parseInt(levelStr, 10) as UD3AlarmLevel;
    const timestamp = Number.parseInt(timestampStr, 10);
    const value = valueStr === 'NULL' ? undefined : Number.parseInt(valueStr, 10);
    return {message, value, level, timestamp};
}

export function sendTelemetryFrame(frame: TelemetryFrame, coil: CoilID, initializing: boolean) {
    switch (frame.type) {
        case TelemetryEvent.GAUGE32:
        case TelemetryEvent.GAUGE: {
            ipcs.meters(coil).setValue(frame.index, frame.value);
            break;
        }
        case TelemetryEvent.GAUGE32_CONF:
        case TelemetryEvent.GAUGE_CONF: {
            ipcs.meters(coil).configure(frame.meterId, frame.min, frame.max, frame.scale, frame.name);
            break;
        }
        case TelemetryEvent.CHART_CONF:
        case TelemetryEvent.CHART32_CONF: {
            const config = frame.config;
            ipcs.scope(coil).configure(
                config.id, config.min, config.max, config.offset, config.div, config.unit, config.name,
            );
            break;
        }
        case TelemetryEvent.CHART32:
        case TelemetryEvent.CHART: {
            ipcs.scope(coil).addValue(frame.index, frame.value);
            break;
        }
        case TelemetryEvent.CHART_DRAW: {
            ipcs.scope(coil).drawChart();
            break;
        }
        case TelemetryEvent.CHART_CLEAR: {
            ipcs.scope(coil).startControlledDraw(frame.title);
            break;
        }
        case TelemetryEvent.CHART_LINE: {
            ipcs.scope(coil).drawLine(frame.x1, frame.y1, frame.x2, frame.y2, frame.colorIndex);
            break;
        }
        case TelemetryEvent.CHART_TEXT_CENTER:
        case TelemetryEvent.CHART_TEXT: {
            const center = frame.type === TelemetryEvent.CHART_TEXT_CENTER;
            ipcs.scope(coil).drawText(frame.x, frame.y, frame.colorIndex, frame.size, frame.text, center);
            break;
        }
        case TelemetryEvent.STATE_SYNC: {
            updateStateFromTelemetry(coil, frame.packedState);
            if (frame.maxPw !== undefined) {
                ipcs.sliders(coil).setSliderRanges(frame.maxPw, frame.maxPrf).catch(
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
            addAlarm(coil, ud3ToTTAlarm(frame.data), initializing);
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

