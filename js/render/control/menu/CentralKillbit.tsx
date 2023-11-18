import React from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {TTComponent} from "../../TTComponent";

export interface CentralKillbitProps {
    totalNumCoils: number;
    numSetKillbits: number;
}

function setKillbit(val: boolean) {
    // TODO set/reset on *all*
    processIPC.send(IPC_CONSTANTS_TO_MAIN.commands.setKillState, val);
}

export class CentralKillbit extends TTComponent<CentralKillbitProps, {}> {
    public render(): React.ReactNode {
        const backgroundString = (() => {
            const redFraction = this.props.numSetKillbits / this.props.totalNumCoils;
            const redPercent = Math.round(redFraction * 100);
            if (redPercent === 0) {
                return 'green';
            } else if (redPercent === 100) {
                return 'red';
            } else {
                return `linear-gradient(0deg, green ${100 - redPercent}%, red ${redPercent}%)`;
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
                    {this.props.numSetKillbits} / {this.props.totalNumCoils}
                </div>
                <Button onClick={() => setKillbit(false)}>KILL RESET</Button>
            </ButtonGroup>
        );
    }
}
