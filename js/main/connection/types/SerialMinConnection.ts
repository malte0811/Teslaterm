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
        this.serialPort = await connectSerialPort(this.port, this.baudrate);
        await super.connect();
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

    public getFTPAddress(): string | undefined {
        return undefined;
    }

    protected registerListener(listener: (data: Buffer) => void): void {
        this.serialPort.addListener("data", listener);
    }

    protected send(data: MINDataBuffer, onError: (err) => void): void {
        if (this.serialPort) {
            this.serialPort.write(data, onError);
        }
    }
}

export function createMinSerialConnection(coil: CoilID, port: string, baudrate: number): UD3Connection {
    return new MinSerialConnection(coil, port, baudrate);
}

export function connectSerialPort(path: string, baudRate: number): Promise<SerialPort> {
    return new Promise<SerialPort>((res, rej) => {
        const port = new SerialPort(
            {baudRate, path},
            (e: Error | null) => {
                if (e) {
                    console.trace("Not connecting, ", e);
                    rej(e);
                } else {
                    port.on("error", (err) => console.error(err));
                    res(port);
                }
            });
    });
}

