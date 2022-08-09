import React from "react";
import {Button, ButtonGroup, ButtonToolbar} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {ConnectionStatus, IPC_CONSTANTS_TO_RENDERER, IUD3State} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {CommandsMenuItem} from "./Commands";
import {Killbit} from "./Killbit";
import {StartStopMenuItem} from "./StartStopItem";

export interface MenuProps {
    connectionStatus: ConnectionStatus;
    ud3state: IUD3State;
    ttConfig: TTConfig;
    clearWasConnected: () => any;
}

export class MenuBar extends TTComponent<MenuProps, {}> {
    render(): React.ReactNode {
        const connectionBtnText = (() => {
            switch (this.props.connectionStatus) {
                case ConnectionStatus.IDLE:
                    return "Close";
                case ConnectionStatus.CONNECTING:
                case ConnectionStatus.RECONNECTING:
                    return "Abort connection";
                case ConnectionStatus.CONNECTED:
                    return "Disconnect";
                case ConnectionStatus.BOOTLOADING:
                    return "Abort bootloading";
            }
        })();
        const allowInteraction = this.props.connectionStatus == ConnectionStatus.CONNECTED;
        return <ButtonToolbar className="justify-content-between">
            <ButtonGroup>
                <CommandsMenuItem
                    udState={this.props.ud3state}
                    ttConfig={this.props.ttConfig}
                    disabled={!allowInteraction}
                />
                <StartStopMenuItem
                    startKey={IPC_CONSTANTS_TO_MAIN.menu.startMedia}
                    stopKey={IPC_CONSTANTS_TO_MAIN.menu.stopMedia}
                    dataKey={IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle}
                    disabled={!allowInteraction}
                />
                <StartStopMenuItem
                    startKey={IPC_CONSTANTS_TO_MAIN.script.startScript}
                    stopKey={IPC_CONSTANTS_TO_MAIN.script.stopScript}
                    dataKey={IPC_CONSTANTS_TO_RENDERER.menu.setScriptName}
                    disabled={!allowInteraction}
                />
            </ButtonGroup>
            <Killbit killbit={this.props.ud3state.killBitSet} disabled={!allowInteraction}/>
            <Button
                onClick={() => this.onConnectionButton()}
                variant={"warning"}
            >{connectionBtnText}</Button>
        </ButtonToolbar>;
    }

    onConnectionButton() {
        if (this.props.connectionStatus == ConnectionStatus.IDLE) {
            this.props.clearWasConnected();
        } else {
            processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.connectButton, undefined);
        }
    }
}
