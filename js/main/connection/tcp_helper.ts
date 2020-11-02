import * as dgram from "dgram";
import * as net from "net";
import {promisify} from "util";
import {TerminalIPC} from "../ipc/terminal";

export function connectTCPSocket(
    ipaddr: string,
    port: number,
    desc: string,
    dataCallback: (data: Buffer) => void,
): Promise<net.Socket> {
    return new Promise<net.Socket>((res, rej) => {
        const ret = net.createConnection({port, host: ipaddr}, () => {
            TerminalIPC.println("Connected socket " + desc);
            res(ret);
        });
        ret.on('end', () => {
            TerminalIPC.println("Socket " + desc + " disconnected");
        });
        ret.addListener('error', (e: Error) => {
            TerminalIPC.println("Error on " + desc + " socket!");
            console.error(e);
            rej(e);
        });
        ret.on('data', dataCallback);
    });
}

function createSocket(onError: (err) => any): dgram.Socket {
    let socket = dgram.createSocket("udp4");
    socket.on('end', () => {
    });
    socket.on('error', onError);
    return socket;
}

function bind(socket: dgram.Socket): Promise<void> {
    return promisify<void>(cb => socket.bind(() => cb(undefined)))();
}

export async function createBroadcastSocket(): Promise<dgram.Socket> {
    const socket = createSocket((e) => {
        throw e;
    });
    await bind(socket);
    socket.setBroadcast(true);
    return socket;
}

export async function createUDPSocket(remotePort: number, remoteAddress: string): Promise<dgram.Socket> {
    return new Promise<dgram.Socket>((res, rej) => {
        const socket = createSocket(rej);
        socket.connect(remotePort, remoteAddress, () => res(socket));
    });
}
