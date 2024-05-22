import React from "react";
import {CoilID} from "../../common/constants";
import {ConnectionStatus, IUD3State, UD3State} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {SyncedUIConfig} from "../../common/UIConfig";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {TerminalRef} from "./MainScreen";
import {MenuBar} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Terminal} from "./Terminal";
import {Toasts, ToastsProps} from "./Toasts";

export type TabControlLevelBase<Single, Central> =
    ({ level: 'single-coil' | 'combined' } & Single) |
    ({ level: 'central-control' } & Central);

export type TabControlLevel = TabControlLevelBase<{ coil: CoilID }, {}>;

export interface SingleCoilTabProps {
    terminal: TerminalRef;
    allowInteraction: boolean;
    ttConfig: TTConfig;
    connectionStatus: ConnectionStatus;
    coil: CoilID;
    ud3State: IUD3State;
    toasts: ToastsProps;
    level: 'single-coil' | 'combined';
    returnToConnect: () => any;
    config: SyncedUIConfig;
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
                        darkMode={this.props.config.darkMode}
                        level={{level: this.props.level, coil: this.props.coil, state: this.props.ud3State}}
                        returnToConnect={this.props.returnToConnect}
                    />
                </div>
                <div className={'tt-terminal-and-gauges'}>
                    <div className={'tt-terminal-container'}>
                        <div className={'tt-scope-container'}>
                            <Oscilloscope coil={this.props.coil}/>
                            <Sliders
                                disabled={!this.props.allowInteraction}
                                enableMIDI={this.props.config.advancedOptions.enableMIDIInput}
                                darkMode={this.props.config.darkMode}
                                level={{level: this.props.level, coil: this.props.coil, ud3State: this.props.ud3State}}
                            />
                        </div>
                        <Terminal
                            terminal={this.props.terminal}
                            disabled={!this.props.allowInteraction}
                            coil={this.props.coil}
                        />
                    </div>
                    <Gauges darkMode={this.props.config.darkMode} coil={this.props.coil}/>
                </div>
                <Toasts {...this.props.toasts}/>
            </div>
        );
    }
}
