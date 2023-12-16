import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionStatus, IUD3State, UD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {MenuBar} from "./menu/Menu";
import {Sliders} from "./sliders/Sliders";
import {Toasts} from "./Toasts";

export interface ControlTabProps {
    ttConfig: TTConfig;
    // TODO move "full" disconnect button into tab row in multi-coil settings
    darkMode: boolean;
    numCoils: number;
    numKilled: number;
}

export class CentralControlTab extends TTComponent<ControlTabProps, {}> {
    public componentDidMount() {
        // TODO only for this coil!
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render() {
        // TODO get rid of UD3State.DEFAULT_STATE here
        return (
            <div className={'tt-coil-tab'}>
                <div className={'tt-menu-bar'}>
                    <MenuBar
                        connectionStatus={ConnectionStatus.CONNECTED}
                        ttConfig={this.props.ttConfig}
                        darkMode={this.props.darkMode}
                        level={{level: 'central-control', numCoils: this.props.numCoils, numKill: this.props.numKilled}}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            {/*TODO <Oscilloscope/>*/}
                            <Sliders
                                ud3State={UD3State.DEFAULT_STATE}
                                disabled={false}
                                enableMIDI={this.props.ttConfig.useMIDIPorts}
                                darkMode={this.props.darkMode}
                                level={{level: 'central-control'}}
                            />
                        </div>
                        TODO: Something to select single-coil telemetry to show in the central tab should go here
                    </div>
                    {/*TODO <Gauges darkMode={this.props.darkMode}/>*/}
                </div>
                <Toasts darkMode={this.props.darkMode}/>
            </div>
        );
    }
}
