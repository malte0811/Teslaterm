import {
    ACK_BYTE,
    get4ByteBigEndian, injectErrors,
    MIN_DEBUG, MIN_INJECT_ERRORS,
    RESET,
    toBigEndianBytes,
    TRANSPORT_MAX_WINDOW_SIZE,
} from "./MINConstants";
import {MINFrameBuilder} from "./MINFrameBuilder";
import {MINReceiver, ReceivedMINFrame} from "./MINReceiver";
import {TransportFifo} from "./TransportFIFO";

export type MinAckPayloadGetter = () => number[];
export type MinByteSender = (data: number[]) => any;
export type MinHandler = (id: number, payload: number[]) => any;

const TRANSPORT_IDLE_TIMEOUT_MS = 1000;
const TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS = 25;

export class MINTransceiver {
    private readonly sendBytesNow: MinByteSender;
    private readonly handler: MinHandler;
    private readonly get_ack_payload: MinAckPayloadGetter;

    private readonly rx: MINReceiver;
    private readonly rx_space: number;
    private remote_rx_space: number;
    private readonly transport_fifo: TransportFifo;
    private now: number;
    private nextReceiveSeq: number = 0;
    private sequentialSequenceMismatchDrop: number = 0;
    // Debug counters
    private sequenceMismatchDrop: number = 0;
    private spuriousACKs: number = 0;
    private resetsReceived: number = 0;
    private sendBuffer: number[];

    constructor(get_ack_payload: MinAckPayloadGetter, sendByte: MinByteSender, handler: MinHandler) {
        this.get_ack_payload = get_ack_payload;
        this.rx = new MINReceiver();

        this.rx_space = 512;
        this.remote_rx_space = 512;
        this.transport_fifo = new TransportFifo();

        this.sendBytesNow = sendByte;
        this.handler = handler;

        this.now = Date.now();
    }

    public enqueueFrame(min_id: number, payload: number[] | Buffer) {
        return this.transport_fifo.enqueueFrame(min_id, payload);
    }

    public get_relative_fifo_size() {
        return this.transport_fifo.frames.length / TRANSPORT_MAX_WINDOW_SIZE;
    }

    public onReceived(buf: Buffer) {
        if (MIN_INJECT_ERRORS) {
            injectErrors(buf);
        }
        for (const byte of buf) {
            const frame = this.rx.receiveByte(byte);
            if (frame) {
                this.valid_frame_received(frame);
            }
        }
    }

    public tick() {
        this.sendBuffer = [];
        this.now = Date.now();

        const sinceAnyReceive = this.now - this.transport_fifo.last_received_anything_ms;
        const sinceFrameReceive = this.now - this.transport_fifo.last_received_frame_ms;
        const remote_connected = sinceAnyReceive < TRANSPORT_IDLE_TIMEOUT_MS;
        const remote_active = sinceFrameReceive < TRANSPORT_IDLE_TIMEOUT_MS;

        if (!remote_connected) {
            this.resetTransport(true);
        }

        // This sends one new frame or resends one old frame

        const frame = this.transport_fifo.nextSequentialFrame(this.remote_rx_space);
        if (frame) {
            if (MIN_DEBUG) {
                console.log("tx frame seq=" + frame.seq);
            }
            this.sendFrame(frame.min_id | 0x80, frame.seq, frame.payload);
            // There are new frames we can send; but don't even bother if there's no buffer space for them
        } else if (remote_connected) {
            // Sender cannot send new frames so resend old ones (if there's anyone there)
            const frameToSend = this.transport_fifo.getFrameToReSend(this.remote_rx_space);
            if (frameToSend) {
                // There are unacknowledged frames. Can re-send an old frame. Pick the least recently sent one.
                if (MIN_DEBUG) {
                    console.log("tx olfFrame seq=" + frameToSend.seq);
                }
                if (this.transport_fifo.pollResend(frameToSend)) {
                    this.sendFrame(frameToSend.min_id | 0x80, frameToSend.seq, frameToSend.payload);
                } else {
                    this.resetTransport(true);
                }
            }
        }

        // Periodically transmit the ACK with the rn value, unless the line has gone idle
        const sinceLastSentAck = this.now - this.transport_fifo.last_sent_ack_time_ms;
        if (sinceLastSentAck > TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS && remote_active) {
            this.sendACK();
        }
        if (this.sendBuffer.length > 0) {
            this.sendBytesNow(this.sendBuffer);
        }
        this.sendBuffer = undefined;
    }

    private valid_frame_received(frame: ReceivedMINFrame) {
        // When we receive anything we know the other end is still active and won't shut down
        this.transport_fifo.last_received_anything_ms = this.now;

        switch (frame.id_control) {
            case ACK_BYTE:
                this.handleACKFrame(frame);
                break;
            case RESET:
                // If we get a RESET demand then we reset the transport protocol (empty the FIFO, reset the
                // sequence numbers, etc.)
                // We don't send anything, we just do it. The other end can send frames to see if this end is
                // alive (pings, etc.) or just wait to get application frames.
                this.resetsReceived++;
                this.resetTransport(false);
                console.log("remote min reset");
                break;
            default:
                if (frame.id_control & 0x80) {
                    this.handleApplicationFrame(frame);
                } else {
                    // Not a transport frame
                    this.handler(frame.id_control & 0x3f, frame.payload);
                }
                break;
        }
    }

    private handleACKFrame(frame: ReceivedMINFrame) {
        const seq = frame.seq;
        // If we get an ACK then we remove all the acknowledged frames with seq < rn
        // The payload byte specifies the number of NACKed frames: how many we want retransmitted because
        // they have gone missing.
        // But we need to make sure we don't accidentally ACK too many because of a stale ACK from an old
        // session
        const num_acked = seq - this.transport_fifo.sn_min;
        const num_nacked = get4ByteBigEndian(frame.payload, 0) - seq;
        const num_in_window = this.transport_fifo.sn_max - this.transport_fifo.sn_min;

        this.remote_rx_space = get4ByteBigEndian(frame.payload, 4);

        if (num_acked <= num_in_window) {
            // Now pop off all the frames up to (but not including) rn
            // The ACK contains Rn; all frames before Rn are ACKed and can be removed from the window
            if (MIN_DEBUG && (num_acked !== 0)) {
                console.log(`Received ACK seq=${seq}, num_acked=${num_acked}, num_nacked=${num_nacked}`);
            }
            this.transport_fifo.markAckedUpTo(seq);
            // Now retransmit the number of frames that were requested
            for (let i = 0; i < num_nacked; i++) {
                const nextFrame = this.transport_fifo.frames[i];
                if (!nextFrame.canSend(this.remote_rx_space)) {
                    break;
                }
                nextFrame.last_send = this.now;
                this.sendFrame(nextFrame.min_id | 0x80, nextFrame.seq, nextFrame.payload);
            }
        } else {
            if (MIN_DEBUG) {
                console.log("Received spurious ACK seq=" + seq);
            }
            this.spuriousACKs++;
        }
    }

    private handleApplicationFrame(frame: ReceivedMINFrame) {
        const seq = frame.seq;
        // Reset the activity time (an idle connection will be stalled)
        this.transport_fifo.last_received_frame_ms = this.now;

        if (seq === this.nextReceiveSeq) {
            // Accept this frame as matching the sequence number we were looking for
            // Now looking for the next one in the sequence
            this.nextReceiveSeq++;
            this.sequentialSequenceMismatchDrop = 0;
            if (MIN_DEBUG) {
                console.log(`Incoming app frame seq=${frame.seq}, id=${frame.id_control & 0x3f}, payload len=${frame.payload.length}`);
                console.log(`send ACK: seq=${this.nextReceiveSeq}`);
            }
            // Always send an ACK back for the frame we received
            // ACKs are short (should be about 9 microseconds to send on the wire) and
            // this will cut the latency down.
            // We also periodically send an ACK in case the ACK was lost, and in any case
            // frames are re-sent.
            this.sendACK();

            // Now ready to pass this up to the application handlers
            this.handler(frame.id_control & 0x3f, frame.payload);
            // Pass frame up to application handler to deal with
        } else {
            // Discard this frame because we aren't looking for it: it's either a dupe because it was
            // retransmitted when our ACK didn't get through in time, or else it's further on in the
            // sequence and others got dropped.
            this.sequenceMismatchDrop++;
            if (MIN_DEBUG) { console.log(`Mismatch seq=${seq}rn=${this.nextReceiveSeq}`); }

            // check if we are lagging behind for some reason, but give the UD3 a few chances to re-transmit
            // other frames
            if (seq > this.nextReceiveSeq) {
                if (MIN_DEBUG) {
                    console.log(`UD3 left us behind... didn't ack but got new package (${this.sequentialSequenceMismatchDrop})`);
                }
                if (this.sequentialSequenceMismatchDrop > 10) {
                    this.sequentialSequenceMismatchDrop = 0;
                    this.resetTransport(true);
                    console.log("min fifo reset! (too many sequential mismatches)");
                } else {
                    this.sequentialSequenceMismatchDrop++;
                }
            }
        }
    }

    private send_reset() {
        if (MIN_DEBUG) { console.log("send RESET"); }
        this.sendFrame(RESET, 0, []);
    }

    private sendACK() {
        // In the embedded end we don't reassemble out-of-order frames and so never ask for retransmits. Payload is
        // always the same as the sequence number.
        let sq = [
            ...toBigEndianBytes(this.nextReceiveSeq),
            ...toBigEndianBytes(this.rx_space),
        ];
        sq = sq.concat(this.get_ack_payload());
        this.sendFrame(ACK_BYTE, this.nextReceiveSeq, sq);
        this.transport_fifo.last_sent_ack_time_ms = Date.now();
    }


    private resetTransport(inform_other_side: boolean) {
        if (inform_other_side) {
            // Tell the other end we have gone away
            this.send_reset();
        }

        // Throw our frames away
        this.transport_fifo.reset();
        this.nextReceiveSeq = 0;
        this.sendBuffer = [];
    }

    private sendFrame(id_control: number, seq: number, payload: number[]) {
        const data = new MINFrameBuilder(id_control, seq, payload).getBytes();
        if (this.sendBuffer) {
            this.sendBuffer.push(...data);
        } else {
            this.sendBytesNow(data);
        }
    }
}
