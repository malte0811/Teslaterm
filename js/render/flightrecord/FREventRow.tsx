import React from "react";
import {FREventType, getEventTypeDesc, ParsedEvent} from "../../common/FlightRecorderTypes";
import {TTComponent} from "../TTComponent";

export interface EventSelectorProps {
    event: ParsedEvent;
    endTime: number;
}

export class FREventRow extends TTComponent<EventSelectorProps, {}> {
    public constructor(props) {
        super(props);
    }

    public render() {
        const time = ((this.props.event.time - this.props.endTime) / 1e6).toFixed(4);
        const direction = this.props.event.toUD3 ? 'TT \u2192 UD3' : 'UD3 \u2192 TT';
        let descElement: React.JSX.Element;
        if (this.props.event.type === FREventType.terminal_data) {
            descElement = <>{this.props.event.desc}<br/><pre>{this.props.event.printed}</pre></>;
        } else {
            descElement = <>{this.props.event.desc}</>;
        }
        return (
            <tr>
                <td className={'tt-min-width-cell'}>{time}</td>
                <td className={'tt-min-width-cell'}>{getEventTypeDesc(this.props.event.type)}</td>
                <td className={'tt-min-width-cell'}>{direction}</td>
                <td>{descElement}</td>
            </tr>
        );
    }
}
