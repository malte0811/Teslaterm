import React from "react";
import {Button, ButtonGroup, ButtonToolbar} from "react-bootstrap";
import {CoilID} from "../../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {ConnectionStatus, IPC_CONSTANTS_TO_RENDERER, IUD3State} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TabControlLevel} from "../SingleCoilTab";
import {CentralKillbit} from "./CentralKillbit";
import {CommandsMenuItem} from "./Commands";
import {Killbit} from "./Killbit";
import {StartStopMenuItem} from "./StartStopItem";

export interface MenuProps {
    level: TabControlLevel;
    connectionStatus: ConnectionStatus;
    ud3state: IUD3State;
    ttConfig: TTConfig;
    darkMode: boolean;
}

export class MenuBar extends TTComponent<MenuProps, {}> {
    public render(): React.ReactNode {
        const connectionBtnDisabled = this.props.connectionStatus === ConnectionStatus.IDLE;
        const connectionBtnText = (() => {
            switch (this.props.connectionStatus) {
                case ConnectionStatus.CONNECTING:
                case ConnectionStatus.RECONNECTING:
                    return "Abort connection";
                case ConnectionStatus.IDLE:
                case ConnectionStatus.CONNECTED:
                    return "Disconnect";
                case ConnectionStatus.BOOTLOADING:
                    return "Abort bootloading";
            }
        })();
        const allowInteraction = this.props.connectionStatus === ConnectionStatus.CONNECTED;
        const killbitElement = (() => {
            if (this.props.level.level !== 'central-control') {
                return <Killbit
                    killbit={this.props.ud3state.killBitSet}
                    disabled={!allowInteraction}
                    coil={this.props.level.coil}
                />;
            } else {
                return <CentralKillbit numSetKillbits={this.props.ud3state.killBitSet ? 3 : 1} totalNumCoils={3}/>;
            }
        })();
        return <ButtonToolbar className="justify-content-between">
            <ButtonGroup>{this.makeMenuItems(allowInteraction)}</ButtonGroup>
            {killbitElement}
            {
                this.props.level.level !== 'central-control' && <Button
                    onClick={() => this.onConnectionButton()}
                    variant={"warning"}
                    disabled={connectionBtnDisabled}
                >{connectionBtnText}</Button>
            }
        </ButtonToolbar>;
    }

    private onConnectionButton() {
        if (this.props.connectionStatus !== ConnectionStatus.IDLE) {
            processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.connectButton, undefined);
        }
    }

    private makeMenuItems(allowInteraction: boolean) {
        const commandsMenuItem = (
            <CommandsMenuItem
                udState={this.props.ud3state}
                ttConfig={this.props.ttConfig}
                disabled={!allowInteraction}
                darkMode={this.props.darkMode}
                level={this.props.level}
            />
        );
        if (this.props.level.level === 'single-coil') {
            return commandsMenuItem;
        } else {
            return (
                <>
                    {commandsMenuItem}
                    <StartStopMenuItem
                        startKey={IPC_CONSTANTS_TO_MAIN.menu.startMedia}
                        stopKey={IPC_CONSTANTS_TO_MAIN.menu.stopMedia}
                        dataKey={IPC_CONSTANTS_TO_RENDERER.menu.setMediaTitle}
                        disabled={!allowInteraction}
                        darkMode={this.props.darkMode}
                    />
                    <StartStopMenuItem
                        startKey={IPC_CONSTANTS_TO_MAIN.script.startScript}
                        stopKey={IPC_CONSTANTS_TO_MAIN.script.stopScript}
                        dataKey={IPC_CONSTANTS_TO_RENDERER.menu.setScriptName}
                        disabled={!allowInteraction}
                        darkMode={this.props.darkMode}
                    />
                </>
            );
        }
    }
}
