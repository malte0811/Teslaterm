import {ACK_BYTE, RESET} from "./MINConstants";
import {MINFrameBuilder} from "./MINFrameBuilder";
import {MINReceiver, ReceivedMINFrame} from "./MINReceiver";

export type MinAckPayloadGetter = () => number[];
export type MinByteSender = (data: number[]) => any;
export type MinHandler = (id: number, payload: number[]) => any;

const TRANSPORT_IDLE_TIMEOUT_MS = 1000;
const TRANSPORT_MAX_WINDOW_SIZE = 16;
const TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS = 25;
const TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS = 50;

interface SendingMinFrame {
    payload: number[];
    resolve: () => any;
    reject: (error) => any;
    min_id: number;
    last_send: number;
    seq?: number;
}

interface TransportFifo {
    // Counters are for diagnosis purposes
    spurious_acks: number;
    sequence_mismatch_drop: number;
    sequential_sequence_mismatch_drop: number;
    dropped_frames: number;
    resets_received: number;
    sn_min: number;
    sn_max: number;
    rn: number;
    last_sent_ack_time_ms: number;
    last_sent_seq: number;
    last_sent_seq_cnt: number;
    last_received_anything_ms: number;
    last_received_frame_ms: number;

    frames: SendingMinFrame[];
}

export class MINTransceiver {
    private readonly sendByte: MinByteSender;
    private readonly handler: MinHandler;
    private readonly get_ack_payload: MinAckPayloadGetter;

    private readonly rx: MINReceiver;
    private readonly rx_space: number;
    private remote_rx_space: number;
    private readonly transport_fifo: TransportFifo;
    private now: number;
    private readonly debug: boolean;

    constructor(get_ack_payload: MinAckPayloadGetter, sendByte: MinByteSender, handler: MinHandler) {
        this.get_ack_payload = get_ack_payload;
        this.rx = new MINReceiver();

        this.rx_space = 512;

        this.remote_rx_space = 512;

        this.transport_fifo = {
            dropped_frames: 0,
            frames: [],
            last_received_anything_ms: Date.now(),
            last_received_frame_ms: 0,
            last_sent_ack_time_ms: 0,
            last_sent_seq: -1,
            last_sent_seq_cnt: 0,
            resets_received: 0,
            rn: 0,
            sequence_mismatch_drop: 0,
            sequential_sequence_mismatch_drop: 0,
            sn_max: 0,
            sn_min: 0,
            spurious_acks: 0,
        };

        this.sendByte = sendByte;
        this.handler = handler;

        this.now = Date.now();
        this.debug = false;
    }

    public enqueueFrame(min_id: number, payload: number[] | Buffer) {
        return new Promise<void>((res, rej) => {
            // We are just queueing here: the poll() function puts the frame into the window and on to the wire
            if (this.transport_fifo.frames.length < TRANSPORT_MAX_WINDOW_SIZE) {
                // Copy frame details into frame slot, copy payload into ring buffer
                this.transport_fifo.frames.push({
                    last_send: Date.now(),
                    min_id: min_id & 0x3f,
                    payload: Array.from(payload),
                    reject: rej,
                    resolve: res,
                });
                if (this.debug) { console.log("Queued ID=" + min_id + " len=" + payload.length); }
            } else {
                this.transport_fifo.dropped_frames++;
                rej("Max fifo size exceeded");
            }
        });
    }

    public get_relative_fifo_size() {
        return this.transport_fifo.frames.length / TRANSPORT_MAX_WINDOW_SIZE;
    }

    public min_poll(buf?: Buffer) {
        if (buf) {
            for (const byte of buf) {
                const frame = this.rx.receiveByte(byte);
                if (frame) {
                    this.valid_frame_received(frame);
                }
            }
        }

        if (this.rx.isAtSOF()) {
            this.now = Date.now();

            const sinceAnyReceive = this.now - this.transport_fifo.last_received_anything_ms;
            const sinceFrameReceive = this.now - this.transport_fifo.last_received_frame_ms;
            const remote_connected = sinceAnyReceive < TRANSPORT_IDLE_TIMEOUT_MS;
            const remote_active = sinceFrameReceive < TRANSPORT_IDLE_TIMEOUT_MS;

            if (!remote_connected) { this.min_transport_reset(true); }

            // This sends one new frame or resends one old frame

            const window_size = this.transport_fifo.sn_max - this.transport_fifo.sn_min; // Window size
            if ((window_size < TRANSPORT_MAX_WINDOW_SIZE) && (this.transport_fifo.frames.length > window_size)) {
                if (this.transport_fifo.frames.length) {
                    const wire_size = MINFrameBuilder.getPacketSize(
                        this.transport_fifo.frames[window_size].payload.length,
                    );
                    if (wire_size < this.remote_rx_space) {
                        this.transport_fifo.frames[window_size].seq = this.transport_fifo.sn_max;
                        this.transport_fifo.last_sent_seq = this.transport_fifo.sn_max;
                        this.transport_fifo.frames[window_size].last_send = this.now;
                        if (this.debug) { console.log("tx frame seq=" + this.transport_fifo.frames[window_size].seq); }
                        this.sendFrame(
                            this.transport_fifo.frames[window_size].min_id | 0x80,
                            this.transport_fifo.frames[window_size].seq,
                            this.transport_fifo.frames[window_size].payload,
                        );
                        this.transport_fifo.sn_max++;
                    }
                }
                // There are new frames we can send; but don't even bother if there's no buffer space for them

            } else {
                // Sender cannot send new frames so resend old ones (if there's anyone there)
                if ((window_size > 0) && remote_connected) {
                    // There are unacknowledged frames. Can re-send an old frame. Pick the least recently sent one.

                    let oldest = Number.POSITIVE_INFINITY;
                    let resend_frame_num = -1;
                    for (let i = 0; i < this.transport_fifo.frames.length; i++) {
                        if (this.transport_fifo.frames[i].last_send < oldest) {
                            resend_frame_num = i;
                            oldest = this.transport_fifo.frames[i].last_send;
                        }
                    }
                    const frameToSend = this.transport_fifo.frames[resend_frame_num];
                    const sinceLast = this.now - frameToSend.last_send;
                    if (resend_frame_num > -1 && sinceLast >= TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS) {
                        const wire_size = MINFrameBuilder.getPacketSize(frameToSend.payload.length);
                        if (wire_size < this.remote_rx_space) {
                            if (this.debug) { console.log("tx olfFrame seq=" + frameToSend.seq); }
                            if (frameToSend.seq === this.transport_fifo.last_sent_seq) {
                                this.transport_fifo.last_sent_seq_cnt++;
                            } else {
                                this.transport_fifo.last_sent_seq_cnt = 0;
                            }
                            this.transport_fifo.last_sent_seq = frameToSend.seq;
                            if (this.transport_fifo.last_sent_seq_cnt > 10) {
                                this.min_transport_reset(true);
                                this.transport_fifo.last_sent_seq_cnt = 0;
                            } else {
                                this.sendFrame(frameToSend.min_id | 0x80, frameToSend.seq, frameToSend.payload);
                                frameToSend.last_send = this.now;
                            }
                        }
                    }

                }


                // Periodically transmit the ACK with the rn value, unless the line has gone idle
                if (this.now - this.transport_fifo.last_sent_ack_time_ms > TRANSPORT_ACK_RETRANSMIT_TIMEOUT_MS) {
                    if (remote_active) {
                        this.send_ack();
                    }
                }
            }
        }
    }

    private valid_frame_received(frame: ReceivedMINFrame) {
        const seq = frame.seq;
        // When we receive anything we know the other end is still active and won't shut down
        this.transport_fifo.last_received_anything_ms = this.now;

        switch (frame.id_control) {
            case ACK_BYTE: {
                // If we get an ACK then we remove all the acknowledged frames with seq < rn
                // The payload byte specifies the number of NACKed frames: how many we want retransmitted because
                // they have gone missing.
                // But we need to make sure we don't accidentally ACK too many because of a stale ACK from an old
                // session
                const num_acked = seq - this.transport_fifo.sn_min;
                let num_nacked = (frame.payload[0] << 24);
                num_nacked |= (frame.payload[1] << 16);
                num_nacked |= (frame.payload[2] << 8);
                num_nacked |= (frame.payload[3]);
                num_nacked -= seq;
                const num_in_window = this.transport_fifo.sn_max - this.transport_fifo.sn_min;

                this.remote_rx_space = (frame.payload[4] << 24);
                this.remote_rx_space |= (frame.payload[5] << 16);
                this.remote_rx_space |= (frame.payload[6] << 8);
                this.remote_rx_space |= (frame.payload[7]);

                if (num_acked <= num_in_window) {
                    this.transport_fifo.sn_min = seq;

                    // Now pop off all the frames up to (but not including) rn
                    // The ACK contains Rn; all frames before Rn are ACKed and can be removed from the window
                    if (this.debug && (num_acked !== 0)) {
                        console.log(((num_acked === 0) ? "Retransmitted Ack: seq=" : "Received ACK seq=") + seq + ", num_acked=" + num_acked + ", num_nacked=" + num_nacked);
                    }
                    for (let i = 0; i < num_acked; i++) {
                        const last_pop = this.transport_fifo.frames.shift();
                        if (last_pop) { last_pop.resolve(); }
                        if (this.debug) { console.log("Popping frame id=" + last_pop.min_id + " seq=" + last_pop.seq); }
                    }
                    // Now retransmit the number of frames that were requested
                    for (let i = 0; i < num_nacked; i++) {
                        const wire_size = MINFrameBuilder.getPacketSize(this.transport_fifo.frames[i].payload.length);
                        if (wire_size >= this.remote_rx_space) {
                            break;
                        }
                        this.transport_fifo.frames[i].last_send = this.now;
                        this.sendFrame(
                            this.transport_fifo.frames[i].min_id | 0x80,
                            this.transport_fifo.frames[i].seq,
                            this.transport_fifo.frames[i].payload,
                        );
                        this.transport_fifo.sn_max++;
                    }
                } else {
                    if (this.debug) { console.log("Received spurious ACK seq=" + seq); }
                    this.transport_fifo.spurious_acks++;
                }
                break;
            }
            case RESET:
                // If we get a RESET demand then we reset the transport protocol (empty the FIFO, reset the
                // sequence numbers, etc.)
                // We don't send anything, we just do it. The other end can send frames to see if this end is
                // alive (pings, etc.) or just wait to get application frames.
                this.transport_fifo.resets_received++;
                this.transport_fifo_reset();
                console.log("min reset");
                break;
            default:
                if (frame.id_control & 0x80) {
                    // Incoming application frames

                    // Reset the activity time (an idle connection will be stalled)
                    this.transport_fifo.last_received_frame_ms = this.now;

                    if (seq === this.transport_fifo.rn) {
                        // Accept this frame as matching the sequence number we were looking for

                        // Now looking for the next one in the sequence
                        this.transport_fifo.rn++;

                        this.transport_fifo.sequential_sequence_mismatch_drop = 0;

                        if (this.debug) {
                            console.log("Incoming app frame seq=" + frame.seq + ", id=" + (frame.id_control & 0x3f) + ", payload len=" + frame.payload.length);
                        }


                        if (this.debug) { console.log("send ACK: seq=" + this.transport_fifo.rn); }
                        // Always send an ACK back for the frame we received
                        // ACKs are short (should be about 9 microseconds to send on the wire) and
                        // this will cut the latency down.
                        // We also periodically send an ACK in case the ACK was lost, and in any case
                        // frames are re-sent.
                        this.send_ack();

                        // Now ready to pass this up to the application handlers
                        this.handler(frame.id_control & 0x3f, frame.payload);
                        // Pass frame up to application handler to deal with
                    } else {
                        // Discard this frame because we aren't looking for it: it's either a dupe because it was
                        // retransmitted when our ACK didn't get through in time, or else it's further on in the
                        // sequence and others got dropped.
                        this.transport_fifo.sequence_mismatch_drop++;
                        if (this.debug) { console.log('Mismatch seq=' + seq + 'rn=' + this.transport_fifo.rn); }

                        // check if we are lagging behind for some reason, but give the UD3 a few chances to re-transmit
                        // other frames
                        if (seq > this.transport_fifo.rn) {
                            if (this.debug) {
                                console.log("UD3 left us behind... didn't ack but got new package (" +
                                    this.transport_fifo.sequential_sequence_mismatch_drop + ")");
                            }
                            if (this.transport_fifo.sequential_sequence_mismatch_drop > 10) {
                                this.transport_fifo.sequential_sequence_mismatch_drop = 0;
                                this.min_transport_reset(true);
                                console.log("min fifo reset! (too many sequential mismatches)");
                            } else {
                                this.transport_fifo.sequential_sequence_mismatch_drop++;
                            }
                        }
                    }
                } else {
                    // Not a transport frame
                    this.handler(frame.id_control & 0x3f, frame.payload);
                }
                break;
        }

    }

    private send_reset() {
        if (this.debug) { console.log("send RESET"); }
        this.sendFrame(RESET, 0, []);
    }

    private send_ack() {
        // In the embedded end we don't reassemble out-of-order frames and so never ask for retransmits. Payload is
        // always the same as the sequence number.
        let sq = [
            (this.transport_fifo.rn >>> 24) & 0xff,
            (this.transport_fifo.rn >>> 16) & 0xff,
            (this.transport_fifo.rn >>> 8) & 0xff,
            this.transport_fifo.rn & 0xff,
            (this.rx_space >>> 24) & 0xff,
            (this.rx_space >>> 16) & 0xff,
            (this.rx_space >>> 8) & 0xff,
            this.rx_space & 0xff,
        ];
        sq = sq.concat(this.get_ack_payload());
        this.sendFrame(ACK_BYTE, this.transport_fifo.rn, sq);
        this.transport_fifo.last_sent_ack_time_ms = Date.now();
    }


    private min_transport_reset(inform_other_side: boolean) {
        if (inform_other_side) {
            // Tell the other end we have gone away
            this.send_reset();
        }

        // Throw our frames away
        this.transport_fifo_reset();
    }

    private transport_fifo_reset() {
        // Clear down the transmission FIFO queue
        this.transport_fifo.sn_max = 0;
        this.transport_fifo.sn_min = 0;
        this.transport_fifo.rn = 0;

        // Reset the timers
        this.transport_fifo.last_received_anything_ms = this.now;
        this.transport_fifo.last_sent_ack_time_ms = this.now;
        this.transport_fifo.last_received_frame_ms = 0;

        console.log("Resetting min FIFO");
        for (const frame of this.transport_fifo.frames) {
            frame.reject("Resetting min FIFO");
        }
        this.transport_fifo.frames = [];
        this.transport_fifo.last_sent_seq = -1;
        this.transport_fifo.last_sent_seq_cnt = 0;
    }

    private sendFrame(id_control: number, seq: number, payload: number[]) {
        this.sendByte(new MINFrameBuilder(id_control, seq, payload).getBytes());
    }
}
