import React, {useEffect, useState} from "react";
import {Button, ButtonGroup, Col, Nav, Row, Tab} from "react-bootstrap";
import {FRDisplayEventType, InitialFRState, ParsedEvent} from "../../common/FlightRecorderTypes";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {uploadFileRaw} from "../FileHelper";
import {processIPC} from "../ipc/IPCProvider";
import {useIPCListener} from "../TTComponent";
import {EventListTab} from "./EventListTab";
import {TelemetryTab} from "./TelemetryTab";

export function FlightRecordingScreen(props: { close: () => any; }) {
    const [events, setEvents] = useState<ParsedEvent[]>([]);
    const [initial, setInitial] = useState<InitialFRState>({
        meterConfigs: [],
        traceConfigs: [],
    });
    useIPCListener(IPC_CONSTANTS_TO_RENDERER.flightRecorder.fullList, (frData) => {
        setEvents(frData.events);
        setInitial(frData.initial);
    });
    const listEvents = events.filter(
        (event: ParsedEvent) => event.type !== FRDisplayEventType.telemetry,
    );
    const endTime = events.length === 0 ? 0 : events[events.length - 1].time;
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
                        <ButtonGroup style={{marginLeft: 'auto'}}>
                            <Button onClick={selectFileForFRViewer}>Load file</Button>
                            <Button onClick={props.close} variant={'warning'}>Close</Button>
                        </ButtonGroup>
                    </Row>
                    <Row sm={9} style={{height: 'calc(100% - 40px)', width: '100%'}}>
                        <Tab.Content style={{height: '100%', width: '100%'}}>
                            <Tab.Pane eventKey="list" style={{height: '100%', width: '100%'}}>
                                <EventListTab events={listEvents} endTime={endTime}/>
                            </Tab.Pane>
                            <Tab.Pane eventKey="telemetry">
                                <TelemetryTab events={events} initial={initial} endTime={endTime}/>
                            </Tab.Pane>
                        </Tab.Content>
                    </Row>
                </Col>
            </Tab.Container>
        </div>);
}

export function selectFileForFRViewer() {
    uploadFileRaw(['.zip']).then((file) => {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFlightRecording, [...new Uint8Array(file.content)]);
    });
}
