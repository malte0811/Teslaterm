import React, {useEffect, useRef, useState} from "react";
import {Button, ButtonGroup, ButtonToolbar, Col, Modal, Nav, OverlayTrigger, Row, Tab, Tooltip} from "react-bootstrap";
import {CoilID, coilSuffix} from "../../common/constants";
import {ConfirmReply, getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConfirmationRequest,
    ConnectionStatus, DEFAULT_UD3_STATE, getToRenderIPCPerCoil,
    IPC_CONSTANTS_TO_RENDERER,
    UD3State,
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {SyncedUIConfig} from "../../common/UIConfig";
import {FileUploadIPC} from "../ipc/FileUpload";
import {processIPC} from "../ipc/IPCProvider";
import {useDropCallback} from "../ScreenWithDrop";
import {useIPCListener, useIPCListeners} from "../TTComponent";
import {CentralControlTab} from "./showmode/CentralControlTab";
import {ShowSettingsDialog} from "./showmode/ShowSettingsDialog";
import {SingleCoilTab} from "./SingleCoilTab";
import {addToast, getToasts, makeToastRemover, ToastManager} from "./ToastManager";
import {ToastsProps} from "./Toasts";

export interface CoilState {
    connection: ConnectionStatus;
    id: CoilID;
    ud: UD3State;
    name?: string;
}

interface CommonProps {
    ttConfig: TTConfig;
    config: SyncedUIConfig;
    returnToConnect: () => any;
}

interface SingleCoilProps {
    status: CoilState;
    toasts: ToastsProps;
}

interface MulticoilProps extends CommonProps {
    coils: CoilID[];
    getCoilProps: (coil: CoilID) => SingleCoilProps;
    genericToasts: ToastsProps;
}

export interface MainScreenProps extends CommonProps {
    ttConfig: TTConfig;
    coils: CoilID[];
    multicoil: boolean;
    config: SyncedUIConfig;
}

function renderTabTitle(coil: CoilID, coilState: CoilState) {
    const coilTitle = coilState?.name || 'Unknown UD3';
    const [color, tooltip] = (() => {
        if (coilState.connection === ConnectionStatus.IDLE) {
            return ['blue', 'Connection lost'];
        } else if (coilState?.ud.killBitSet) {
            return ['red', 'Killbit set'];
        } else {
            return ['green', 'Operational'];
        }
    })();
    const renderTooltip = (props) => <Tooltip {...props}>{tooltip}</Tooltip>;
    return <Nav.Item>
        <Nav.Link eventKey={"coil" + coilSuffix(coil)}>
            <OverlayTrigger placement={'right'} overlay={renderTooltip}>
                <div className={'tt-dot'} style={{background: color}}/>
            </OverlayTrigger> {coilTitle}
        </Nav.Link>
    </Nav.Item>;
}

function SingleTab(props: SingleCoilProps & CommonProps & {coil: CoilID, type: 'single-coil' | 'combined'}) {
    return <SingleCoilTab
        allowInteraction={props.status.connection === ConnectionStatus.CONNECTED}
        ttConfig={props.ttConfig}
        connectionStatus={props.status.connection}
        config={props.config}
        coil={props.coil}
        ud3State={props.status.ud}
        toasts={props.toasts}
        level={props.type}
        returnToConnect={props.returnToConnect}
    />;
}

function MultiCoilTabs(props: MulticoilProps) {
    type CoilEntry = [CoilID, SingleCoilProps];

    const [showShowSettings, setShowShowSettings] = useState(false);
    const coilProps = props.coils.map((c): CoilEntry => [c, props.getCoilProps(c)]);
    const tabs = coilProps.map(([coil, state]) => renderTabTitle(coil, state.status));
    tabs.unshift(<Nav.Item>
        <Nav.Link eventKey="control">Control</Nav.Link>
    </Nav.Item>);
    const coils = coilProps.map(([coil, singleProps]) => {
        return <Tab.Pane eventKey={"coil" + coilSuffix(coil)} style={{
            height: '100%',
            overflow: 'hidden',
        }}>{<SingleTab {...props} {...singleProps} coil={coil} type='single-coil'/>}</Tab.Pane>;
    });
    const closeButton = (() => {
        const anyConnected = !coilProps.every(
            ([_, coilProps]) => coilProps.status.connection === ConnectionStatus.IDLE,
        );
        if (anyConnected) {
            const disconnectCoil = (id: CoilID) => processIPC.send(getToMainIPCPerCoil(id).menu.disconnect, undefined);
            return <Button
                variant={"warning"}
                onClick={() => props.coils.forEach(disconnectCoil)}
            >Disconnect All</Button>;
        } else {
            return <Button variant={"warning"} onClick={props.returnToConnect}>Close</Button>;
        }
    })();


    return (
        <div className={'tt-main-screen'}>
            <Tab.Container transition={false} defaultActiveKey={'control'}>
                <Col className={'tt-coil-tabs'}>
                    <Row className={'tt-coil-tab-bar'}>
                        <ButtonToolbar className="justify-content-between">
                            <Nav variant={'tabs'}>
                                {...tabs}
                            </Nav>
                            <ButtonGroup>
                                <Button variant={'info'} onClick={() => setShowShowSettings(true)}>Settings</Button>
                                {closeButton}
                            </ButtonGroup>
                        </ButtonToolbar>
                    </Row>
                    <Row className={'tt-coil-tab-main'}>
                        <Tab.Content style={{
                            display: 'flex',
                            flex: '1 1 auto',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            <Tab.Pane eventKey="control" style={{
                                height: '100%',
                                overflow: 'hidden',
                            }}>
                                <CentralControlTab
                                    coils={coilProps.map(([_, cProps]) => cProps.status)}
                                    ttConfig={props.ttConfig}
                                    config={props.config}
                                    toasts={props.genericToasts}
                                />
                            </Tab.Pane>
                            {...coils}
                        </Tab.Content>
                    </Row>
                </Col>
                <ShowSettingsDialog
                    visible={showShowSettings}
                    darkMode={props.config.darkMode}
                    close={() => setShowShowSettings(false)}
                    globalShowSettings={props.config.showmodeOptions}
                />
            </Tab.Container>
        </div>
    );
}

export function MainScreen(props: MainScreenProps) {
    const [coilStates, setCoilStates] = useState(new Map<CoilID, CoilState>());
    const [scriptRequest, setScriptRequest] = useState<ConfirmationRequest>(
        {confirmationID: 0, message: "", title: undefined},
    );
    const [scriptPopupShown, setScriptPopupShown] = useState(false);
    const [toasts, setToasts] = useState<ToastManager>({allToasts: [], nextIndex: 0});

    const getCoilStatus = (coil: CoilID, state?: Map<CoilID, CoilState>) => {
        return (state || coilStates).get(coil) || {connection: ConnectionStatus.IDLE, id: coil, ud: DEFAULT_UD3_STATE};
    }
    const toastsForCoil = (coil?: CoilID): ToastsProps => {
        return {
            closeToast: makeToastRemover(setToasts),
            toasts: getToasts(toasts, (c) => getCoilStatus(c).name, coil),
        };
    };

    const onConnectionChange = (coil: CoilID, newState: Partial<CoilState>) => {
        setCoilStates((oldState) => {
            const oldCoilState = getCoilStatus(coil, oldState);
            const newStates = new Map<CoilID, CoilState>(oldState);
            newStates.set(coil, {...oldCoilState, ...newState});
            return newStates;
        });
    }

    useIPCListener(
        IPC_CONSTANTS_TO_RENDERER.script.requestConfirm,
        (req: ConfirmationRequest) => {
            setScriptRequest(req);
            setScriptPopupShown(true);
        },
    );
    useIPCListener(IPC_CONSTANTS_TO_RENDERER.openToastOn, ([toast, coil]) => addToast(setToasts, toast, coil));
    useIPCListeners<CoilID, ConnectionStatus>(props.coils, (coil) => ({
        channel: getToRenderIPCPerCoil(coil).updateConnectionState,
        listener: (status) => onConnectionChange(coil, {connection: status}),
    }));
    useIPCListeners<CoilID, UD3State>(props.coils, (coil) => ({
        channel: getToRenderIPCPerCoil(coil).udState,
        listener: (state) => onConnectionChange(coil, {ud: state}),
    }));
    useIPCListeners<CoilID, string>(props.coils, (coil) => ({
        channel: getToRenderIPCPerCoil(coil).udName,
        listener: (name) => onConnectionChange(coil, {name}),
    }));

    useEffect(() => processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined), []);
    const mainDiv = useRef<HTMLDivElement>(null);
    useDropCallback(mainDiv, async (e) => {
        const files: File[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; ++i) {
            files.push(e.dataTransfer.files[i]);
        }
        await FileUploadIPC.uploadFiles(files);
    });

    const scriptPopup = (() => {
        const confirm = (ok: boolean) => {
            processIPC.send(
                IPC_CONSTANTS_TO_MAIN.script.confirmOrDeny,
                new ConfirmReply(ok, scriptRequest.confirmationID),
            );
            setScriptPopupShown(false);
        };
        return <Modal
            show={scriptPopupShown}
            onHide={() => confirm(false)}
        >
            {scriptRequest.title && <Modal.Title>{scriptRequest.title}</Modal.Title>}
            <Modal.Body>{scriptRequest.message}</Modal.Body>
            <Modal.Footer>
                <Button variant={'primary'} onClick={() => confirm(true)}>Confirm</Button>
                <Button variant={'secondary'} onClick={() => confirm(false)}>Abort script</Button>
            </Modal.Footer>
        </Modal>;
    })();

    const content = (() => {
        const getCoilProps = (coil: CoilID): SingleCoilProps => {
            return {
                status: getCoilStatus(coil),
                toasts: toastsForCoil(coil),
            };
        };
        if (props.multicoil) {
            return <MultiCoilTabs
                {...props}
                getCoilProps={getCoilProps}
                genericToasts={toastsForCoil(undefined)}
                />;
        } else {
            return <SingleTab {...props} {...getCoilProps(props.coils[0])} coil={props.coils[0]} type='combined'/>;
        }
    })();
    return <div className={'tt-main-screen'} ref={mainDiv}>
        {content}
        {scriptPopup}
    </div>;
}
