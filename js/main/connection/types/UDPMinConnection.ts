import {createUDPSocket} from "../tcp_helper";
import {MinConnection} from "./MinConnection";
import {UD3Connection} from "./UD3Connection";
import * as dgram from 'dgram';

class UDPMinConnection extends MinConnection {
    public readonly remotePort: number;
    public readonly remoteAddress: string;
    private socket: dgram.Socket;

    constructor(remotePort: number, remoteAddress: string) {
        super();
        if (!(remotePort >= 0 && remotePort < 65536)) {
            throw new Error("Invalid port " + remotePort);
        }
        this.remotePort = remotePort;
        this.remoteAddress = remoteAddress;
    }

    public async connect(): Promise<void> {
        try {
            this.socket = await createUDPSocket(this.remotePort, this.remoteAddress);
            await super.connect();
        } catch (e) {
            if (this.socket) {
                this.socket.close();
            }
            throw e;
        }
    }

    public async disconnect() {
        await super.disconnect();
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
    }

    registerListener(listener: (data: Buffer) => void): void {
        this.socket.addListener("message", listener);
    }

    send(data: Buffer | number[], onError: (err) => void): void {
        this.socket.send(Buffer.from(data), e => {
            if (e) {
                onError(e);
            }
        });
    }
}

export function createMinUDPConnection(port: number, address: string): UD3Connection {
    return new UDPMinConnection(port, address);
}
