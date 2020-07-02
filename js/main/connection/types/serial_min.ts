import {SynthType} from "../../../common/CommonTypes";
import {config} from "../../init";
import * as microtime from "../../microtime";
import SerialPort = require("serialport");
import minprot = require('../../../../libs/min');
import {convertBufferToString, Endianness, to_ud3_time, withTimeout} from "../../helper";
import {BootloadableConnection} from "../bootloader/bootloadable_connection";
import {ISidConnection} from "../../sid/ISidConnection";
import {UD3FormattedConnection} from "../../sid/UD3FormattedConnection";
import {UD3Connection, TerminalHandle} from "./UD3Connection";

const MIN_ID_WD = 10;
const MIN_ID_MEDIA = 20;
const MIN_ID_SOCKET = 13;
const MIN_ID_SYNTH = 14;
const MIN_ID_FEATURE = 15;

const SYNTH_CMD_FLUSH = 0x01;
const SYNTH_CMD_SID = 0x02;
const SYNTH_CMD_MIDI = 0x03;
const SYNTH_CMD_OFF = 0x04;

class MinSerialConnection extends BootloadableConnection {
    public readonly port: string;
    public readonly baudrate: number;
    private serialPort: SerialPort;
    private min_wrapper: minprot | undefined;
    private readonly sidConnection: UD3FormattedConnection;
    private mediaFramesForBatching: Buffer[] = [];
    private actualUDFeatures: Map<string, string>;

    constructor(port: string, baud: number) {
        super();
        this.port = port;
        this.baudrate = baud;
        this.sidConnection = new UD3FormattedConnection(
            () => this.flushSynth(),
            (data) => this.sendMedia(data)
        );
        this.actualUDFeatures = new Map(config.defaultUDFeatures.entries());
    }

    public async connect(): Promise<void> {
        return new Promise<void>((res, rej) => {
            this.serialPort = new SerialPort(this.port,
                {
                    baudRate: this.baudrate,
                }, (e: Error | null) => {
                    if (e) {
                        console.log("Not connecting, ", e);
                        rej(e);
                    } else {
                        this.serialPort.on('data', (data: Buffer) => {
                            if (this.isBootloading()) {
                                this.bootloaderCallback(data);
                            } else {
                                this.min_wrapper.min_poll(data);
                            }
                        });
                        res();
                    }
                });
        })
            .then(() => this.init_min_wrapper())
            .catch((e) => {
                if (this.serialPort && this.serialPort.isOpen) {
                    this.serialPort.close();
                    this.serialPort.destroy();
                }
                throw e;
            });
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
        if (this.serialPort) {
            if (this.serialPort.isOpen) {
                this.serialPort.close();
            }
            this.serialPort.destroy();
            this.min_wrapper = undefined;
            this.serialPort = undefined;
        }
    }

    async sendMedia(data: Buffer) {
        if (this.min_wrapper) {
            this.mediaFramesForBatching.push(data);
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
    }

    public sendBootloaderData(data: Buffer): Promise<void> {
        return new Promise<void>((res, rej) => {
            this.serialPort.write(data, (err) => {
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
        this.serialPort.flush();
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

    public async tick(): Promise<void> {
        if (this.min_wrapper) {
            const maxPerFrame = 200;
            while (this.mediaFramesForBatching.length > 0) {
                let frameParts: Buffer[] = [];
                let currentSize = 0;
                while (
                    this.mediaFramesForBatching.length > 0 &&
                    this.mediaFramesForBatching[0].length + currentSize <= maxPerFrame
                    ) {
                    currentSize += this.mediaFramesForBatching[0].length;
                    frameParts.push(this.mediaFramesForBatching.shift());
                }
                let frame = Buffer.concat(frameParts);
                this.min_wrapper.min_queue_frame(MIN_ID_MEDIA, frame);
            }
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
            while (!done && this.min_wrapper && tries < 256) {
                try {
                    await this.min_wrapper.min_queue_frame(MIN_ID_SOCKET, infoBuffer);
                    done = true;
                } catch (e) {
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
            this.serialPort.write(data, (err) => {
                if (err) {
                    console.error("Error while sending serial data: ", err);
                }
            });
        };
        this.min_wrapper.handler = (id, data) => {
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
                    this.actualUDFeatures.set(asString.substring(0, splitPoint), asString.substring(splitPoint + 1));
                }
            } else if (this.terminalCallbacks.has(id)) {
                this.terminalCallbacks.get(id).callback(new Buffer(data));
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

    public async setSynth(type: SynthType): Promise<void> {
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
}

export function createMinSerialConnection(port: string, baudrate: number): UD3Connection {
    return new MinSerialConnection(port, baudrate);
}

