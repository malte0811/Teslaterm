export const ACK_BYTE = 0xff;
export const EOF_BYTE = 0x55;
export const HEADER_BYTE = 0xaa;
export const RESET = 0xfe;
export const STUFF_BYTE = 0x55;

export const TRANSPORT_MAX_WINDOW_SIZE = 16;
export const TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS = 50;
export const MAX_PAYLOAD = 255;
export const MIN_DEBUG = false;
export const MIN_INJECT_ERRORS = false;

export function get4ByteBigEndian(data: number[], firstByteIndex: number) {
    return (data[firstByteIndex] << 24)
        | (data[firstByteIndex + 1] << 16)
        | (data[firstByteIndex + 2] << 8)
        | (data[firstByteIndex + 3]);
}

export function toBigEndianBytes(value: number) {
    return [
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ];
}

export function injectErrors(data: Buffer | number[]) {
    for (let i = 0; i < data.length; ++i) {
        const bitToModify = Math.floor(1000 * 8 * Math.random());
        if (bitToModify < 8) {
            data[i] ^= 1 << bitToModify;
            console.log("Injected error");
        }
    }
}
