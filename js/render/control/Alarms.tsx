import React from "react";
import {Button, Table} from "react-bootstrap";
import {UD3AlarmLevel} from "../../common/constants";
import {UD3Alarm} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

export interface AlarmProps {
    alarms: UD3Alarm[];
    close: () => any;
}

export function getAlarmColor(severity: UD3AlarmLevel, classPrefix: string) {
    switch (severity) {
        case UD3AlarmLevel.info:
            return '';
        case UD3AlarmLevel.warn:
            return classPrefix + '-warning';
        case UD3AlarmLevel.alarm:
            return classPrefix + '-danger';
        case UD3AlarmLevel.critical:
            return classPrefix + '-danger';
        default:
            severity satisfies never;
    }
}

function getSeverityName(severity: UD3AlarmLevel) {
    switch (severity) {
        case UD3AlarmLevel.info:
            return 'info';
        case UD3AlarmLevel.warn:
            return 'warn';
        case UD3AlarmLevel.alarm:
            return 'alarm';
        case UD3AlarmLevel.critical:
            return 'critical';
        default:
            severity satisfies never;
    }
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
        const cssClass = getAlarmColor(alarm.level, 'bg');
        return <tr key={id}>
            <td className={cssClass}>{alarm.timestamp}</td>
            <td className={cssClass}>{getSeverityName(alarm.level)}</td>
            <td className={cssClass}>{alarm.message}</td>
            <td className={cssClass}>{alarm.value || ''}</td>
        </tr>;
    }
}
