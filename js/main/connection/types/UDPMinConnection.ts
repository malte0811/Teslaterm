import {CoilID} from "../../../common/constants";
import {createUDPSocket} from "../udp_helper";
import {MinConnection} from "./MinConnection";
import {UD3Connection} from "./UD3Connection";
import * as dgram from 'dgram';

class UDPMinConnection extends MinConnection {
    public readonly remotePort: number;
    public readonly remoteAddress: string;
    private socket: dgram.Socket;

    constructor(coil: CoilID, remotePort: number, remoteAddress: string) {
        super(coil);
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

    public releaseResources() {
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
    }

    public registerListener(listener: (data: Buffer) => void): void {
        this.socket.addListener("message", listener);
    }

    public send(data: Buffer | number[], onError: (err) => void): void {
        try {
            this.socket.send(Buffer.from(data), e => {
                if (e) {
                    onError(e);
                }
            });
        } catch (e) {
            onError(e);
        }
    }
}

export function createMinUDPConnection(coil: CoilID, port: number, address: string): UD3Connection {
    return new UDPMinConnection(coil, port, address);
}
