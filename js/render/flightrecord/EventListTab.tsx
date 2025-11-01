import React, {useState} from "react";
import {
    allFREvents,
    FRDisplayEventType,
    FREventSet,
    makeEmptyEventSet,
    ParsedEvent
} from "../../common/FlightRecorderTypes";
import {EventFilter, FRFilter} from "./EventFilter";
import {EventListProps, FREventList} from "./EventList";

export interface FREventsTabProps {
    events: ParsedEvent[];
    endTime: number;
}

function allExceptTelemetry() {
    const result = makeEmptyEventSet();
    for (const key of allFREvents) {
        if (key !== FRDisplayEventType.telemetry) {
            result[key] = true;
        }
    }
    return result;
}

export function EventListTab(props: FREventsTabProps) {
    const [filter, setFilter] = useState<FRFilter>({
        selectedTypes: allExceptTelemetry(),
        showToTT: true,
        showToUD3: true,
    });
    const presentTypes: FREventSet = makeEmptyEventSet();
    for (const event of props.events) {
        if (event.type !== FRDisplayEventType.telemetry) {
            presentTypes[event.type] = true;
        }
    }
    return (
        <div className={'tt-fr-list-tab'}>
            <EventFilter
                availableTypes={presentTypes}
                filter={filter}
                setFilter={f => setFilter((old) => ({...old, ...f}))}
            />
            <FREventList
                filter={filter}
                events={props.events}
                endTime={props.endTime}
            />
        </div>
    );
}
