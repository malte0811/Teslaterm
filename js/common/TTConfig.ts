export class EthernetConfig {
    public remote_ip: string;
    public udpMinPort: number;
}

export class SerialConfig {
    public serial_port: string;
    public baudrate: number;
    public productID: string;
    public vendorID: string;
}

export class MidiConfig {
    public runMidiServer: boolean;
    public port: number;
    public localName: string;
    public bonjourName: string;
}

export class NetSidConfig {
    public enabled: boolean;
    public port: number;
}

export type CommandRole = "disable" | "server" | "client";

export class CommandConnectionConfig {
    public state: CommandRole;
    public port: number;
    public remoteName: string;
}

export class TTConfig {
    // The type of connection to use for autoconnect: none, eth, udpmin, min or serial
    public autoconnect: string;
    public readonly ethernet: EthernetConfig = new EthernetConfig();
    public readonly serial: SerialConfig = new SerialConfig();
    public readonly midi: MidiConfig = new MidiConfig();
    public readonly netsid: NetSidConfig = new NetSidConfig();
    public readonly command: CommandConnectionConfig = new CommandConnectionConfig();

    public readonly udConfigPages: Map<string, number> = new Map();
    public readonly defaultUDFeatures: Map<string, string> = new Map();
}
