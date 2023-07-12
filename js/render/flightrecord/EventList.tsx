import {Table} from "react-bootstrap";
import {ParsedEvent} from "../../common/FlightRecorderTypes";
import {TTComponent} from "../TTComponent";
import {FRFilter} from "./EventFilter";
import {FREventRow} from "./FREventRow";

export interface EventListProps {
    filter: FRFilter;
    events: ParsedEvent[];
}

export class FREventList extends TTComponent<EventListProps, {}> {
    public constructor(props) {
        super(props);
    }

    public render() {
        const endTime = this.props.events[this.props.events.length - 1]?.time;
        const rows = this.props.events.filter((ev) => this.shouldShow(ev))
            .map((ev, i) => {
                return <FREventRow
                    event={ev}
                    key={i}
                    endTime={endTime}
                />;
            });
        // TODO move everything to proper classes, same in the row element
        // TODO can I make sticky table header work with borders?
        return <div className={'tt-fr-list'}>
            <Table bordered>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Direction</th>
                        <th>Type</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                {rows}
                </tbody>
            </Table>
        </div>;
    }

    private shouldShow(ev: ParsedEvent) {
        if (!this.props.filter.selectedTypes[ev.type]) {
            return false;
        } else if (ev.toUD3 && !this.props.filter.showToUD3) {
            return false;
        } else if (!ev.toUD3 && !this.props.filter.showToTT) {
            return false;
        }
        return true;
    }
}
