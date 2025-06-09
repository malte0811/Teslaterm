import React from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {buildGradientDefinition} from "../../Gradient";
import {processIPC} from "../../ipc/IPCProvider";

export interface CentralKillbitProps {
    totalNumCoils: number;
    numConnectedKilled: number;
    numDisconnected: number;
}

function setKillbit(val: boolean) {
    processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setAllKillState, val);
}

export function CentralKillbit(props: CentralKillbitProps): React.ReactNode {
    const backgroundString = buildGradientDefinition(
        0,
        {color: 'blue', size: props.numDisconnected},
        {color: 'red', size: props.numConnectedKilled},
        {color: 'green', size: props.totalNumCoils - props.numConnectedKilled - props.numDisconnected},
    );
    return (
        <ButtonGroup>
            <Button onClick={() => setKillbit(true)}>KILL SET</Button>
            <div style={{
                alignItems: 'center',
                background: backgroundString,
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                paddingLeft: '5px',
                paddingRight: '5px',
            }}>
                {props.numConnectedKilled} / {props.totalNumCoils}
            </div>
            <Button onClick={() => setKillbit(false)}>KILL RESET</Button>
        </ButtonGroup>
    );
}
