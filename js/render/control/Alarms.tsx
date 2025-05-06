import React from "react";
import {Button, Table} from "react-bootstrap";
import {UD3AlarmLevel} from "../../common/constants";
import {UD3Alarm} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

export interface AlarmProps {
    alarms: UD3Alarm[];
    close: () => any;
    darkMode: boolean;
}

export class Alarms extends TTComponent<AlarmProps, {}> {
    public render() {
        return <>
            <div className={'tt-modal-scrollable'}>
                {this.makeTable()}
            </div>
            <Button onClick={this.props.close}>Close</Button>
        </>;
    }

    private makeTable() {
        return <Table bordered>
            <thead>
            <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Message</th>
                <th>Value</th>
            </tr>
            </thead>
            <tbody>
            {this.props.alarms.map((alarm, id) => this.makeRow(alarm, id))}
            </tbody>
        </Table>;
    }

    private makeRow(alarm: UD3Alarm, id: number) {
        let levelName: string;
        let background: string;
        let color: string;
        switch (alarm.level) {
            case UD3AlarmLevel.info:
                levelName = 'info';
                break;
            case UD3AlarmLevel.warn:
                levelName = 'warn';
                background = this.props.darkMode ? 'darkgoldenrod' : 'yellow';
                color = this.props.darkMode ? 'white' : 'black';
                break;
            case UD3AlarmLevel.alarm:
                levelName = 'alarm';
                background = 'orange';
                color = 'white';
                break;
            case UD3AlarmLevel.critical:
                levelName = 'critical';
                background = 'red';
                color = 'white';
                break;
        }
        const style = {background, color};
        return <tr style={style} key={id}>
            <td style={style}>{alarm.timestamp}</td>
            <td style={style}>{levelName}</td>
            <td style={style}>{alarm.message}</td>
            <td style={style}>{alarm.value || ''}</td>
        </tr>;
    }
}
