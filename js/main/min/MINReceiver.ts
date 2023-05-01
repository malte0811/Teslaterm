import {CRCCalculator} from "./CRCCalculator";
import {HEADER_BYTE, MAX_PAYLOAD, STUFF_BYTE} from "./MINConstants";

enum RXState {
    SOF,
    ID_CONTROL,
    SEQ_3,
    SEQ_2,
    SEQ_1,
    SEQ_0,
    LENGTH,
    PAYLOAD,
    CRC_3,
    CRC_2,
    CRC_1,
    CRC_0,
    EOF,
}

export interface ReceivedMINFrame {
    id_control: number;
    seq: number;
    payload: number[];
}

class ReceivingMinFrame {
    public payload_bytes: number;      // Length of payload received so far
    public id_control: number;         // ID and control bit of frame being received
    public seq: number;				// Sequence number of frame being received
    public length: number;			// Length of frame
    public payload: number[];
    public checksum: number;

    constructor() {
        this.checksum = 0;
        this.id_control = 0;
        this.length = 0;
        this.payload = [];
        this.payload_bytes = 0;
        this.seq = 0;
    }
}

export class MINReceiver {
    private frame: ReceivingMinFrame;
    private header_bytes_seen: number;
    private frameState: RXState;
    private readonly crc: CRCCalculator = new CRCCalculator();

    public constructor() {
        this.frame = new ReceivingMinFrame();
        this.frameState = RXState.SOF;
        this.header_bytes_seen = 0;
    }

    public isAtSOF() {
        return this.frameState === RXState.SOF;
    }

    public receiveByte(byte: number): ReceivedMINFrame | undefined {
        // Regardless of state, three header bytes means "start of frame" and
        // should reset the frame buffer and be ready to receive frame data
        //
        // Two in a row in over the frame means to expect a stuff byte.
        if (this.header_bytes_seen === 2) {
            this.header_bytes_seen = 0;
            if (byte === HEADER_BYTE) {
                this.frameState = RXState.ID_CONTROL;
                return;
            }
            if (byte === STUFF_BYTE) {
                /* Discard this byte; carry on receiving on the next character */
                return;
            } else {
                /* Something has gone wrong, give up on this frame and look for header again */
                this.frameState = RXState.SOF;
                return;
            }
        }

        if (byte === HEADER_BYTE) {
            this.header_bytes_seen++;

        } else {
            this.header_bytes_seen = 0;
        }

        switch (this.frameState) {
            case RXState.SOF:
                break;
            case RXState.ID_CONTROL:
                this.frame.id_control = byte;
                this.frame.payload_bytes = 0;
                this.crc.init();
                this.crc.step(byte);
                if (byte & 0x80) {
                    this.frameState = RXState.SEQ_3;
                } else {
                    this.frame.seq = 0;
                    this.frameState = RXState.LENGTH;
                }
                break;
            case RXState.SEQ_3:
                this.frame.seq = byte << 24;
                this.crc.step(byte);
                this.frameState = RXState.SEQ_2;
                break;
            case RXState.SEQ_2:
                this.frame.seq |= byte << 16;
                this.crc.step(byte);
                this.frameState = RXState.SEQ_1;
                break;
            case RXState.SEQ_1:
                this.frame.seq |= byte << 8;
                this.crc.step(byte);
                this.frameState = RXState.SEQ_0;
                break;
            case RXState.SEQ_0:
                this.frame.seq |= byte;
                this.crc.step(byte);
                this.frameState = RXState.LENGTH;
                break;
            case RXState.LENGTH:
                this.frame.payload = [];
                this.frame.length = byte;
                this.crc.step(byte);
                if (this.frame.length > 0) {
                    if (this.frame.length <= MAX_PAYLOAD) {
                        this.frameState = RXState.PAYLOAD;
                    } else {
                        // Frame dropped because it's longer than any frame we can buffer
                        this.frameState = RXState.SOF;
                    }
                } else {
                    this.frameState = RXState.CRC_3;
                }
                break;
            case RXState.PAYLOAD:
                this.frame.payload[this.frame.payload_bytes++] = byte;
                this.crc.step(byte);
                if (--this.frame.length === 0) {
                    this.frameState = RXState.CRC_3;
                }
                break;
            case RXState.CRC_3:
                this.frame.checksum = byte << 24;
                this.frameState = RXState.CRC_2;
                break;
            case RXState.CRC_2:
                this.frame.checksum |= byte << 16;
                this.frameState = RXState.CRC_1;
                break;
            case RXState.CRC_1:
                this.frame.checksum |= byte << 8;
                this.frameState = RXState.CRC_0;
                break;
            case RXState.CRC_0: {
                this.frame.checksum |= byte;
                const crc = this.crc.getValue();
                if (crc !== this.frame.checksum) {
                    // Frame fails the checksum and so is dropped
                    this.frameState = RXState.SOF;
                } else {
                    // Checksum passes, go on to check for the end-of-frame marker
                    this.frameState = RXState.EOF;
                }
                break;
            }
            case RXState.EOF:
                let finishedFrame: ReceivedMINFrame;
                if (byte === 0x55) {
                    // Frame received OK, pass up data to handler
                    finishedFrame = {
                        id_control: this.frame.id_control,
                        payload: this.frame.payload,
                        seq: this.frame.seq,
                    };
                    this.frame = new ReceivingMinFrame();
                }
                // else discard
                // Look for next frame */
                this.frameState = RXState.SOF;
                return finishedFrame;
            default:
                // Should never get here but in case we do then reset to a safe state
                this.frameState = RXState.SOF;
                break;
        }
    }
}

