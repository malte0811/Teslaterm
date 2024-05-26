import {CoilID} from "../../common/constants";
import {FlightEventType} from "../../common/FlightRecorderTypes";
import {ConnectionStatus, ToastSeverity} from "../../common/IPCConstantsToRenderer";
import {PlayerActivity} from "../../common/MediaTypes";
import {AdvancedOptions} from "../../common/Options";
import {MultiConnectionOptions, SingleConnectionOptions} from "../../common/SingleConnectionOptions";
import {sleep} from "../helper";
import {ipcs} from "../ipc/IPCProvider";
import {setRelativeOntime} from "../ipc/sliders";
import * as media from "../media/media_player";
import {media_state} from "../media/media_player";
import {BehringerXTouch} from "../media/PhysicalMixer";
import {setLastConnectionOptions, setUIConfig} from "../UIConfigHandler";
import {CommandInterface} from "./commands";
import {ExtraConnections} from "./ExtraConnections";
import {getFlightRecorder} from "./flightrecorder/FlightRecorder";
import {Connected} from "./state/Connected";
import {IConnectionState} from "./state/IConnectionState";
import {Idle} from "./state/Idle";
import {TerminalHandle, UD3Connection} from "./types/UD3Connection";

const connectionState: Map<CoilID, IConnectionState> = new Map<CoilID, IConnectionState>();
let extraConnections: ExtraConnections;

export function getCoilCommands(coil: CoilID) {
    return new CommandInterface(coil);
}

export function getConnectionState(coil: CoilID) {
    // TODO what if uninit?
    return connectionState.get(coil);
}

export function getCoils() {
    return connectionState.keys();
}

export function numCoils() {
    return connectionState.size;
}

export function initializeExtraConnections(options: AdvancedOptions, multicoil: boolean) {
    extraConnections = new ExtraConnections(options, multicoil);
}

export function findCoilByName(name: string): CoilID | undefined {
    for (const coil of getCoils()) {
        if (name === getOptionalUD3Connection(coil)?.getUDName()) {
            return coil;
        }
    }
    return undefined;
}

export function clearCoils() {
    connectionState.clear();
    ipcs.clearCoils();
    if (extraConnections) {
        extraConnections.close();
        extraConnections = undefined;
    }
    nextCoilID = 0;
    // TODO clear e.g. SID caches
}

export function getPhysicalMixer(): BehringerXTouch | undefined {
    return extraConnections?.getPhysicalMixer();
}

export function isMulticoil(): boolean | undefined {
    return extraConnections?.isMulticoil();
}

export function forEachCoilAsync<T>(apply: (coil: CoilID) => Promise<T>) {
    return Promise.all(forEachCoil(apply));
}

export function forEachCoil<T>(apply: (coil: CoilID) => T) {
    return [...getCoils()].map(apply);
}

export function setConnectionState(coil: CoilID, newState: IConnectionState) {
    const lastStatus = connectionState.has(coil) ?
        connectionState.get(coil).getConnectionStatus() :
        ConnectionStatus.IDLE;
    connectionState.set(coil, newState);
    const newStatus = newState.getConnectionStatus();
    if (newStatus !== lastStatus) {
        console.log('Update on ', coil, ':', newStatus);
        ipcs.coilMisc(coil).setConnectionState(newStatus);
        getFlightRecorder(coil).addEvent(FlightEventType.connection_state_change, [newStatus]);
    }
}

export async function startConf(coil: CoilID) {
    const commands = getCoilCommands(coil);
    const sliderIPC = ipcs.sliders(coil);
    await commands.sendCommand('\r');
    await sliderIPC.resetOntimeOnConnect();
    await commands.setBPS(sliderIPC.bps);
    await commands.setBurstOntime(sliderIPC.burstOntime);
    await commands.setBurstOfftime(sliderIPC.burstOfftime);
    await getUD3Connection(coil).setSynthByFiletype(media_state.type, false);
    await commands.resetKill();
    await commands.startTelemetry();
    ipcs.mixer.sendVolumesTo(coil);
}

export async function disconnectFrom(coil: CoilID) {
    setConnectionState(coil, await getConnectionState(coil).disconnectFromCoil());
}

export function startBootloading(coil: CoilID, cyacd: Uint8Array): boolean {
    const coilState = getConnectionState(coil);
    if (coilState instanceof Connected) {
        const newConnection = coilState.startBootloading(cyacd);
        if (newConnection) {
            setConnectionState(coil, newConnection);
            return true;
        }
    }
    return false;
}

export function getConnectedCoils(): CoilID[] {
    return [...connectionState.entries()]
        .filter(([id, state]) => state.getConnectionStatus() === ConnectionStatus.CONNECTED)
        .map(([id]) => id);
}

function allCoilsPermanentlyDisconnected() {
    for (const connection of connectionState.values()) {
        if (connection.getConnectionStatus() !== ConnectionStatus.IDLE) {
            return false;
        }
    }
    return true;
}

export function updateFast() {
    for (const [coil, coilState] of connectionState.entries()) {
        setConnectionState(coil, coilState.tickFast());
    }
    if (allCoilsPermanentlyDisconnected() && media.media_state.state === PlayerActivity.playing) {
        ipcs.misc.openGenericToast(
            'Stopping playback', 'All coil connected permanently lost, stopping playback', ToastSeverity.error,
        );
        media.media_state.stopPlaying();
    }
}

export function updateSlow(): void {
    for (const coilState of connectionState.values()) {
        coilState.tickSlow();
    }
}

export function getUD3Connection(coil: CoilID): UD3Connection {
    const ret = getConnectionState(coil).getActiveConnection();
    if (!ret) {
        throw new Error("No connection is currently active");
    }
    return ret;
}

export function getOptionalUD3Connection(coil: CoilID): UD3Connection | undefined {
    return getConnectionState(coil).getActiveConnection();
}

export function getAutoTerminal(coil: CoilID): TerminalHandle | undefined {
    return getConnectionState(coil).getAutoTerminal();
}

export function hasUD3Connection(coil: CoilID): boolean {
    const connectionState = getConnectionState(coil);
    return connectionState && connectionState.getActiveConnection() !== undefined;
}

export async function singleConnect(args: SingleConnectionOptions) {
    setUIConfig({advancedOptions: args.advanced});
    setLastConnectionOptions(args);
    await setRelativeOntime(100);
    initializeExtraConnections(args.advanced, false);
    await new Idle(args).connect(makeNewCoilID());
}

export async function multiConnect(args: MultiConnectionOptions) {
    setUIConfig({advancedOptions: args.advanced});
    await setRelativeOntime(0);
    initializeExtraConnections(args.advanced, true);
    await Promise.all(args.ud3Options.map(
        async (coilArg, i) => {
            await sleep(100 * i);
            await new Idle(coilArg).connect(makeNewCoilID());
        },
    ));
}

let nextCoilID = 0;

function makeNewCoilID(): CoilID {
    const id: CoilID = nextCoilID++;
    ipcs.initCoilIPC(id);
    return id;
}
