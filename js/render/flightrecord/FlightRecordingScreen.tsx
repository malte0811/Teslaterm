import React from "react";
import {FREventSet, FREventType, makeEmptyEventSet, ParsedEvent} from "../../common/FlightRecorderTypes";
import {TTComponent} from "../TTComponent";
import {EventFilter, FRFilter} from "./EventFilter";
import {FREventList} from "./EventList";

interface DRScreenState {
    presentTypes: FREventSet;
    filter: FRFilter;
}

export interface DRScreenProps {
    darkMode: boolean;
    events: ParsedEvent[];
}

export class FlightRecordingScreen extends TTComponent<DRScreenProps, DRScreenState> {
    constructor(props: DRScreenProps) {
        super(props);
        const presentTypes: FREventSet = makeEmptyEventSet();
        const selectedTypes: FREventSet = makeEmptyEventSet();
        for (const event of this.props.events) {
            presentTypes[event.type] = true;
            selectedTypes[event.type] = true;
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
            <div className={'tt-fr-toplevel'}>
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
