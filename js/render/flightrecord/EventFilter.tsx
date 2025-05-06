import { Form } from "react-bootstrap";
import {allFREvents, FREventSet, FRDisplayEventType, getEventTypeDesc} from "../../common/FlightRecorderTypes";
import {TTComponent} from "../TTComponent";

export interface FRFilter {
    selectedTypes: FREventSet;
    showToUD3: boolean;
    showToTT: boolean;
}

export interface EventSelectorProps {
    availableTypes: FREventSet;
    filter: FRFilter;
    setFilter: (ev: Partial<FRFilter>) => any;
}

export class EventFilter extends TTComponent<EventSelectorProps, {}> {
    public constructor(props) {
        super(props);
    }

    public render() {
        const shownEvents = allFREvents.filter(e => this.props.availableTypes[e]);
        return (
            <Form>
                <Form.Label>Type</Form.Label>
                <Form.Group>
                    {shownEvents.map((ev, i) => <Form.Check
                        label={getEventTypeDesc(ev)}
                        checked={this.props.filter.selectedTypes[ev]}
                        onChange={() => this.toggleType(ev)}
                        key={i}
                    />)}
                </Form.Group>
                <Form.Label>Direction</Form.Label>
                <Form.Group>
                    <Form.Check
                        label={'To UD3'}
                        checked={this.props.filter.showToUD3}
                        onChange={ev => this.props.setFilter({showToUD3: ev.currentTarget.checked})}
                    />
                    <Form.Check
                        label={'From UD3'}
                        checked={this.props.filter.showToTT}
                        onChange={ev => this.props.setFilter({showToTT: ev.currentTarget.checked})}
                    />
                </Form.Group>
            </Form>
        );
    }

    private toggleType(type: FRDisplayEventType) {
        const oldTypes = this.props.filter.selectedTypes;
        this.props.setFilter({selectedTypes: {...oldTypes, [type]: !oldTypes[type]}});
    }
}
