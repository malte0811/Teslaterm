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
    alarmList: makeKey<UD3Alarm[]>('alarms'),
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
    openToast: makeKey<ToastData>('open-toast'),
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
    syncDarkMode: makeKey<boolean>('syncDarkMode'),
    terminal: makeKey<string>('terminal'),
    ttConfig: makeKey<TTConfig>('tt-config'),
    udConfig: makeKey<UD3ConfigOption[]>('ud-config'),
    updateConnectionState: makeKey<ConnectionStatus>('update-connection-state'),
};

export interface SetMeters {
    readonly values: { [id: number]: number };
}

export interface MeterConfig {
    readonly meterId: number;
    readonly min: number;
    readonly max: number;
    readonly scale: number;
    readonly name: string;
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

export interface ScopeTraceConfig {
    readonly id: number;
    readonly min: number;
    readonly max: number;
    readonly offset: number;
    readonly div: number;
    readonly unit: string;
    readonly name: string;
}

export interface ScopeValues {
    readonly values: Array<{ [key: number]: number }>;
}

export interface ScopeLine {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly traceColorIndex: number;
}

export interface ScopeText {
    readonly x: number;
    readonly y: number;
    readonly traceColorIndex: number;
    readonly size: number;
    readonly str: string;
    readonly center: boolean;
}

export interface MediaState {
    readonly progress: number;
    readonly state: PlayerActivity;
    readonly title: string;
    readonly type: MediaFileType;
}

export interface ConfirmationRequest {
    readonly confirmationID: number;
    readonly message: string;
    readonly title: string | undefined;
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

