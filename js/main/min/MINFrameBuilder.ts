import {CRCCalculator} from "./CRCCalculator";
import {EOF_BYTE, HEADER_BYTE, STUFF_BYTE, toBigEndianBytes} from "./MINConstants";

export class MINFrameBuilder {
    public static getPacketSize(payloadSize: number) {
        return payloadSize + 14;
    }

    private readonly crc: CRCCalculator = new CRCCalculator();
    private readonly buffer: number[] = [];
    private headerByteCountdown = 2;

    constructor(id_control: number, seq: number, payload: number[]) {
        // Header is 3 bytes; because unstuffed will reset receiver immediately
        this.buffer.push(HEADER_BYTE);
        this.buffer.push(HEADER_BYTE);
        this.buffer.push(HEADER_BYTE);

        this.addTXByte(id_control);
        if (id_control & 0x80) {
            // Send the sequence number if it is a transport frame
            this.add4ByteBigEndian(seq);
        }

        this.addTXByte(payload.length);
        for (const byte of payload) {
            this.addTXByte(byte);
        }
        this.add4ByteBigEndian(this.crc.getValue());

        // Ensure end-of-frame doesn't contain 0xaa and confuse search for start-of-frame
        this.buffer.push(EOF_BYTE);
    }

    public getBytes() {
        return this.buffer;
    }

    private add4ByteBigEndian(value: number) {
        for (const byte of toBigEndianBytes(value)) {
            this.addTXByte(byte);
        }
    }

    private addTXByte(byte: string | number) {
        // Transmit the byte
        if (typeof byte === "string") {
            byte = byte.charCodeAt(0);
        }
        this.buffer.push(byte);
        this.crc.step(byte);

        // See if an additional stuff byte is needed
        if (byte === HEADER_BYTE) {
            if (--this.headerByteCountdown === 0) {
                this.buffer.push(STUFF_BYTE);        // Stuff byte
                this.headerByteCountdown = 2;
            }
        } else {
            this.headerByteCountdown = 2;
        }
    }
}
