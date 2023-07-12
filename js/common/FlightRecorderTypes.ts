export enum FREventType {
    terminal_data,
    terminal_start_stop,
    telemetry,
    feature_sync,
    set_synth,
    unknown,
}

export function getEventTypeDesc(ev: FREventType) {
    switch (ev) {
        case FREventType.terminal_data:
            return 'Terminal data';
        case FREventType.terminal_start_stop:
            return 'Terminal start/stop';
        case FREventType.telemetry:
            return 'Telemetry';
        case FREventType.feature_sync:
            return 'Feature sync';
        case FREventType.set_synth:
            return 'Synth change';
        case FREventType.unknown:
            return 'Unknown';
    }
}

interface ParsedEventBase {
    time: number;
    toUD3: boolean;
    desc: string;
}

type ParsedEventExtra = {type: FREventType.terminal_data, printed: string} |
    // TODO include telemetry in usable format rather than plain JSON
    {type: FREventType.telemetry} |
    {type: FREventType.feature_sync | FREventType.terminal_start_stop | FREventType.set_synth | FREventType.unknown};

export type ParsedEvent = ParsedEventBase & ParsedEventExtra;

export type FREventSet = {
    [K in FREventType]: boolean;
};

export function makeEmptyEventSet(): FREventSet {
    return {
        [FREventType.terminal_data]: false,
        [FREventType.terminal_start_stop]: false,
        [FREventType.telemetry]: false,
        [FREventType.feature_sync]: false,
        [FREventType.set_synth]: false,
        [FREventType.unknown]: false,
    };
}

export const allFREvents = (() => {
    const values: FREventType[] = [];
    for (const candidate of Object.values(FREventType)) {
        if (typeof(candidate) !== 'string') {
            values.push(candidate);
        }
    }
    return values;
})();

