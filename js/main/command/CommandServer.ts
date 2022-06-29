import {createServer, Server, Socket} from "net";
import {config} from "../init";
import {now} from "../microtime";
import {BoolOptionCommand, Message, MessageType, NumberOptionCommand, timeout_us, toBytes} from "./CommandMessages";

interface IConnectedClient {
    lastMessageMicrotime: number;
    socket: Socket;
}

export interface ICommandServer {
    tick();

    sendSIDFrame(data: Uint8Array, absoluteTime: number);

    sendMIDI(data: Buffer);

    setBoolOption(option: BoolOptionCommand, value: boolean);

    setNumberOption(option: NumberOptionCommand, value: number);
}

class CommandServer implements ICommandServer {
    private telnetSocket: Server | undefined;
    private clients: IConnectedClient[] = [];

    public constructor(port: number) {
        this.telnetSocket = createServer({}, (socket) => this.onConnect(socket));
        this.telnetSocket.listen(port);
    }

    public tick() {
        const time = now();
        for (let i = 0; i < this.clients.length;) {
            const client = this.clients[i];
            if (time - client.lastMessageMicrotime > timeout_us) {
                this.clients.splice(i);
                console.log("Client timed out!");
            } else {
                ++i;
            }
        }
        this.sendToAll({type: MessageType.time, time});
    }

    public sendSIDFrame(data: Uint8Array, absoluteTime: number) {
        this.sendToAll({type: MessageType.sid_frame, data, absoluteServerTime: absoluteTime});
    }

    public sendMIDI(data: Buffer) {
        this.sendToAll({type: MessageType.midi_message, message: data});
    }

    public setBoolOption(option: BoolOptionCommand, value: boolean) {
        this.sendToAll({type: MessageType.bool_command, option, value});
    }

    public setNumberOption(option: NumberOptionCommand, value: number) {
        this.sendToAll({type: MessageType.number_command, option, value});
    }

    private sendToAll(msg: Message) {
        const bytes = toBytes(msg);
        for (const client of this.clients) {
            client.socket.write(bytes);
        }
    }

    private onConnect(socket: Socket) {
        const client = {lastMessageMicrotime: now(), socket};
        this.clients.push(client);
        console.log("Got new client!");
        socket.on("data", () => client.lastMessageMicrotime = now());
    }
}

class DummyCommandServer implements ICommandServer {
    public sendMIDI(data: Buffer) {
    }

    public sendSIDFrame(data: Uint8Array, absoluteTime: number) {
    }

    public setBoolOption(option: BoolOptionCommand, value: boolean) {
    }

    public setNumberOption(option: NumberOptionCommand, value: number) {
    }

    public tick() {
    }
}

export function makeCommandServer(): ICommandServer {
    if (config.command.state === "server") {
        return new CommandServer(config.command.port);
    } else {
        return new DummyCommandServer();
    }
}
