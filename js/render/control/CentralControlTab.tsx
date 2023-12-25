import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionStatus, UD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {MenuBar} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Toasts, ToastsProps} from "./Toasts";

export interface ControlTabProps {
    ttConfig: TTConfig;
    // TODO move "full" disconnect button into tab row in multi-coil settings
    darkMode: boolean;
    numCoils: number;
    numKilled: number;
    toasts: ToastsProps;
}

export class CentralControlTab extends TTComponent<ControlTabProps, {}> {
    public componentDidMount() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render() {
        // TODO Fix telemetry
        // TODO Get rid of UD3State.DEFAULT_STATE(?)
        // TODO start at 0 relative+absolute ontime in multicoil? Or 0 relative, 100 absolute?
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
                            <Oscilloscope coil={-1}/>
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
                    <Gauges darkMode={this.props.darkMode} coil={-1}/>
                </div>
                <Toasts {...this.props.toasts}/>
            </div>
        );
    }
}
