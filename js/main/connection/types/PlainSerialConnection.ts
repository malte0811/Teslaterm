import {SerialPort} from "serialport";
import {CoilID} from "../../../common/constants";
import {FlightEventType} from "../../../common/FlightRecorderTypes";
import {SynthType} from "../../../common/MediaTypes";
import {ISidConnection} from "../../sid/ISidConnection";
import {getFlightRecorder} from "../flightrecorder/FlightRecorder";
import {TerminalHandle, toCommandID, UD3Connection} from "./UD3Connection";

export class PlainSerialConnection extends UD3Connection {
    private serialPort: SerialPort;
    private readonly baudrate: number;
    private readonly port: string;

    constructor(coil: CoilID, port: string, baudrate: number) {
        super(coil);
        this.baudrate = baudrate;
        this.port = port;
    }

    public connect(): Promise<void> {
        return new Promise<void>((res, rej) => {
            this.serialPort = new SerialPort(
                {
                    baudRate: this.baudrate,
                    path: this.port,
                }, (e: Error | null) => {
                    if (e) {
                        console.log("Not connecting, ", e);
                        rej(e);
                    } else {
                        this.serialPort.on('data', (data: Buffer) => {
                            getFlightRecorder(this.getCoil()).addEvent(FlightEventType.data_from_ud3, data);
                            for (const terminal of this.terminalCallbacks.values()) {
                                terminal.callback(data);
                            }
                        });
                        res();
                    }
                });
        })
            .catch((e) => {
                this.releaseResources();
                throw e;
            });
    }

    public releaseResources() {
        if (this.serialPort) {
            if (this.serialPort.isOpen) {
                this.serialPort.close();
            }
            this.serialPort.destroy();
            this.serialPort = undefined;
        }
    }

    public async sendVMSFrames(data: Buffer) {
    }

    public async sendDisconnectData(): Promise<void> {
        await this.sendTelnet(Buffer.from("tterm stop"));
    }

    public getSidConnection(): ISidConnection {
        // TODO add support for returning undefined here
        return undefined;
    }

    public resetWatchdog(): void {
        this.sendAsync(Buffer.of(0xF0, 0x0F, 0));
        // this.sendAsync(Buffer.of(0x07));
    }

    public sendMidi(data: Buffer): Promise<void> {
        if (data.length < 3) {
            data = Buffer.concat([data, Buffer.alloc(3 - data.length, 0)]);
        }
        console.assert(data[0] >= 0x80);
        return this.sendAsync(data);
    }

    public async sendTelnet(data: Buffer): Promise<void> {
        await this.sendAsync(data);
    }

    public setSynthImpl(type: SynthType): Promise<void> {
        const id = toCommandID(type);
        return this.sendTelnet(Buffer.from("set synth " + id.toString(10) + "\r"));
    }

    public tick(): void {
        // NOP
    }

    public isMultiTerminal(): boolean {
        return false;
    }

    public getManualTerminalID(): TerminalHandle {
        return 0;
    }

    private async sendAsync(rawData: Buffer): Promise<void> {
        return new Promise<void>((res, rej) => {
            getFlightRecorder(this.getCoil()).addEvent(FlightEventType.data_to_ud3, rawData);
            this.serialPort.write(rawData, err => {
                if (err) {
                    getFlightRecorder(this.getCoil()).addEventString(FlightEventType.transmit_error, err.message);
                    rej(err);
                } else {
                    res();
                }
            });
        });
    }
}

export function createPlainSerialConnection(coil: CoilID, port: string, baudrate: number): UD3Connection {
    return new PlainSerialConnection(coil, port, baudrate);
}
