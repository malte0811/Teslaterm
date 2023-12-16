import React from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import {CoilID} from "../../../common/constants";
import {getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface KillbitProps {
    killbit: boolean;
    disabled: boolean;
    coil: CoilID;
}

function setKillbit(coil: CoilID, val: boolean) {
    processIPC.send(getToMainIPCPerCoil(coil).commands.setKillState, val);
}

export class Killbit extends TTComponent<KillbitProps, {}> {
    public render(): React.ReactNode {
        let stateIndicator: React.JSX.Element;
        const toggleKillbit = () => setKillbit(this.props.coil, !this.props.killbit);
        if (this.props.killbit) {
            stateIndicator = <Button
                variant={'danger'}
                onClick={toggleKillbit}
                disabled={this.props.disabled}
            >ERR</Button>;
        } else {
            stateIndicator = <Button
                variant={'success'}
                onClick={toggleKillbit}
                disabled={this.props.disabled}
            >OK</Button>;
        }
        return <ButtonGroup>
            <Button onClick={() => setKillbit(this.props.coil, true)} disabled={this.props.disabled}>KILL SET</Button>
            {stateIndicator}
            <Button onClick={() => setKillbit(this.props.coil, false)} disabled={this.props.disabled}>KILL RESET</Button>
        </ButtonGroup>;
    }
}
