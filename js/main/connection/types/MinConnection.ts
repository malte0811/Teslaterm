import {SynthType} from "../../../common/CommonTypes";
import {FEATURE_MINSID, FEATURE_NOTELEMETRY} from "../../../common/constants";
import {convertBufferToString, withTimeout} from "../../helper";
import {config} from "../../init";
import {ipcs} from "../../ipc/IPCProvider";
import * as microtime from "../../microtime";
import {MINTransceiver} from "../../min/MINTransceiver";
import {ISidConnection} from "../../sid/ISidConnection";
import {FormatVersion, UD3FormattedConnection} from "../../sid/UD3FormattedConnection";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {FlightEventType, getFlightRecorder} from "../flightrecorder/FlightRecorder";
import {TerminalHandle} from "./UD3Connection";
import {EVENT_GET_INFO, SYNTH_CMD_FLUSH, UD3MinIDs} from "./UD3MINConstants";

export abstract class MinConnection extends BootloadableConnection {
    private min_wrapper: MINTransceiver | undefined;
    private readonly sidConnection: UD3FormattedConnection;
    private mediaFramesForBatching: Buffer[] = [];
    private mediaFramesForBatchingSID: Buffer[] = [];
    private VMSFramesForBatching: Buffer[] = [];
    private actualUDFeatures: Map<string, string>;
    private connectionsToSetTTerm: TerminalHandle[] = [];
    private counter: number = 0;

    protected constructor() {
        super();
        this.sidConnection = new UD3FormattedConnection(
            () => this.flushSynth(),
            (data) => this.sendMedia(data),
        );
        this.actualUDFeatures = new Map(config.defaultUDFeatures.entries());
    }

    public async connect(): Promise<void> {
        this.registerListener(data => {
            getFlightRecorder().addEvent(FlightEventType.data_from_ud3, data);
            if (this.isBootloading()) {
                this.bootloaderCallback(data);
            } else {
                this.min_wrapper.onReceived(data);
            }
        });
        await this.init_min_wrapper();
        await this.repeatedlySendFrame(UD3MinIDs.EVENT, [EVENT_GET_INFO]);
    }

    public async sendDisconnectData() {
        try {
            const toDisconnect = [];
            for (const [id, handler] of this.terminalCallbacks) {
                if (handler.active) {
                    toDisconnect.push(id);
                }
            }
            for (const id of toDisconnect) {
                await this.closeTerminal(id).catch((e) => {
                    console.log("While disconnecting terminal id " + id + ":", e);
                });
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

    public async sendVMSFrames(data: Buffer) {
        if (this.min_wrapper) {
            this.VMSFramesForBatching.push(data);
        }
    }

    sendMidi = this.sendMedia;

    getSidConnection(): ISidConnection {
        return this.sidConnection;
    }

    public async sendTelnet(data: Buffer, handle: TerminalHandle) {
        if (this.min_wrapper) {
            await this.min_wrapper.enqueueFrame(handle, data);
        }
    }

    async closeTerminal(handle: TerminalHandle): Promise<void> {
        await withTimeout(this.send_min_socket(false, handle), 500, "Close MIN socket");
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
            getFlightRecorder().addEvent(FlightEventType.data_to_ud3, data);
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
        this.terminalCallbacks.clear();
        ipcs.terminal.onConnectionClosed();
    }

    public resetWatchdog(): void {
        if (this.min_wrapper) {
            this.min_wrapper.enqueueFrame(UD3MinIDs.WATCHDOG, []);
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
            this.min_wrapper.enqueueFrame(minID, frame).catch(err => {
                console.log("Failed to send media packet: " + err);
            });
        }
    }

    private sendBufferedFrame(buf: Buffer[], minID: number) {
        while (this.min_wrapper.get_relative_fifo_size() < 0.75 && buf.length > 0) {
            //console.log(buf[0]);
            console.log("send_frame");
            this.min_wrapper.enqueueFrame(minID, buf.shift()).catch(err => {
                console.log("Failed to send media packet: " + err);
            });
        }
    }

    public async tick(): Promise<void> {
        if (this.min_wrapper) {
            const maxPerFrame = 200;

            this.batchFrames(this.mediaFramesForBatching, maxPerFrame, false, UD3MinIDs.MEDIA);
            this.batchFrames(this.mediaFramesForBatchingSID, maxPerFrame, true, UD3MinIDs.SID);
            if (this.counter > 20) {
                this.counter = 0;
                this.sendBufferedFrame(this.VMSFramesForBatching, UD3MinIDs.VMS);
            } else {
                this.counter++;
            }

            this.min_wrapper.tick();
        }
    }

    private async send_min_socket(connect: boolean, id: TerminalHandle) {
        if (this.min_wrapper) {
            const infoBuffer = Buffer.from(
                String.fromCharCode(id) +
                String.fromCharCode(connect ? 1 : 0) +
                "TT socket" +
                String.fromCharCode(0),
                'utf-8');
            await this.repeatedlySendFrame(UD3MinIDs.SOCKET, infoBuffer);
        }
    }

    private async init_min_wrapper(): Promise<void> {
        const sender = (data) => {
            if (this.isBootloading()) {
                return;
            }
            getFlightRecorder().addEvent(FlightEventType.data_to_ud3, data);
            this.send(data, (err) => {
                if (err) {
                    console.error("Error while sending data: ", err);
                }
            });
        };
        const handler = async (id, data) => {
            if (id === UD3MinIDs.MEDIA) {
                if (data[0] === 0x78) {
                    this.sidConnection.setBusy(true);
                } else if (data[0] === 0x6f) {
                    this.sidConnection.setBusy(false);
                } else {
                    console.error("Unexpected MEDIA MIN message");
                }
            } else if (id === UD3MinIDs.FEATURE) {
                const asString = convertBufferToString(data);
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
            } else if (id === UD3MinIDs.EVENT && data[0] === EVENT_GET_INFO) {
                // https://github.com/Netzpfuscher/UD3/blob/892b8c25da2784e880c0c2617d417b14c3421ecd/common/ud3core/tasks/tsk_min.c#L216-L221
                // 1: ID, 1: struct_version, 2: Padding (FFS...), 2*4: unique_id
                ipcs.misc.sendUDName(convertBufferToString(data.slice(1 + 1 + 2 + 2 * 4)));
            } else if (this.terminalCallbacks.has(id)) {
                this.terminalCallbacks.get(id).callback(Buffer.from(data));
            } else {
                console.warn("Unexpected MIN message at " + id + ": " + convertBufferToString(data));
            }
        };
        this.min_wrapper = new MINTransceiver(() => this.toUD3Time(microtime.now()), sender, handler);
    }

    public async flushSynth(): Promise<void> {
        if (this.min_wrapper) {
            await this.min_wrapper.enqueueFrame(UD3MinIDs.SYNTH, [SYNTH_CMD_FLUSH]);
        }
    }

    public async setSynthImpl(type: SynthType): Promise<void> {
        if (this.min_wrapper) {
            await this.min_wrapper.enqueueFrame(UD3MinIDs.SYNTH, [type]);
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

    private async repeatedlySendFrame(id: number, payload: number[] | Buffer) {
        let tries = 0;
        while (this.min_wrapper && tries < 16) {
            try {
                await this.min_wrapper.enqueueFrame(id, payload);
                return;
            } catch (e) {
                console.error('During MIN connection setup', e);
            }
            ++tries;
        }
        throw new Error('Failed to send frame in 16 tries');
    }
}
