import * as fs from "fs";

export enum Endianness {
    LITTLE_ENDIAN,
    BIG_ENDIAN,
}

export function bytes_to_signed(lsb: number, msb: number): number {
    const sign = msb & (1 << 7);
    const x = (((msb & 0xFF) << 8) | (lsb & 0xFF));
    if (sign) {
        return (0xFFFF0000 | x);  // fill in most significant bits with 1's
    } else {
        return x;
    }
}

export function to_ud3_time_number(time_us: number, timebase: number, direction: "up" | "down"): number {
    const activeBits = 0xFF_FF_FF_FF;
    const time_ticks = Math.floor(time_us / timebase);
    const baseTime = time_ticks & activeBits;
    if (direction == "down") {
        return (0x1_00_00_00_00 - baseTime) & activeBits;
    } else {
        return baseTime;
    }
}

export function to_ud3_time(time_us: number, timebase: number, direction: "up" | "down", end: Endianness): number[] {
    return to_32_bit_bytes(to_ud3_time_number(time_us, timebase, direction), end);
}

export function to_32_bit_bytes(num: number, end: Endianness): number[] {
    const bigEndian = [
        (num >> 24) & 0xff,
        (num >> 16) & 0xff,
        (num >> 8) & 0xff,
        (num >> 0) & 0xff,
    ];
    if (end === Endianness.LITTLE_ENDIAN) {
        return bigEndian.reverse();
    } else {
        return bigEndian;
    }
}

export function from_32_bit_bytes(bytes: number[], end: Endianness): number {
    if (end === Endianness.BIG_ENDIAN) {
        bytes = bytes.reverse();
    }
    return bytes[3] << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0];
}

export function convertBufferToString(buf: number[] | Buffer | Uint8Array, uri: boolean = true): string {
    return convertBufferToStringImpl(buf, uri, buf.length);
}

export function convertArrayBufferToString(buf: ArrayBuffer, uri: boolean = true): string {
    return convertBufferToStringImpl(buf, uri, buf.byteLength);
}

function convertBufferToStringImpl(buf: number[] | Buffer | Uint8Array | ArrayBuffer, uri: boolean = true, length: number): string {
    let firstNull = 0;
    while (firstNull < length && buf[firstNull] !== 0) {
        ++firstNull;
    }
    const bufView = new Uint8Array(buf).slice(0, firstNull);
    const encodedString = String.fromCharCode.apply(null, bufView);
    if (uri) {
        return decodeURIComponent(encodedString);
    } else {
        return encodedString;
    }
}

export function convertStringToArrayBuffer(str: string): ArrayBuffer {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

export async function readFileAsync(file: fs.PathLike): Promise<Uint8Array> {
    return new Promise<Uint8Array>((res, rej) => {
        fs.readFile(file, (err, data) => {
            if (err) {
                rej(err);
            } else {
                res(data);
            }
        });
    });
}

export async function withTimeout<T>(base: Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((res, rej) => {
        setTimeout(rej, timeout);
        base.then(res);
    });
}

export async function sleep(delay: number): Promise<void> {
    return new Promise<void>((res, rej) => {
        setTimeout(res, delay);
    });
}
