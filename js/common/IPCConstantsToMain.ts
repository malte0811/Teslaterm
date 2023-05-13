import {ConnectionOptions} from './ConnectionOptions';
import {ConnectionPreset} from "./IPCConstantsToRenderer";

// The type parameter is purely a compile-time safeguard to make sure both sides agree on what data should be sent over
// this channel
export interface IPCToMainKey<Type> {
    channel: string;
}

function makeKey<Type>(channel: string): IPCToMainKey<Type> {
    return {channel};
}

export const IPC_CONSTANTS_TO_MAIN = {
    commands: {
        saveEEPROM: makeKey<undefined>('save-eeprom'),
        setBusState: makeKey<boolean>('set-bus-state'),
        setKillState: makeKey<boolean>('set-kill-state'),
        setParms: makeKey<Map<string, string>>('set-parms'),
        setTRState: makeKey<boolean>('set-tr-state'),
    },
    loadFile: makeKey<DroppedFile>('load-file'),
    manualCommand: makeKey<string>('manual-command'),
    connect: {
        connect: makeKey<ConnectionOptions>('connect-to-ud3'),
        requestSuggestions: makeKey<undefined>('request-connect-suggestions'),
        getPresets: makeKey<undefined>('get-connect-presets'),
        setPresets: makeKey<ConnectionPreset[]>('set-connect-presets'),
    },
    menu: {
        connectButton: makeKey<undefined>('press-connect-button'),
        requestUDConfig: makeKey<undefined>('request-ud-config'),
        startMedia: makeKey<undefined>('start-media'),
        stopMedia: makeKey<undefined>('stop-media'),
        requestAlarmList: makeKey<undefined>('request-alarms'),
    },
    midiMessage: makeKey<Uint8Array>('midi-message'),
    requestFullSync: makeKey<undefined>('request-full-sync'),
    script: {
        confirmOrDeny: makeKey<ConfirmReply>('script-confirm'),
        startScript: makeKey<undefined>('start-script'),
        stopScript: makeKey<undefined>('stop-script'),
    },
    setDarkMode: makeKey<boolean>('setDarkMode'),
    sliders: {
        setBPS: makeKey<number>('slider-set-bps'),
        setBurstOfftime: makeKey<number>('slider-set-burst-offtime'),
        setBurstOntime: makeKey<number>('slider-set-burst-ontime'),
        setOntimeAbsolute: makeKey<number>('slider-set-ontime-abs'),
        setOntimeRelative: makeKey<number>('slider-set-ontime-rel'),
    },
};

export class TransmittedFile {
    public readonly name: string;
    public readonly contents: Uint8Array;

    constructor(name: string, contents: Uint8Array) {
        this.name = name;
        this.contents = contents;
    }
}

export class ConfirmReply {
    public readonly confirmed: boolean;
    public readonly requestID: number;

    constructor(confirmed: boolean, id: number) {
        this.confirmed = confirmed;
        this.requestID = id;
    }
}

export interface DroppedFile {
    name: string;
    bytes: number[];
}
