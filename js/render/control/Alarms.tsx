import React from "react";
import {Button, Table} from "react-bootstrap";
import {UD3AlarmLevel} from "../../common/constants";
import {UD3Alarm} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

export interface AlarmProps {
    alarms: UD3Alarm[];
    close: () => any;
}

export class Alarms extends TTComponent<AlarmProps, {}> {
    render() {
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
            {this.props.alarms.map(Alarms.makeRow)}
            </tbody>
        </Table>;
    }

    private static makeRow(alarm: UD3Alarm, id: number) {
        let levelName: string;
        let background: string;
        switch (alarm.level) {
            case UD3AlarmLevel.info:
                levelName = 'info';
                background = 'white';
                break;
            case UD3AlarmLevel.warn:
                levelName = 'warn';
                background = 'yellow';
                break;
            case UD3AlarmLevel.alarm:
                levelName = 'alarm';
                background = 'orange';
                break;
            case UD3AlarmLevel.critical:
                levelName = 'critical';
                background = 'red';
                break;
        }
        const color = alarm.level == UD3AlarmLevel.info || alarm.level == UD3AlarmLevel.warn ? 'black' : 'white';
        return <tr style={({background, color})} key={id}>
            <td>{alarm.timestamp}</td>
            <td>{levelName}</td>
            <td>{alarm.message}</td>
            <td>{alarm.value || ''}</td>
        </tr>;
    }
}
