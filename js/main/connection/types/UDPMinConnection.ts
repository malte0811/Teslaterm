import * as dgram from 'dgram';
import {CoilID} from "../../../common/constants";
import {MINDataBuffer} from "../../min/MINConstants";
import {createUDPSocket} from "../udp_helper";
import {MinConnection} from "./MinConnection";
import {UD3Connection} from "./UD3Connection";

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
        super.releaseResources();
        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                console.warn('Failed to disconnect socket:', e);
            }
            this.socket = undefined;
        }
    }

    public getFTPAddress(): string | undefined {
        return this.remoteAddress;
    }

    protected send(data: MINDataBuffer, onError: (err) => void): void {
        try {
            this.socket.send(Buffer.of(...data), e => {
                if (e) {
                    onError(e);
                }
            });
        } catch (e) {
            onError(e);
        }
    }

    protected registerListener(listener: (data: Buffer) => void): void {
        this.socket.addListener("message", listener);
    }
}

export function createMinUDPConnection(coil: CoilID, port: number, address: string): UD3Connection {
    return new UDPMinConnection(coil, port, address);
}
