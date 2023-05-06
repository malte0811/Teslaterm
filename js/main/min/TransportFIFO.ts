import {MIN_DEBUG, TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS, TRANSPORT_MAX_WINDOW_SIZE} from "./MINConstants";
import {MINFrameBuilder} from "./MINFrameBuilder";

export class SendingMinFrame {
    public payload: number[];
    public resolve: () => any;
    public reject: (error) => any;
    public min_id: number;
    public last_send: number;
    public seq?: number;

    constructor(payload: number[], resolve: () => any, reject: (error) => any, min_id: number, last_send: number) {
        this.payload = payload;
        this.resolve = resolve;
        this.reject = reject;
        this.min_id = min_id;
        this.last_send = last_send;
    }

    public canSend(remoteRXSpace: number) {
        return MINFrameBuilder.getPacketSize(this.payload.length) < remoteRXSpace;
    }
}

export class TransportFifo {
    public sn_min: number = 0;
    public sn_max: number = 0;
    public last_sent_ack_time_ms: number = 0;
    public last_sent_seq: number = -1;
    public last_sent_seq_cnt: number = 0;
    public last_received_anything_ms: number = Date.now();
    public last_received_frame_ms: number = 0;
    public frames: SendingMinFrame[] = [];

    // Debug counter
    private dropped_frames: number = 0;

    public enqueueFrame(min_id: number, payload: number[] | Buffer) {
        return new Promise<void>((res, rej) => {
            // We are just queueing here: the poll() function puts the frame into the window and on to the wire
            if (this.frames.length < TRANSPORT_MAX_WINDOW_SIZE) {
                // Copy frame details into frame slot, copy payload into ring buffer
                this.frames.push(new SendingMinFrame(Array.from(payload), res, rej, min_id & 0x3f, Date.now()));
                if (MIN_DEBUG) { console.log("Queued ID=" + min_id + " len=" + payload.length); }
            } else {
                this.dropped_frames++;
                rej("Max fifo size exceeded");
            }
        });
    }

    public reset() {
        // Clear down the transmission FIFO queue
        this.sn_max = 0;
        this.sn_min = 0;

        // Reset the timers
        this.last_sent_ack_time_ms = this.last_received_anything_ms = Date.now();
        this.last_received_frame_ms = 0;

        console.log("Resetting min FIFO");
        for (const frame of this.frames) {
            frame.reject("Resetting min FIFO");
        }
        this.frames = [];
        this.last_sent_seq = -1;
        this.last_sent_seq_cnt = 0;
    }

    public nextSequentialFrame(bufferIndex: number, remoteRXSpace: number) {
        if (this.frames.length <= bufferIndex) {
            return undefined;
        }
        const nextFrame = this.frames[bufferIndex];
        if (!nextFrame.canSend(remoteRXSpace)) {
            return undefined;
        }
        nextFrame.seq = this.sn_max;
        this.last_sent_seq = this.sn_max;
        nextFrame.last_send = Date.now();
        this.sn_max++;
        return nextFrame;
    }

    public getFrameToReSend(remoteRXSpace: number) {
        let oldest = Number.POSITIVE_INFINITY;
        let frameToResend: SendingMinFrame | undefined;
        for (const frame of this.frames) {
            if (frame.last_send < oldest) {
                frameToResend = frame;
                oldest = frame.last_send;
            }
        }
        const sinceLast = Date.now() - frameToResend.last_send;
        if (sinceLast >= TRANSPORT_FRAME_RETRANSMIT_TIMEOUT_MS && frameToResend.canSend(remoteRXSpace)) {
            return frameToResend;
        } else {
            return undefined;
        }
    }

    public pollResend(frame: SendingMinFrame) {
        if (frame.seq === this.last_sent_seq) {
            this.last_sent_seq_cnt++;
            if (this.last_sent_seq_cnt > 10) {
                return false;
            }
        } else {
            this.last_sent_seq_cnt = 0;
            this.last_sent_seq = frame.seq;
        }
        frame.last_send = Date.now();
        return true;
    }

    public markAckedUpTo(minNonAcked: number) {
        this.sn_min = minNonAcked;
        while (this.frames.length > 0 && this.frames[0].seq < minNonAcked) {
            const last_pop = this.frames.shift();
            last_pop.resolve();
            if (MIN_DEBUG) {
                console.log(`Popping frame id=${last_pop.min_id} seq=${last_pop.seq}`);
            }
        }
    }
}
