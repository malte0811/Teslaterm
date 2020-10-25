import {SynthType} from "../../../common/CommonTypes";
import {FEATURE_MINSID, FEATURE_NOTELEMETRY} from "../../../common/constants";
import {convertBufferToString, withTimeout} from "../../helper";
import {config} from "../../init";
import * as microtime from "../../microtime";
import {ISidConnection} from "../../sid/ISidConnection";
import {FormatVersion, UD3FormattedConnection} from "../../sid/UD3FormattedConnection";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {TerminalHandle} from "./UD3Connection";
import minprot = require('../../../../libs/min');

const MIN_ID_WD = 10;
const MIN_ID_MEDIA = 20;
const MIN_ID_SID = 21;
const MIN_ID_SOCKET = 13;
const MIN_ID_SYNTH = 14;
const MIN_ID_FEATURE = 15;
const MIN_ID_DEBUG = 42;

const SYNTH_CMD_FLUSH = 0x01;
const SYNTH_CMD_SID = 0x02;
const SYNTH_CMD_MIDI = 0x03;
const SYNTH_CMD_OFF = 0x04;

export abstract class MinConnection extends BootloadableConnection {
    private min_wrapper: minprot | undefined;
    private readonly sidConnection: UD3FormattedConnection;
    private mediaFramesForBatching: Buffer[] = [];
    private mediaFramesForBatchingSID: Buffer[] = [];
    private actualUDFeatures: Map<string, string>;
    private connectionsToSetTTerm: TerminalHandle[] = [];

    protected constructor() {
        super();
        this.sidConnection = new UD3FormattedConnection(
            () => this.flushSynth(),
            (data) => this.sendMedia(data)
        );
        this.actualUDFeatures = new Map(config.defaultUDFeatures.entries());
    }

    public async connect(): Promise<void> {
        this.registerListener(data => {
            if (this.isBootloading()) {
                this.bootloaderCallback(data);
            } else {
                this.min_wrapper.min_poll(data);
            }
        });
        await this.init_min_wrapper();
    }

    public async disconnect() {
        try {
            let toDisconnect = [];
            for (const [id, handler] of this.terminalCallbacks) {
                if (handler.active) {
                    toDisconnect[toDisconnect.length] = id;
                }
            }
            for (const id of toDisconnect) {
                this.closeTerminal(id);
            }
        } catch (e) {
            console.error("Failed to disconnect cleanly", e);
        }
        this.terminalCallbacks.clear();
    }

    async sendMedia(data: Buffer) {
        if (this.min_wrapper) {
            this.mediaFramesForBatching.push(data);
        }
    }

    async sendMediaSID(data: Buffer) {
        if (this.min_wrapper) {
            this.mediaFramesForBatchingSID.push(data);
        }
    }

    sendMidi = this.sendMedia;

    getSidConnection(): ISidConnection {
        return this.sidConnection;
    }

    public async sendTelnet(data: Buffer, handle: TerminalHandle) {
        if (this.min_wrapper) {
            await this.min_wrapper.min_queue_frame(handle, data);
        }
    }

    async closeTerminal(handle: TerminalHandle): Promise<void> {
        await withTimeout(this.send_min_socket(false, handle), 500);
        await super.closeTerminal(handle);
    }

    async startTerminal(handle: TerminalHandle): Promise<void> {
        await super.startTerminal(handle);
        await this.send_min_socket(true, handle);
        if (this.getFeatureValue(FEATURE_NOTELEMETRY) !== "1") {
            this.connectionsToSetTTerm.push(handle);
        }
        if (this.getFeatureValue(FEATURE_MINSID) === "1") {
            this.sidConnection.switch_format(FormatVersion.v2);
            this.sidConnection.sendToUD = (data) => this.sendMediaSID(data);
        } else {
            this.sidConnection.switch_format(FormatVersion.v1);
            this.sidConnection.sendToUD = (data) => this.sendMedia(data);
        }
    }

    public sendBootloaderData(data: Buffer): Promise<void> {
        return new Promise<void>((res, rej) => {
            this.send(data, (err) => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        });
    }

    public enterBootloaderMode(dataCallback: (data: Buffer) => void): void {
        super.enterBootloaderMode(dataCallback);
        this.min_wrapper = undefined;
    }

    public leaveBootloaderMode(): void {
        super.leaveBootloaderMode();
        this.init_min_wrapper();
    }

    public resetWatchdog(): void {
        if (this.min_wrapper) {
            this.min_wrapper.min_queue_frame(MIN_ID_WD, []);
        }
    }

    private batchFrames(buf: Buffer[], maxPerFrame: number, insertFrameCnt: boolean, minID: number) {
        while (this.min_wrapper.get_relative_fifo_size() < 0.75 && buf.length > 0) {
            let frameParts: Buffer[] = [];
            let currentSize = 0;
            while (
                buf.length > 0 &&
                buf[0].length + currentSize <= maxPerFrame
                ) {
                currentSize += buf[0].length;
                frameParts.push(buf.shift());
            }
            if (insertFrameCnt) {
                frameParts.unshift(Buffer.from([frameParts.length]));
            }
            let frame = Buffer.concat(frameParts);
            this.min_wrapper.min_queue_frame(minID, frame).catch(err => {
                console.log("Failed to send media packet: " + err);
            });
        }
    }

    public async tick(): Promise<void> {
        if (this.min_wrapper) {
            const maxPerFrame = 200;

            this.batchFrames(this.mediaFramesForBatching, maxPerFrame, false, MIN_ID_MEDIA);
            this.batchFrames(this.mediaFramesForBatchingSID, maxPerFrame, true, MIN_ID_SID);
            this.min_wrapper.min_poll();
        }
    }

    public async send_min_socket(connect: boolean, id: TerminalHandle) {
        if (this.min_wrapper) {
            const infoBuffer = Buffer.from(
                String.fromCharCode(id) +
                String.fromCharCode(connect ? 1 : 0) +
                "TT socket" +
                String.fromCharCode(0),
                'utf-8');
            let done = false;
            let tries = 0;
            while (!done && this.min_wrapper && tries < 16) {
                try {
                    await this.min_wrapper.min_queue_frame(MIN_ID_SOCKET, infoBuffer);
                    done = true;
                } catch (e) {
                    console.error(e);
                }
                ++tries;
            }
        }
    }

    public async init_min_wrapper(): Promise<void> {
        this.min_wrapper = new minprot(() => this.toUD3Time(microtime.now()));
        this.min_wrapper.sendByte = (data) => {
            if (this.isBootloading()) {
                return;
            }
            this.send(data, (err) => {
                if (err) {
                    console.error("Error while sending data: ", err);
                }
            });
        };
        this.min_wrapper.handler = async (id, data) => {
            if (id === MIN_ID_MEDIA) {
                if (data[0] === 0x78) {
                    this.sidConnection.setBusy(true);
                } else if (data[0] === 0x6f) {
                    this.sidConnection.setBusy(false);
                } else {
                    console.error("Unexpected MEDIA MIN message");
                }
            } else if (id === MIN_ID_FEATURE) {
                const asString = convertBufferToString(data, false);
                const splitPoint = asString.indexOf("=");
                if (splitPoint >= 0) {
                    const value = asString.substring(splitPoint + 1);
                    const feature = asString.substring(0, splitPoint);
                    this.actualUDFeatures.set(feature, value);
                    if (feature === FEATURE_NOTELEMETRY && value === "1") {
                        for (const termID of this.connectionsToSetTTerm) {
                            if (this.terminalCallbacks.has(termID)) {
                                await this.sendTelnet(Buffer.from("\rtterm notelemetry\rcls\r"), termID);
                            }
                        }
                        this.connectionsToSetTTerm = [];
                    }
                }
            } else if (this.terminalCallbacks.has(id)) {
                this.terminalCallbacks.get(id).callback(Buffer.from(data));
            } else {
                console.warn("Unexpected MIN message at " + id + ": " + convertBufferToString(data));
            }
        };
    }

    public async flushSynth(): Promise<void> {
        if (this.min_wrapper) {
            await this.min_wrapper.min_queue_frame(MIN_ID_SYNTH, [SYNTH_CMD_FLUSH]);
        }
    }

    public async setSynthImpl(type: SynthType): Promise<void> {
        if (this.min_wrapper) {
            await this.min_wrapper.min_queue_frame(MIN_ID_SYNTH, [type]);
        }
    }

    getMaxTerminalID(): number {
        return 4;
    }

    isMultiTerminal(): boolean {
        return true;
    }

    getFeatureValue(feature: string): string {
        return this.actualUDFeatures.get(feature);
    }

    abstract send(data: Buffer | number[], onError: (err) => void): void;

    abstract registerListener(listener: (data: Buffer) => void): void;
}
