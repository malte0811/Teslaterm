import React from "react";
import {Button, ButtonGroup, ButtonToolbar} from "react-bootstrap";
import {CoilID} from "../../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {ConnectionStatus, IPC_CONSTANTS_TO_RENDERER, IUD3State} from "../../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../../common/TTConfig";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";
import {TabControlLevelBase} from "../SingleCoilTab";
import {CentralKillbit} from "./CentralKillbit";
import {CommandsMenuItem} from "./Commands";
import {Killbit} from "./Killbit";
import {StartStopMenuItem} from "./StartStopItem";

export interface MenuProps {
    level: TabControlLevelBase<
        { coil: CoilID, state: IUD3State },
        { numCoils: number, numKill: number, numDisconnected: number }
    >;
    connectionStatus: ConnectionStatus;
    ttConfig: TTConfig;
    darkMode: boolean;
    returnToConnect: () => any;
}

function getConnectionButtonText(status: ConnectionStatus) {
    switch (status) {
        case ConnectionStatus.CONNECTING:
        case ConnectionStatus.RECONNECTING:
            return 'Abort connection';
        case ConnectionStatus.IDLE:
            return 'Close';
        case ConnectionStatus.CONNECTED:
            return 'Disconnect';
        case ConnectionStatus.BOOTLOADING:
            return 'Abort bootloading';
    }
}

export class MenuBar extends TTComponent<MenuProps, {}> {
    public render(): React.ReactNode {
        const allowInteraction = this.props.connectionStatus === ConnectionStatus.CONNECTED;
        const killbitElement = (() => {
            if (this.props.level.level !== 'central-control') {
                return <Killbit
                    killbit={this.props.level.state.killBitSet}
                    disabled={!allowInteraction}
                    coil={this.props.level.coil}
                />;
            } else {
                return <CentralKillbit
                    numDisconnected={this.props.level.numDisconnected}
                    numConnectedKilled={this.props.level.numKill}
                    totalNumCoils={this.props.level.numCoils}
                />;
            }
        })();
        return <ButtonToolbar className="justify-content-between">
            <ButtonGroup>{this.makeMenuItems(allowInteraction)}</ButtonGroup>
            {killbitElement}
            {this.makeDisconnectButton()}
        </ButtonToolbar>;
    }

    private makeDisconnectButton() {
        if (this.props.level.level === 'central-control') {
            return <></>;
        } else if (this.props.level.level !== 'combined' && this.props.connectionStatus === ConnectionStatus.IDLE) {
            const coilIPC = getToMainIPCPerCoil(this.props.level.coil);
            return <Button onClick={() => processIPC.send(coilIPC.menu.reconnect, undefined)} variant={'warning'}>
                Reconnect
            </Button>;
        } else {
            const connectionBtnText = getConnectionButtonText(this.props.connectionStatus);
            return <Button
                onClick={() => this.onDisconnectButton()}
                variant={"warning"}
            >{connectionBtnText}</Button>;
        }
    }

    private onDisconnectButton() {
        if (this.props.connectionStatus === ConnectionStatus.IDLE) {
            this.props.returnToConnect();
        } else if (this.props.level.level !== 'central-control') {
            processIPC.send(getToMainIPCPerCoil(this.props.level.coil).menu.disconnect, undefined);
        }
    }

    private makeMenuItems(allowInteraction: boolean) {
        const commandsMenuItem = (
            <CommandsMenuItem
                udState={this.props.level.level === 'central-control' ? undefined : this.props.level.state}
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
