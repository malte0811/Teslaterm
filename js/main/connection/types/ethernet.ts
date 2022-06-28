import * as dgram from "dgram";
import * as net from "net";
import {SynthType} from "../../../common/CommonTypes";
import {ipcs} from "../../ipc/IPCProvider";
import {ISidConnection} from "../../sid/ISidConnection";
import {NetworkSIDClient} from "../../sid/NetworkSIDClient";
import {connectTCPSocket} from "../tcp_helper";
import {toCommandID, UD3Connection} from "./UD3Connection";

class EthernetConnection extends UD3Connection {
    private telnetSocket: net.Socket | undefined;
    private sidClient: NetworkSIDClient;
    private midiSocket: dgram.Socket | undefined;
    private readonly remoteIp: string;
    private readonly telnetPort: number;
    private readonly midiPort: number;
    private readonly sidPort: number;

    constructor(ipaddr: string, telnet: number, midi: number, sid: number) {
        super();
        this.remoteIp = ipaddr;
        this.telnetPort = telnet;
        this.midiPort = midi;
        this.sidPort = sid;
    }

    public async sendTelnet(data: Buffer) {
        return new Promise<void>((res, rej) => {
            this.telnetSocket.write(data, (e) => {
                if (e) {
                    rej(e);
                } else {
                    res();
                }
            });
        });
    }

    async sendMidi(data: Buffer) {
        this.midiSocket.send(data, this.midiPort, this.remoteIp);
    }

    private handleMessage(data: Buffer): void {
        for (const callback of this.terminalCallbacks.values()) {
            callback.callback(data);
        }
    }

    public async sendVMSFrames(data: Buffer) {
    }

    public async connect(): Promise<void> {
        this.telnetSocket = await connectTCPSocket(
            this.remoteIp,
            this.telnetPort,
            "main",
            (data: Buffer) => this.handleMessage(data)
        );
        this.midiSocket = await createUDPSocket("media", d => {
            console.error("Received unexpected data on MIDI socket: ", d);
        });
        this.sidClient = await NetworkSIDClient.create(this.remoteIp, this.sidPort);
    }

    public disconnect(): void {
        this.telnetSocket.destroy();
        this.midiSocket.close();
    }

    public resetWatchdog(): void {
        this.sendTelnet(Buffer.of(7));
    }

    public tick(): void {
    }


    public async setSynthImpl(type: SynthType): Promise<void> {
        const id = toCommandID(type);
        return this.sendTelnet(Buffer.from("set synth " + id.toString(10) + "\r"));
    }

    getSidConnection(): ISidConnection {
        return this.sidClient;
    }

    getMaxTerminalID(): number {
        throw new Error();
    }

    isMultiTerminal(): boolean {
        return false;
    }
}

export function createEthernetConnection(ip: string, telnetPort: number, midiPort: number, sidPort: number): UD3Connection {
    return new EthernetConnection(ip, telnetPort, midiPort, sidPort);
}

function createUDPSocket(
    desc: string,
    dataCallback: (data: Buffer) => void,
): Promise<dgram.Socket> {
    return new Promise<dgram.Socket>((res, rej) => {
        const ret = dgram.createSocket("udp4");
        ret.on('end', () => {
            ipcs.terminal.println("Socket " + desc + " disconnected");
        });
        ret.on('listening', () => res(ret));
        ret.on('error', rej);
        ret.on('data', dataCallback);
        ret.bind();
    });
}

