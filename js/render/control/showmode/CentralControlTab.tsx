import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {ConnectionStatus} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {SyncedUIConfig} from "../../../common/UIConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {CoilState} from "../MainScreen";
import {MenuBar} from "../menu/Menu";
import {Sliders} from "../sliders/Sliders";
import {Toasts, ToastsProps} from "../Toasts";
import {Mixer} from "./mixer/Mixer";
import {TelemetryOverview} from "./TelemetryOverview";

export interface ControlTabProps {
    ttConfig: TTConfig;
    config: SyncedUIConfig;
    coils: CoilState[];
    toasts: ToastsProps;
}

export class CentralControlTab extends TTComponent<ControlTabProps, {}> {
    public componentDidMount() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render() {
        const connectedCoils = this.props.coils.filter((c) => c?.connection === ConnectionStatus.CONNECTED);
        const numDisconnected = this.props.coils.length - connectedCoils.length;
        const numKilled = connectedCoils.filter((c) => c.ud.killBitSet).length;
        return (
            <div className={'tt-coil-tab'}>
                <div className={'tt-menu-bar'}>
                    <MenuBar
                        connectionStatus={ConnectionStatus.CONNECTED}
                        ttConfig={this.props.ttConfig}
                        level={{
                            level: 'central-control',
                            numCoils: this.props.coils.length,
                            numDisconnected,
                            numKill: numKilled,
                        }}
                        returnToConnect={() => {
                        }}
                    />
                </div>
                <div className={'tt-central-telemetry-and-sliders'}>
                    <TelemetryOverview coils={this.props.coils}/>
                    <Sliders
                        disabled={false}
                        enableMIDI={this.props.config.advancedOptions.enableMIDIInput}
                        level={{level: 'central-control'}}
                    />
                </div>
                <Mixer
                    coils={this.props.coils}
                    ttConfig={this.props.ttConfig}
                    availablePrograms={this.props.config.midiPrograms}
                />
                <Toasts {...this.props.toasts}/>
            </div>
        );
    }
}
