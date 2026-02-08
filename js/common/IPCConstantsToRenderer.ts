import {CoilID, coilSuffix, UD3AlarmLevel} from "./constants";
import {InitialFRState, ParsedEvent} from "./FlightRecorderTypes";
import {MediaFileType, PlayerActivity} from './MediaTypes';
import {AllFaders, MixerLayer} from "./MixerTypes";
import {SingleConnectionOptions} from "./SingleConnectionOptions";
import {TTConfig} from "./TTConfig";
import {SyncedUIConfig} from "./UIConfig";

// The type parameter is purely a compile-time safeguard to make sure both sides agree on what data should be sent over
// this channel
export interface IPCToRendererKey<Type> {
    channel: string;
}

function makeKey<Type>(channel: string): IPCToRendererKey<Type> {
    return {channel};
}

export const IPC_CONSTANTS_TO_RENDERER = {
    centralTab: {
        informTelemetryNames: makeKey<string[]>('present-telemetry-names'),
        setCentralTelemetry: makeKey<[CoilID, CentralTelemetryValue[]]>('central-telemetry'),
        setMixerLayer: makeKey<[MixerLayer, AllFaders]>('set-mixer-layer'),
        setSongList: makeKey<SongListData>('songlist'),
    },
    connect: {
        setSerialSuggestions: makeKey<AvailableSerialPort[]>('suggest-serial'),
        setUDPSuggestions: makeKey<IUDPConnectionSuggestion[]>('suggest-udp'),
    },
    flightRecorder: {
        fullList: makeKey<{events: ParsedEvent[], initial: InitialFRState}>('fr-event-list'),
    },
    menu: {
        setMediaTitle: makeKey<string>('menu-media-title'),
        setScriptName: makeKey<string>('menu-script-name'),
    },
    openToastOn: makeKey<[ToastData, CoilID?]>('open-toast-coil'),
    redrawMedia: makeKey<MediaState>('scope-draw-media'),
    registerCoil: makeKey<[coil: CoilID, multicoil: boolean]>('register-coil'),
    script: {
        requestConfirm: makeKey<ConfirmationRequest>('script-request-confirm'),
    },
    ttConfig: makeKey<TTConfig>('tt-config'),
    uiConfig: makeKey<SyncedUIConfig>('uiConfig'),
};

export function getToRenderIPCPerCoil(coil: CoilID) {
    const suffix = coilSuffix(coil);
    const makeCoilKey = <Type>(channel: string) => makeKey<Type>(channel + suffix);
    return {
        alarmList: makeCoilKey<UD3Alarm[]>('alarms'),
        meters: {
            configure: makeCoilKey<MeterConfig>('meter-config'),
            setValue: makeCoilKey<SetMeters>('meter-set-value'),
        },
        scope: {
            addValues: makeCoilKey<ScopeValues>('scope-values'),
            configure: makeCoilKey<ScopeTraceConfig>('scope-config'),
            drawLine: makeCoilKey<ScopeLine>('scope-draw-line'),
            drawString: makeCoilKey<ScopeText>('scope-draw-string'),
            startControlled: makeCoilKey<string>('scope-start-controlled'),
        },
        sliders: {
            syncSettings: makeCoilKey<ISliderState>('slider-sync'),
        },
        terminal: makeCoilKey<string>('terminal'),
        udConfig: makeCoilKey<UD3ConfigOption[]>('ud-config'),
        udName: makeKey<string>('ud-name'),
        udState: makeKey<UD3State>('menu-ud3-state'),
        updateConnectionState: makeKey<ConnectionStatus>('update-connection-state'),
    };
}

export type PerCoilRenderIPCs = ReturnType<typeof getToRenderIPCPerCoil>;

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

export interface CentralTelemetryValue {
    readonly valueName: string;
    readonly min: number;
    readonly max: number;
    readonly value: number;
}

export interface UD3State {
    readonly busActive: boolean;
    readonly busControllable: boolean;
    readonly transientActive: boolean;
    readonly killBitSet: boolean;
    readonly isQCW: boolean;
}

export function ud3StateEquals(first: UD3State, second: UD3State) {
    if (first.busActive !== second.busActive) { return false; }
    if (first.busControllable !== second.busControllable) { return false; }
    if (first.transientActive !== second.transientActive) { return false; }
    if (first.killBitSet !== second.killBitSet) { return false; }
    if (first.isQCW !== second.isQCW) { return false; }
    return true;
}

export const DEFAULT_UD3_STATE: UD3State = {
    busActive: false,
    busControllable: true,
    isQCW: false,
    killBitSet: false,
    transientActive: false,
};

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
    readonly progressPercent: number;
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
    readonly volumeFraction: number;
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
    options: SingleConnectionOptions;
}

export type ChannelID = number;

export type FaderID = number;

export interface SongListData {
    songs: string[];
    current: number;
}

