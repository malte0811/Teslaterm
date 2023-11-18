import React from "react";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {ConnectionStatus, IUD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {TerminalRef} from "./MainScreen";
import {MenuBar, MenuControlLevel} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Terminal} from "./Terminal";
import {Toasts} from "./Toasts";

export interface SingleCoilTabProps {
    terminal: TerminalRef;
    allowInteraction: boolean;
    ttConfig: TTConfig;
    connectionStatus: ConnectionStatus;
    darkMode: boolean;
    ud3state: IUD3State;
}

export class SingleCoilTab extends TTComponent<SingleCoilTabProps, {}> {
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
                        connectionStatus={this.props.connectionStatus}
                        ttConfig={this.props.ttConfig}
                        darkMode={this.props.darkMode}
                        level={MenuControlLevel.single_coil}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            <Oscilloscope/>
                            <Sliders
                                ud3State={this.props.ud3state}
                                disabled={!this.props.allowInteraction}
                                enableMIDI={this.props.ttConfig.useMIDIPorts}
                                darkMode={this.props.darkMode}
                            />
                        </div>
                        <Terminal
                            terminal={this.props.terminal}
                            disabled={!this.props.allowInteraction}
                        />
                    </div>
                    <Gauges darkMode={this.props.darkMode}/>
                </div>
                <Toasts darkMode={this.props.darkMode}/>
            </div>
        );
    }
}
