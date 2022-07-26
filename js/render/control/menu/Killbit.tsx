import React from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface KillbitProps {
    killbit: boolean;
    disabled: boolean;
}

function setKillbit(val: boolean) {
    processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setKillState, val);
}

export class Killbit extends TTComponent<KillbitProps, {}> {
    render(): React.ReactNode {
        let stateIndicator: JSX.Element;
        const toggleKillbit = () => setKillbit(!this.props.killbit);
        if (this.props.killbit) {
            stateIndicator = <Button
                variant={'danger'}
                onClick={toggleKillbit}
                disabled={this.props.disabled}
            >ERR</Button>
        } else {
            stateIndicator = <Button
                variant={'success'}
                onClick={toggleKillbit}
                disabled={this.props.disabled}
            >OK</Button>
        }
        return <ButtonGroup>
            <Button onClick={(ev) => setKillbit(true)} disabled={this.props.disabled}>KILL SET</Button>
            {stateIndicator}
            <Button onClick={(ev) => setKillbit(false)} disabled={this.props.disabled}>KILL RESET</Button>
        </ButtonGroup>;
    }
}
