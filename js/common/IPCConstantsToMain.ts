export const IPC_CONSTANTS_TO_MAIN = {
    commands: {
        saveEEPROM: "save-eeprom",
        setBusState: "set-bus-state",
        setKillState: "set-tr-state",
        setParms: "set-parms",
        setTRState: "set-kill-state",
    },
    connect: "connect-to-ud3",
    requestConnectSuggestions: "request-connect-suggestions",
    loadFile: "load-file",
    manualCommand: "manual-command",
    menu: {
        connectButton: "press-connect-button",
        requestUDConfig: "ud-config",
        startMedia: "start-media",
        stopMedia: "stop-media",
    },
    midiMessage: "midi-message",
    requestFullSync: "request-full-sync",
    script: {
        confirmOrDeny: "script-confirm",
        startScript: "start-script",
        stopScript: "stop-script",
    },
    sliders: {
        setBPS: "slider-set-bps",
        setBurstOfftime: "slider-set-burst-offtime",
        setBurstOntime: "slider-set-burst-ontime",
        setOntimeAbsolute: "slider-set-ontime-abs",
        setOntimeRelative: "slider-set-ontime-rel",
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
