import React from "react";
import {CoilID} from "../../common/constants";
import {ConnectionStatus, IUD3State, UD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {TerminalRef} from "./MainScreen";
import {MenuBar} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Terminal} from "./Terminal";
import {Toasts, ToastsProps} from "./Toasts";

export type TabControlLevelBase<Single, Central> =
    ({ level: 'single-coil' | 'combined'; } & Single) |
    ({ level: 'central-control' } & Central);

export type TabControlLevel = TabControlLevelBase<{ coil: CoilID }, {}>;

export interface SingleCoilTabProps {
    terminal: TerminalRef;
    allowInteraction: boolean;
    ttConfig: TTConfig;
    connectionStatus: ConnectionStatus;
    darkMode: boolean;
    coil: CoilID;
    ud3State: IUD3State;
    toasts: ToastsProps;
}

export class SingleCoilTab extends TTComponent<SingleCoilTabProps, {}> {
    constructor(props) {
        super(props);
        this.state = {ud3State: UD3State.DEFAULT_STATE};
    }

    public render() {
        return (
            <div className={'tt-coil-tab'}>
                <div className={'tt-menu-bar'}>
                    <MenuBar
                        connectionStatus={this.props.connectionStatus}
                        ttConfig={this.props.ttConfig}
                        darkMode={this.props.darkMode}
                        level={{level: 'single-coil', coil: this.props.coil, state: this.props.ud3State}}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            <Oscilloscope coil={this.props.coil}/>
                            <Sliders
                                ud3State={this.props.ud3State}
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
                <Toasts {...this.props.toasts}/>
            </div>
        );
    }
}
