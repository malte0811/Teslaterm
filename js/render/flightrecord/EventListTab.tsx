import React from "react";
import {FREventSet, FREventType, makeEmptyEventSet, ParsedEvent} from "../../common/FlightRecorderTypes";
import {TTComponent} from "../TTComponent";
import {EventFilter, FRFilter} from "./EventFilter";
import {FREventList} from "./EventList";

interface FREventsTabState {
    presentTypes: FREventSet;
    filter: FRFilter;
}

export interface FREVentsTabProps {
    darkMode: boolean;
    events: ParsedEvent[];
}

export class EventListTab extends TTComponent<FREVentsTabProps, FREventsTabState> {
    constructor(props: FREVentsTabProps) {
        super(props);
        const presentTypes: FREventSet = makeEmptyEventSet();
        const selectedTypes: FREventSet = makeEmptyEventSet();
        for (const event of this.props.events) {
            if (event.type !== FREventType.telemetry) {
                presentTypes[event.type] = true;
                selectedTypes[event.type] = true;
            }
        }
        const filter: FRFilter = {
            selectedTypes,
            showToTT: true,
            showToUD3: true,
        };
        this.state = {presentTypes, filter};
    }

    public render() {
        return (
            <div className={'tt-fr-list-tab'}>
                <EventFilter
                    availableTypes={this.state.presentTypes}
                    filter={this.state.filter}
                    setFilter={f => this.setState((s) => {
                            return {filter: {...s.filter, ...f}};
                        },
                    )}
                />
                <FREventList filter={this.state.filter} events={this.props.events}/>
            </div>
        );
    }
}
