import React from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface CentralKillbitProps {
    totalNumCoils: number;
    numConnectedKilled: number;
    numDisconnected: number;
}

function setKillbit(val: boolean) {
    processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setAllKillState, val);
}

export class CentralKillbit extends TTComponent<CentralKillbitProps, {}> {
    public render(): React.ReactNode {
        const backgroundString = (() => {
            const numGoodCoils = this.props.totalNumCoils - this.props.numConnectedKilled - this.props.numDisconnected;
            const stripes = [
                {color: 'blue', height: this.props.numDisconnected},
                {color: 'red', height: this.props.numConnectedKilled},
                {color: 'green', height: numGoodCoils},
            ].filter((color) => color.height > 0);
            if (stripes.length === 0) {
                return 'orange';
            } else if (stripes.length === 1) {
                return stripes[0].color;
            } else {
                let spec = 'linear-gradient(0deg';
                let heightNow = 0;
                for (const color of stripes) {
                    const newHeight = heightNow + Math.floor(100 * color.height / this.props.totalNumCoils);
                    spec += `, ${color.color} ${heightNow}% ${newHeight}%`;
                    heightNow = newHeight;
                }
                return spec + ')';
            }
        })();
        return (
            <ButtonGroup>
                <Button onClick={() => setKillbit(true)}>KILL SET</Button>
                <div style={{
                    background: backgroundString,
                    height: '100%',
                    paddingLeft: '5px',
                    paddingRight: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {this.props.numConnectedKilled} / {this.props.totalNumCoils}
                </div>
                <Button onClick={() => setKillbit(false)}>KILL RESET</Button>
            </ButtonGroup>
        );
    }
}
