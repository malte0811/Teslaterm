import {convertBufferToString, Endianness, from_32_bit_bytes} from "../../helper";

export enum UD3MinIDs {
    WATCHDOG = 10,
    MEDIA = 20,
    SID = 21,
    SOCKET = 13,
    SYNTH = 14,
    FEATURE = 15,
    // TODO handle in flight recording
    EVENT = 40,
    VMS = 43,
}

export const SYNTH_CMD_FLUSH = 0x01;
export const EVENT_GET_INFO = 1;

export function parseEventInfo(fullMinPacket: number[]) {
    // https://github.com/Netzpfuscher/UD3/blob/892b8c25da2784e880c0c2617d417b14c3421ecd/common/ud3core/tasks/tsk_min.c#L216-L221
    // 1: ID, 1: struct_version, 2: Padding (FFS...), 2*4: unique_id
    const structVersionOffset = 1;
    const uniqueIdOffset = structVersionOffset + 1 + 2;
    const udNameOffset = uniqueIdOffset + 2 * 4;
    return {
        info: fullMinPacket[0],
        structVersion: fullMinPacket[structVersionOffset],
        udName: convertBufferToString(fullMinPacket.slice(1 + 1 + 2 + 2 * 4)),
        uniqueId: [
            from_32_bit_bytes(fullMinPacket.slice(uniqueIdOffset), Endianness.LITTLE_ENDIAN),
            from_32_bit_bytes(fullMinPacket.slice(uniqueIdOffset + 4), Endianness.LITTLE_ENDIAN),
        ],
    };
}
