import React from "react";
import {FRDisplayEventType, getEventTypeDesc, ParsedEvent} from "../../common/FlightRecorderTypes";
import {getAlarmColor} from "../control/Alarms";

export interface EventSelectorProps {
    event: ParsedEvent;
    endTime: number;
}

export function FREventRow(props: EventSelectorProps) {
    const time = ((props.event.time - props.endTime) / 1e6).toFixed(4);
    const direction = props.event.toUD3 ? 'TT \u2192 UD3' : 'UD3 \u2192 TT';
    let descElement: React.JSX.Element;
    if (props.event.type === FRDisplayEventType.terminal_data) {
        descElement = <>
            {props.event.desc}<br/>
            <pre>{props.event.printed}</pre>
        </>;
    } else if (props.event.type === FRDisplayEventType.event_info && props.event.infoObject) {
        descElement = <>
            {props.event.desc}<br/>
            <pre>{JSON.stringify(props.event.infoObject, undefined, '    ')}</pre>
        </>;
    } else if (props.event.type === FRDisplayEventType.alarm) {
        const data = props.event.data;
        let text = data.message;
        if (data.value !== undefined) {
            text += ` (${data.value})`;
        }
        descElement = <div className={getAlarmColor(data.level, 'text')}>{text}</div>;
    } else {
        descElement = <>{props.event.desc}</>;
    }
    return (
        <tr>
            <td className={'tt-min-width-cell'}>{time}</td>
            <td className={'tt-min-width-cell'}>{getEventTypeDesc(props.event.type)}</td>
            <td className={'tt-min-width-cell'}>{direction}</td>
            <td>{descElement}</td>
        </tr>
    );
}
