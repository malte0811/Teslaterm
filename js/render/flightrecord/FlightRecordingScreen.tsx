import React from "react";
import {Col, Nav, Row, Tab} from "react-bootstrap";
import {FREventType, ParsedEvent} from "../../common/FlightRecorderTypes";
import {FRDisplayData} from "../connect/ConnectScreen";
import {TTComponent} from "../TTComponent";
import {EventListTab} from "./EventListTab";
import {TelemetryTab} from "./TelemetryTab";

export interface FRScreenProps {
    darkMode: boolean;
    events: FRDisplayData;
}

interface FRScreenState {
    eventsForList: ParsedEvent[];
}

export class FlightRecordingScreen extends TTComponent<FRScreenProps, FRScreenState> {
    constructor(props) {
        super(props);
        this.state = {
            eventsForList: this.props.events.events.filter((event) => event.type !== FREventType.telemetry),
        };
    }

    public render() {
        return (
            <div className={'tt-fr-toplevel'}>
                <Tab.Container defaultActiveKey="list">
                    <Col style={{height: 'inherit', width: 'inherit'}}>
                        <Row sm={3} style={{width: '100%'}}>
                            <Nav variant="tabs" className="flex-row">
                                <Nav.Item>
                                    <Nav.Link eventKey="list">Event list</Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link eventKey="telemetry">Telemetry</Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </Row>
                        <Row sm={9} style={{height: 'calc(100% - 40px)', width: '100%'}}>
                            <Tab.Content style={{height: '100%', width: '100%'}}>
                                <Tab.Pane eventKey="list" style={{height: '100%', width: '100%'}}>
                                    <EventListTab darkMode={this.props.darkMode} events={this.state.eventsForList}/>
                                </Tab.Pane>
                                <Tab.Pane eventKey="telemetry">
                                    <TelemetryTab darkMode={this.props.darkMode} events={this.props.events}/>
                                </Tab.Pane>
                            </Tab.Content>
                        </Row>
                    </Col>
                </Tab.Container>
            </div>);
    }
}
