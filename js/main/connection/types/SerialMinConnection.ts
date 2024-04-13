import {SerialPort} from "serialport";
import {CoilID} from "../../../common/constants";
import {MINDataBuffer} from "../../min/MINConstants";
import {MinConnection} from "./MinConnection";
import {UD3Connection} from "./UD3Connection";

class MinSerialConnection extends MinConnection {
    public readonly port: string;
    public readonly baudrate: number;
    private serialPort: SerialPort;

    constructor(coil: CoilID, port: string, baud: number) {
        super(coil);
        this.port = port;
        this.baudrate = baud;
    }

    public async connect(): Promise<void> {
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
                        this.serialPort.on("error", err => console.log(err));
                        res();
                    }
                });
        })
            .then(() => super.connect())
            .catch((e) => {
                if (this.serialPort && this.serialPort.isOpen) {
                    this.serialPort.close();
                    this.serialPort.destroy();
                }
                throw e;
            });
    }

    public releaseResources() {
        super.releaseResources();
        if (this.serialPort) {
            if (this.serialPort.isOpen) {
                this.serialPort.close();
            }
            this.serialPort.destroy();
            this.serialPort = undefined;
        }
    }

    public enterBootloaderMode(dataCallback: (data: Buffer) => void): void {
        super.enterBootloaderMode(dataCallback);
        this.serialPort.flush();
    }

    public registerListener(listener: (data: Buffer) => void): void {
        this.serialPort.addListener("data", listener);
    }

    public send(data: MINDataBuffer, onError: (err) => void): void {
        if (this.serialPort) {
            this.serialPort.write(data, onError);
        }
    }

    public getFTPAddress(): string | undefined {
        return undefined;
    }
}

export function createMinSerialConnection(coil: CoilID, port: string, baudrate: number): UD3Connection {
    return new MinSerialConnection(coil, port, baudrate);
}

