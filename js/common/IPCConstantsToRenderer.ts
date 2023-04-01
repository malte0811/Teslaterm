import {SliderState} from "../main/ipc/sliders";
import {MediaFileType, PlayerActivity} from './CommonTypes';
import {ConnectionOptions} from "./ConnectionOptions";
import {UD3AlarmLevel} from "./constants";
import {TTConfig} from "./TTConfig";

// The type parameter is purely a compile-time safeguard to make sure both sides agree on what data should be sent over
// this channel
export interface IPCToRendererKey<Type> {
    channel: string;
}

function makeKey<Type>(channel: string): IPCToRendererKey<Type> {
    return {channel};
}

export const IPC_CONSTANTS_TO_RENDERER = {
    connect: {
        connectionError: makeKey<string>('connection-error'),
        setSerialSuggestions: makeKey<AvailableSerialPort[]>('suggest-serial'),
        setUDPSuggestions: makeKey<IUDPConnectionSuggestion[]>('suggest-udp'),
        syncPresets: makeKey<ConnectionPreset[]>('sync-connect-sesets'),
    },
    menu: {
        setMediaTitle: makeKey<string>('menu-media-title'),
        setScriptName: makeKey<string>('menu-script-name'),
        ud3State: makeKey<UD3State>('menu-ud3-state'),
    },
    meters: {
        configure: makeKey<MeterConfig>('meter-config'),
        setValue: makeKey<SetMeters>('meter-set-value'),
    },
    scope: {
        addValues: makeKey<ScopeValues>('scope-values'),
        configure: makeKey<ScopeTraceConfig>('scope-config'),
        drawLine: makeKey<ScopeLine>('scope-draw-line'),
        drawString: makeKey<ScopeText>('scope-draw-string'),
        redrawMedia: makeKey<MediaState>('scope-draw-media'),
        startControlled: makeKey<undefined>('scope-start-controlled'),
    },
    script: {
        requestConfirm: makeKey<ConfirmationRequest>('script-request-confirm'),
    },
    sliders: {
        syncSettings: makeKey<ISliderState>('slider-sync'),
    },
    updateConnectionState: makeKey<ConnectionStatus>('update-connection-state'),
    terminal: makeKey<string>('terminal'),
    ttConfig: makeKey<TTConfig>('tt-config'),
    udConfig: makeKey<UD3ConfigOption[]>('ud-config'),
    openToast: makeKey<ToastData>('open-toast'),
    alarmList: makeKey<UD3Alarm[]>('alarms'),
};

export class SetMeters {
    public readonly values: { [id: number]: number };

    constructor(values: { [id: number]: number }) {
        this.values = values;
    }
}

export class MeterConfig {
    public readonly meterId: number;
    public readonly min: number;
    public readonly max: number;
    public readonly scale: number;
    public readonly name: string;

    constructor(meterId: number, min: number, max: number, scale: number, name: string) {
        this.meterId = meterId;
        this.min = min;
        this.max = max;
        this.scale = scale;
        this.name = name;
    }
}

export interface IUD3State {
    readonly busActive: boolean;
    readonly busControllable: boolean;
    readonly transientActive: boolean;
    readonly killBitSet: boolean;
}

export class UD3State implements IUD3State {
    public static DEFAULT_STATE = new UD3State(false, false, false, false);

    public readonly busActive: boolean;
    public readonly busControllable: boolean;
    public readonly transientActive: boolean;
    public readonly killBitSet: boolean;

    constructor(active: boolean, controllable: boolean, transientActive: boolean, killBitSet: boolean) {
        this.busActive = active;
        this.busControllable = controllable;
        this.transientActive = transientActive;
        this.killBitSet = killBitSet;
    }

    public equals(other: UD3State): boolean {
        return this.busActive === other.busActive &&
            this.busControllable === other.busControllable &&
            this.transientActive === other.transientActive &&
            this.killBitSet === other.killBitSet;
    }
}

export class ScopeTraceConfig {
    public readonly id: number;
    public readonly min: number;
    public readonly max: number;
    public readonly offset: number;
    public readonly div: number;
    public readonly unit: string;
    public readonly name: string;

    constructor(id: number, min: number, max: number, offset: number, div: number, unit: string, name: string) {
        this.id = id;
        this.min = min;
        this.max = max;
        this.offset = offset;
        this.div = div;
        this.unit = unit;
        this.name = name;
    }
}

export class ScopeValues {
    public readonly values: Array<{ [key: number]: number }>;

    constructor(values: Array<{ [key: number]: number }>) {
        this.values = values;
    }
}

export class ScopeLine {
    public readonly x1: number;
    public readonly y1: number;
    public readonly x2: number;
    public readonly y2: number;
    public readonly traceColorIndex: number;

    constructor(x1: number, y1: number, x2: number, y2: number, color: number) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.traceColorIndex = color;
    }
}

export class ScopeText {
    public readonly x: number;
    public readonly y: number;
    public readonly traceColorIndex: number;
    public readonly size: number;
    public readonly str: string;
    public readonly center: boolean;


    constructor(x: number, y: number, color: number, size: number, str: string, center: boolean) {
        this.x = x;
        this.y = y;
        this.traceColorIndex = color;
        this.size = size;
        this.str = str;
        this.center = center;
    }
}

export class MediaState {
    public readonly progress: number;
    public readonly state: PlayerActivity;
    public readonly title: string;
    public readonly type: MediaFileType;

    constructor(progress: number, state: PlayerActivity, title: string, type: MediaFileType) {
        this.progress = progress;
        this.state = state;
        this.title = title;
        this.type = type;
    }
}

export class ConfirmationRequest {
    public readonly confirmationID: number;
    public readonly message: string;
    public readonly title: string | undefined;

    constructor(id: number, message: string, title?: string) {
        this.confirmationID = id;
        this.message = message;
        this.title = title;
    }
}

export interface ISliderState {
    readonly ontimeAbs: number;
    readonly ontimeRel: number;
    readonly bps: number;
    readonly burstOntime: number;
    readonly burstOfftime: number;
    readonly onlyMaxOntimeSettable: boolean;
    readonly maxOntime: number;
    readonly maxBPS: number;
    readonly startAtRelativeOntime: boolean;
}

export interface IUDPConnectionSuggestion {
    remoteIP: string;
    desc?: string;
}

export enum ConnectionStatus {
    IDLE,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    BOOTLOADING,
}

export enum UD3ConfigType {
    TYPE_UNSIGNED,
    TYPE_SIGNED,
    TYPE_FLOAT,
    TYPE_STRING,
}

export interface UD3ConfigOption {
    type: UD3ConfigType;
    name: string;
    help: string;
    min?: number;
    max?: number;
    current: string;
}

export enum ToastSeverity {
    info,
    warning,
    error,
}

export interface ToastData {
    title: string;
    message: string;
    level: ToastSeverity;
    mergeKey?: string;
}

export interface AvailableSerialPort {
    path: string;
    manufacturer: string;
    vendorID: string;
    productID: string;
}

export interface UD3Alarm {
    message: string;
    level: UD3AlarmLevel;
    timestamp: number;
    value?: number;
}

export interface ConnectionPreset {
    name: string;
    options: ConnectionOptions;
}

