import {CoilID, FEATURE_MINSID, FEATURE_NOTELEMETRY} from "../../../common/constants";
import {FlightEventType} from "../../../common/FlightRecorderTypes";
import {SynthType} from "../../../common/MediaTypes";
import {convertBufferToString, withTimeout} from "../../helper";
import {config} from "../../init";
import {ipcs} from "../../ipc/IPCProvider";
import * as microtime from "../../microtime";
import {MINDataBuffer} from "../../min/MINConstants";
import {MINTransceiver} from "../../min/MINTransceiver";
import {ISidConnection} from "../../sid/ISidConnection";
import {FormatVersion, UD3FormattedConnection} from "../../sid/UD3FormattedConnection";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {getFlightRecorder} from "../flightrecorder/FlightRecorder";
import {TerminalHandle} from "./UD3Connection";
import {EVENT_GET_INFO, parseEventInfo, SYNTH_CMD_FLUSH, UD3MinIDs} from "./UD3MINConstants";

export abstract class MinConnection extends BootloadableConnection {
    private min_wrapper: MINTransceiver | undefined;
    private readonly sidConnection: UD3FormattedConnection;
    private mediaFramesForBatching: Buffer[] = [];
    private mediaFramesForBatchingSID: Buffer[] = [];
    private vmsFramesForBatching: Buffer[] = [];
    private actualUDFeatures: Map<string, string>;
    private connectionsToSetTTerm: TerminalHandle[] = [];
    private counter: number = 0;
    private udName: string = undefined;
    private sidMINChannel: number = UD3MinIDs.SID;

    protected constructor(coil: CoilID) {
        super(coil);
        this.sidConnection = new UD3FormattedConnection(
            () => this.flushSynth(),
            (data, direct) => this.sendSID(data, direct),
            coil,
        );
        this.actualUDFeatures = new Map(config.defaultUDFeatures.entries());
    }

    public async connect(): Promise<void> {
        this.registerListener(data => {
            getFlightRecorder(this.getCoil()).addEvent(FlightEventType.data_from_ud3, data);
            if (this.isBootloading()) {
                this.bootloaderCallback(data);
            } else {
                this.min_wrapper.onReceived(data);
            }
        });
        await this.init_min_wrapper();
        for (const handle of this.terminalCallbacks.keys()) {
            await this.sendTerminal(handle);
        }
        await this.repeatedlySendFrame(UD3MinIDs.EVENT, [EVENT_GET_INFO]);
    }

    public releaseResources() {
        this.min_wrapper = undefined;
    }

    public async sendDisconnectData() {
        try {
            const toDisconnect = [];
            for (const id of this.terminalCallbacks.keys()) {
                toDisconnect.push(id);
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

    public async sendVMSFrames(data: Buffer) {
        if (this.min_wrapper) {
            this.vmsFramesForBatching.push(data);
        }
    }

    public sendMidi(data: Buffer) {
        return this.sendMedia(data);
    }

    public getSidConnection(): ISidConnection {
        return this.sidConnection;
    }

    public async sendTelnet(data: Buffer, handle: TerminalHandle) {
        if (this.min_wrapper) {
            await this.min_wrapper.enqueueFrame(handle, data);
        }
    }

    public async closeTerminal(handle: TerminalHandle): Promise<void> {
        await withTimeout(this.send_min_socket(false, handle), 500, "Close MIN socket");
        await super.closeTerminal(handle);
    }

    public async startTerminal(handle: TerminalHandle, dataCallback: (data: Buffer) => void): Promise<void> {
        await super.startTerminal(handle, dataCallback);
        if (this.min_wrapper) {
            await this.sendTerminal(handle);
        }
    }

    public sendBootloaderData(data: MINDataBuffer): Promise<void> {
        return new Promise<void>((res, rej) => {
            getFlightRecorder(this.getCoil()).addEvent(FlightEventType.data_to_ud3, data);
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
        ipcs.terminal(this.getCoil()).onConnectionClosed();
    }

    public resetWatchdog(): void {
        if (this.min_wrapper) {
            this.min_wrapper.enqueueFrame(UD3MinIDs.WATCHDOG, []);
        }
    }

    public tick() {
        if (this.min_wrapper) {
            const maxPerFrame = 200;

            this.sidConnection.tick();
            this.batchFrames(this.mediaFramesForBatching, maxPerFrame, false, UD3MinIDs.MEDIA);
            this.batchFrames(this.mediaFramesForBatchingSID, maxPerFrame, true, UD3MinIDs.SID);
            if (this.counter > 20) {
                this.counter = 0;
                this.sendBufferedFrame(this.vmsFramesForBatching, UD3MinIDs.VMS);
            } else {
                this.counter++;
            }

            this.min_wrapper.tick();
        }
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

    public getFeatureValue(feature: string): string {
        return this.actualUDFeatures.get(feature);
    }

    public getUDName(): string | undefined {
        return this.udName;
    }

    protected abstract send(data: MINDataBuffer, onError: (err) => void): void;

    protected abstract registerListener(listener: (data: Buffer) => void): void;

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

    private async sendTerminal(handle: TerminalHandle) {
        await this.send_min_socket(true, handle);
        if (this.getFeatureValue(FEATURE_NOTELEMETRY) !== "1") {
            this.connectionsToSetTTerm.push(handle);
        }
        if (this.getFeatureValue(FEATURE_MINSID) === "1") {
            this.sidConnection.switch_format(FormatVersion.v2);
            this.sidMINChannel = UD3MinIDs.SID;
        } else {
            this.sidConnection.switch_format(FormatVersion.v1);
            this.sidMINChannel = UD3MinIDs.MEDIA;
        }
    }

    private async sendMedia(data: Buffer) {
        if (this.min_wrapper) {
            this.mediaFramesForBatching.push(data);
        }
    }

    private async sendSID(data: Buffer, direct: boolean) {
        if (this.min_wrapper) {
            if (direct) {
                await this.min_wrapper.enqueueFrame(this.sidMINChannel, data);
            } else {
                this.mediaFramesForBatchingSID.push(data);
            }
        }
    }

    private batchFrames(buf: Buffer[], maxPerFrame: number, insertFrameCnt: boolean, minID: number) {
        while (this.min_wrapper.get_relative_fifo_size() < 0.75 && buf.length > 0) {
            const frameParts: Buffer[] = [];
            let currentSize = 0;
            while (buf.length > 0 && buf[0].length + currentSize <= maxPerFrame) {
                currentSize += buf[0].length;
                frameParts.push(buf.shift());
            }
            if (insertFrameCnt) {
                frameParts.unshift(Buffer.from([frameParts.length]));
            }
            const frame = Buffer.concat(frameParts);
            this.min_wrapper.enqueueFrame(minID, frame).catch(err => {
                console.log("Failed to send media packet: " + err);
            });
        }
    }

    private sendBufferedFrame(buf: Buffer[], minID: number) {
        while (this.min_wrapper.get_relative_fifo_size() < 0.75 && buf.length > 0) {
            this.min_wrapper.enqueueFrame(minID, buf.shift()).catch(err => {
                console.log("Failed to send media packet: " + err);
            });
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
        const sender = (data: number[]) => {
            if (this.isBootloading()) {
                return;
            }
            getFlightRecorder(this.getCoil()).addEvent(FlightEventType.data_to_ud3, data);
            this.send(data, (err) => {
                if (err) {
                    console.error("Error while sending data: ", err);
                }
            });
        };
        const handler = async (id: number, data: number[]) => {
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
                this.udName = parseEventInfo(data).udName;
                ipcs.coilMisc(this.getCoil()).sendUDName(this.getUDName());
            } else if (this.terminalCallbacks.has(id)) {
                this.terminalCallbacks.get(id).callback(Buffer.from(data));
            } else {
                console.warn("Unexpected MIN message at " + id + ": " + data);
            }
        };
        this.min_wrapper = new MINTransceiver(() => this.toUD3Time(microtime.now()), sender, handler);
    }
}
