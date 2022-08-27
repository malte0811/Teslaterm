import {FullConnectionOptions} from "./ConnectionOptions";

export interface EthernetConfig {
    readonly remoteIP: string;
    readonly udpMinPort: number;
}

export interface SerialConfig {
    readonly serialPort: string;
    readonly baudrate: number;
    readonly productID: string;
    readonly vendorID: string;
}

export interface MidiConfig {
    readonly runMidiServer: boolean;
    readonly port: number;
    readonly localName: string;
    readonly bonjourName: string;
}

export interface NetSidConfig {
    readonly enabled: boolean;
    readonly port: number;
}

export type CommandRole = 'disable' | 'server' | 'client';
export const COMMAND_ROLES = new Map<string, CommandRole>();
COMMAND_ROLES.set('disable', 'disable');
COMMAND_ROLES.set('server', 'server');
COMMAND_ROLES.set('client', 'client');

export interface CommandConnectionConfig {
    readonly state: CommandRole;
    readonly port: number;
    readonly remoteName: string;
}

export interface TTConfig {
    readonly defaultConnectOptions: FullConnectionOptions;
    readonly midi: MidiConfig;
    readonly netsid: NetSidConfig;
    readonly command: CommandConnectionConfig;

    readonly udConfigPages: Map<string, number>;
    readonly defaultUDFeatures: Map<string, string>;
}
