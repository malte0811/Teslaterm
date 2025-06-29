import React from "react";
import {Button, Col, Nav, Row, Tab} from "react-bootstrap";
import {FRDisplayEventType, ParsedEvent} from "../../common/FlightRecorderTypes";
import {FRDisplayData} from "../connect/ConnectScreen";
import {EventListTab} from "./EventListTab";
import {TelemetryTab} from "./TelemetryTab";

export interface FRScreenProps {
    events: FRDisplayData;
    close: () => any;
}

export function FlightRecordingScreen(props: FRScreenProps) {
    const listEvents = props.events.events.filter(
        (event: ParsedEvent) => event.type !== FRDisplayEventType.telemetry,
    );
    const endTime = props.events.events[props.events.events.length - 1].time;
    return (
        <div className={'tt-fr-toplevel'}>
            <Tab.Container defaultActiveKey="list">
                <Col style={{height: 'inherit', width: 'inherit'}}>
                    <Row sm={3} style={{width: '100vw', marginLeft: '0'}}>
                        <Nav variant="tabs" className="flex-row">
                            <Nav.Item>
                                <Nav.Link eventKey="list">Event list</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="telemetry">Telemetry</Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <Button
                            onClick={props.close}
                            style={{marginLeft: 'auto', width: 'min-content'}}
                        >Close</Button>
                    </Row>
                    <Row sm={9} style={{height: 'calc(100% - 40px)', width: '100%'}}>
                        <Tab.Content style={{height: '100%', width: '100%'}}>
                            <Tab.Pane eventKey="list" style={{height: '100%', width: '100%'}}>
                                <EventListTab events={listEvents} endTime={endTime}/>
                            </Tab.Pane>
                            <Tab.Pane eventKey="telemetry">
                                <TelemetryTab events={props.events}/>
                            </Tab.Pane>
                        </Tab.Content>
                    </Row>
                </Col>
            </Tab.Container>
        </div>);
}
