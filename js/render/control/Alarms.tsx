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
        let cssClass: string = '';
        let levelName: string;
        switch (alarm.level) {
            case UD3AlarmLevel.info:
                levelName = 'info';
                break;
            case UD3AlarmLevel.warn:
                levelName = 'warn';
                cssClass = 'bg-warning';
                break;
            case UD3AlarmLevel.alarm:
                levelName = 'alarm';
                cssClass = 'bg-danger';
                break;
            case UD3AlarmLevel.critical:
                levelName = 'critical';
                cssClass = 'bg-danger';
                break;
        }
        return <tr key={id}>
            <td className={cssClass}>{alarm.timestamp}</td>
            <td className={cssClass}>{levelName}</td>
            <td className={cssClass}>{alarm.message}</td>
            <td className={cssClass}>{alarm.value || ''}</td>
        </tr>;
    }
}
