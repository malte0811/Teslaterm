import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionStatus, IUD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {MenuBar, MenuControlLevel} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Toasts} from "./Toasts";

export interface ControlTabProps {
    ttConfig: TTConfig;
    // TODO move "full" disconnect button into tab row in multi-coil settings
    darkMode: boolean;
    ud3state: IUD3State;
}

export class CentralControlTab extends TTComponent<ControlTabProps, {}> {
    public componentDidMount() {
        // TODO only for this coil!
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render() {
        return (
            <div className={'tt-coil-tab'}>
                <div className={'tt-menu-bar'}>
                    <MenuBar
                        ud3state={this.props.ud3state}
                        connectionStatus={ConnectionStatus.CONNECTED}
                        ttConfig={this.props.ttConfig}
                        darkMode={this.props.darkMode}
                        level={MenuControlLevel.central_control}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            <Oscilloscope/>
                            <Sliders
                                // TODO only allow relative ontime here
                                ud3State={this.props.ud3state}
                                disabled={false}
                                enableMIDI={this.props.ttConfig.useMIDIPorts}
                                darkMode={this.props.darkMode}
                            />
                        </div>
                        TODO: Something to select single-coil telemetry to show in the central tab should go here
                    </div>
                    <Gauges darkMode={this.props.darkMode}/>
                </div>
                <Toasts darkMode={this.props.darkMode}/>
            </div>
        );
    }
}
