import {jspack} from "jspack";
import {CoilID} from "../../common/constants";
import {forEachCoilAsync, getCoilCommands} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {setRelativeOntime} from "../ipc/sliders";

export const timeout_us = 5_000_000;

export enum MessageType {
    time,
    keep_alive,
    sid_frame,
    midi_message,
    bool_command,
    number_command,
}

export enum BoolOptionCommand {bus, kill, transient}

export enum NumberOptionCommand {relative_ontime, bps, burst_on, burst_off}

export function setBoolOption(coil: CoilID, option: BoolOptionCommand, value: boolean) {
    const commands = getCoilCommands(coil);
    switch (option) {
        case BoolOptionCommand.bus:
            return (value ? commands.busOn() : commands.busOff());
        case BoolOptionCommand.kill:
            return (value ? commands.setKill() : commands.resetKill());
        case BoolOptionCommand.transient:
            return commands.setTransientEnabled(value);
    }
}

export function setNumberOption(option: NumberOptionCommand, value: number) {
    if (option === NumberOptionCommand.relative_ontime) {
        return setRelativeOntime(value);
    } else {
        return forEachCoilAsync((coil) => {
            const sliders = ipcs.sliders(coil);
            switch (option) {
                case NumberOptionCommand.bps:
                    return sliders.setBPS(value);
                case NumberOptionCommand.burst_on:
                    return sliders.setBurstOntime(value);
                case NumberOptionCommand.burst_off:
                    return sliders.setBurstOfftime(value);
            }
        });
    }
}

export type Message =
    {type: MessageType.time, time: number} |
    {type: MessageType.keep_alive} |
    {type: MessageType.sid_frame, data: Uint8Array, absoluteServerTime: number} |
    {type: MessageType.midi_message, message: Buffer} |
    {type: MessageType.bool_command, option: BoolOptionCommand, value: boolean} |
    {type: MessageType.number_command, option: NumberOptionCommand, value: number};


function readDouble(data: Buffer | number[], offset: number): number {
    return jspack.Unpack('d', data.slice(offset))[0];
}

function writeDouble(time: number): number[] {
    return jspack.Pack('d', [time]);
}

export function toBytes(message: Message): Uint8Array {
    let buffer: number[] = [];
    switch (message.type) {
        case MessageType.keep_alive:
            // NOP
            break;
        case MessageType.time:
            buffer.push(...writeDouble(message.time));
            break;
        case MessageType.sid_frame:
            buffer.push(...writeDouble(message.absoluteServerTime));
            buffer.push(...message.data);
            break;
        case MessageType.midi_message:
            buffer.push(...message.message);
            break;
        case MessageType.bool_command:
            buffer.push(message.option);
            buffer.push(message.value ? 1 : 0);
            break;
        case MessageType.number_command:
            buffer.push(message.option);
            buffer.push(...writeDouble(message.value));
            break;
    }
    buffer = [buffer.length, message.type, ...buffer];
    return new Uint8Array(buffer);
}

export class Parser {

    private static fromBytes(data: number[]): Message {
        const type: MessageType = data[0];
        switch (type) {
            case MessageType.time:
                return {type, time: readDouble(data, 1)};
            case MessageType.keep_alive:
                return {type};
            case MessageType.sid_frame:
                return {type, absoluteServerTime: readDouble(data, 1), data: new Uint8Array(data.slice(9))};
            case MessageType.midi_message:
                return {type, message: Buffer.of(...data.slice(1))};
            case MessageType.bool_command:
                return {option: data[1], type, value: data[2] !== 0};
            case MessageType.number_command:
                return {option: data[1], type, value: readDouble(data, 2)};
        }
    }

    private readonly consumer: (msg: Message) => Promise<any>;
    private buffer: number[] = [];

    public constructor(consumer: (msg: Message) => Promise<any>) {
        this.consumer = consumer;
    }

    public onData(data: Buffer) {
        this.buffer.push(...data);
        while (this.processFrame()) { }
    }

    private processFrame(): boolean {
        if (this.buffer.length < 2) { return false; }
        const actualLength = this.buffer[0] + 2;  // +2: type and length
        if (this.buffer.length < actualLength) { return false; }
        const messageBytes = this.buffer.slice(1, actualLength);
        this.buffer = this.buffer.slice(actualLength);
        this.consumer(Parser.fromBytes(messageBytes))
            .catch((err) => console.log("While processing command message: ", err));
        return true;
    }
}
