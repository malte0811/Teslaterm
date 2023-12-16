import React from "react";
import {CoilID} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConnectionStatus,
    getToRenderIPCPerCoil,
    IUD3State,
    UD3State
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {TerminalRef} from "./MainScreen";
import {MenuBar} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Terminal} from "./Terminal";
import {Toasts} from "./Toasts";

export type TabControlLevel = {
    level: 'single-coil' | 'combined';
    coil: CoilID;
} | {level: 'central-control'};

export interface SingleCoilTabProps {
    terminal: TerminalRef;
    allowInteraction: boolean;
    ttConfig: TTConfig;
    connectionStatus: ConnectionStatus;
    darkMode: boolean;
    coil: CoilID;
}

interface SingleCoilTabState {
    ud3State: IUD3State;
}

export class SingleCoilTab extends TTComponent<SingleCoilTabProps, SingleCoilTabState> {
    constructor(props) {
        super(props);
        this.state = {ud3State: UD3State.DEFAULT_STATE};
    }

    public componentDidMount() {
        // TODO only for this coil!
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
        this.addIPCListener(
            getToRenderIPCPerCoil(this.props.coil).menu.ud3State,
            (state) => this.setState({ud3State: state}),
        );
    }

    public render() {
        return (
            <div className={'tt-coil-tab'}>
                <div className={'tt-menu-bar'}>
                    <MenuBar
                        ud3state={this.state.ud3State}
                        connectionStatus={this.props.connectionStatus}
                        ttConfig={this.props.ttConfig}
                        darkMode={this.props.darkMode}
                        level={{level: 'single-coil', coil: this.props.coil}}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            <Oscilloscope coil={this.props.coil}/>
                            <Sliders
                                ud3State={this.state.ud3State}
                                disabled={!this.props.allowInteraction}
                                enableMIDI={this.props.ttConfig.useMIDIPorts}
                                darkMode={this.props.darkMode}
                                level={{level: 'single-coil', coil: this.props.coil}}
                            />
                        </div>
                        <Terminal
                            terminal={this.props.terminal}
                            disabled={!this.props.allowInteraction}
                            coil={this.props.coil}
                        />
                    </div>
                    <Gauges darkMode={this.props.darkMode} coil={this.props.coil}/>
                </div>
                <Toasts darkMode={this.props.darkMode}/>
            </div>
        );
    }
}
