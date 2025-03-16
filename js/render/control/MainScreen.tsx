import JSZip from "jszip";
import React from "react";
import {Button, ButtonToolbar, Col, Modal, Nav, OverlayTrigger, Row, Tab, Tooltip} from "react-bootstrap";
import {CoilID, coilSuffix} from "../../common/constants";
import {ConfirmReply, getToMainIPCPerCoil, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConfirmationRequest,
    ConnectionStatus,
    IPC_CONSTANTS_TO_RENDERER,
    IUD3State,
    UD3State,
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {SyncedUIConfig} from "../../common/UIConfig";
import {FileUploadIPC} from "../ipc/FileUpload";
import {processIPC} from "../ipc/IPCProvider";
import {ScreenWithDrop} from "../ScreenWithDrop";
import {CentralControlTab} from "./central/CentralControlTab";
import {SingleCoilTab} from "./SingleCoilTab";
import {addToast, getToasts, makeToastRemover, ToastManager, ToastUpdater} from "./ToastManager";
import {ToastsProps} from "./Toasts";

export interface CoilState {
    connection: ConnectionStatus;
    id: CoilID;
    ud: IUD3State;
    name?: string;
}

interface MainScreenState {
    scriptPopup: ConfirmationRequest;
    scriptPopupShown: boolean;
    coilStates: Map<CoilID, CoilState>;
    toasts: ToastManager;
}

export interface MainScreenProps {
    ttConfig: TTConfig;
    returnToConnect: () => any;
    coils: CoilID[];
    multicoil: boolean;
    config: SyncedUIConfig;
}

export class MainScreen extends ScreenWithDrop<MainScreenProps, MainScreenState> {
    constructor(props: any) {
        super(props);
        this.state = {
            coilStates: new Map<CoilID, CoilState>(),
            scriptPopup: {confirmationID: 0, message: "", title: undefined},
            scriptPopupShown: false,
            toasts: {allToasts: [], nextIndex: 0},
        };
    }

    public componentDidMount() {
        super.componentDidMount();
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.script.requestConfirm,
            (req: ConfirmationRequest) => this.setState({scriptPopup: req, scriptPopupShown: true}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.updateConnectionState,
            ([coil, status]) => this.onConnectionChange(coil, {connection: status}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.menu.ud3State,
            ([coil, state]) => this.onConnectionChange(coil, {ud: state}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.udName,
            ([coil, name]) => this.onConnectionChange(coil, {name}),
        );
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.openToastOn, ([toast, coil]) => {
            addToast(this.toastUpdater(), toast, coil);
        });

        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render(): React.ReactNode {
        if (this.props.multicoil) {
            return this.renderMultiCoil();
        } else {
            return <div ref={this.mainDivRef} className={'tt-main-screen'}>
                {this.renderSingleTab(this.props.coils[0], 'combined')}
            </div>;
        }
    }

    protected async onDrop(e: DragEvent) {
        const files: File[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; ++i) {
            files.push(e.dataTransfer.files[i]);
        }
        await FileUploadIPC.uploadFiles(files);
    }

    private renderMultiCoil() {
        const tabs = this.props.coils.map((coil) => this.renderTabTitle(coil));
        tabs.unshift(<Nav.Item>
            <Nav.Link eventKey="control">Control</Nav.Link>
        </Nav.Item>);
        const coils = this.props.coils.map((coil) => {
            return <Tab.Pane eventKey={"coil" + coilSuffix(coil)} style={{
                height: '100%',
                overflow: 'hidden',
            }}>{this.renderSingleTab(coil, 'single-coil')}</Tab.Pane>;
        });
        return (
            <div ref={this.mainDivRef} className={'tt-main-screen'}>
                <Tab.Container transition={false} defaultActiveKey={'control'}>
                    <Col className={'tt-coil-tabs'}>
                        <Row className={'tt-coil-tab-bar'}>
                            <ButtonToolbar className="justify-content-between">
                                <Nav variant={'tabs'}>
                                    {...tabs}
                                </Nav>
                                {this.makeCloseButton()}
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
                                        coils={this.props.coils.map((c) => this.getCoilStatus(c))}
                                        ttConfig={this.props.ttConfig}
                                        config={this.props.config}
                                        toasts={this.toastsForCoil()}
                                    />
                                </Tab.Pane>
                                {...coils}
                            </Tab.Content>
                        </Row>
                    </Col>
                    {this.makeScriptPopup()}
                </Tab.Container>
            </div>
        );
    }

    private renderTabTitle(coil: CoilID) {
        const coilState = this.getCoilStatus(coil);
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

    private onConnectionChange(coil: CoilID, newState: Partial<CoilState>) {
        this.setState((oldState) => {
            const oldCoilState = this.getCoilStatus(coil, oldState);
            const newStates = new Map<CoilID, CoilState>(oldState.coilStates);
            newStates.set(coil, {...oldCoilState, ...newState});
            return {coilStates: newStates};
        });
    }

    private makeCloseButton() {
        const anyConnected = !this.props.coils.every(
            (coil) => this.getCoilStatus(coil).connection === ConnectionStatus.IDLE,
        );
        if (anyConnected) {
            const disconnectCoil = (id: CoilID) => processIPC.send(getToMainIPCPerCoil(id).menu.disconnect, undefined);
            return <Button
                variant={"warning"}
                onClick={() => this.props.coils.forEach(disconnectCoil)}
            >Disconnect All</Button>;
        } else {
            return <Button variant={"warning"} onClick={this.props.returnToConnect}>Close</Button>;
        }
    }

    private getCoilStatus(coil: CoilID, state?: MainScreenState) {
        return (state || this.state).coilStates.get(coil) ||
            {connection: ConnectionStatus.IDLE, id: coil, ud: UD3State.DEFAULT_STATE};
    }

    private renderSingleTab(coil: CoilID, type: 'single-coil' | 'combined'): React.ReactNode {
        const coilStatus = this.getCoilStatus(coil);
        return <SingleCoilTab
            allowInteraction={coilStatus.connection === ConnectionStatus.CONNECTED}
            ttConfig={this.props.ttConfig}
            connectionStatus={coilStatus.connection}
            config={this.props.config}
            coil={coil}
            ud3State={coilStatus.ud}
            toasts={this.toastsForCoil(coil)}
            level={type}
            returnToConnect={this.props.returnToConnect}
        />;
    }

    private makeScriptPopup(): React.JSX.Element {
        const confirm = (ok: boolean) => {
            processIPC.send(
                IPC_CONSTANTS_TO_MAIN.script.confirmOrDeny,
                new ConfirmReply(ok, this.state.scriptPopup.confirmationID),
            );
            this.setState({scriptPopupShown: false});
        };
        return <Modal
            show={this.state.scriptPopupShown}
            className={this.props.config.darkMode && 'tt-dark-modal-root'}
            onHide={() => confirm(false)}
        >
            {this.state.scriptPopup.title && <Modal.Title>{this.state.scriptPopup.title}</Modal.Title>}
            <Modal.Body>{this.state.scriptPopup.message}</Modal.Body>
            <Modal.Footer>
                <Button variant={'primary'} onClick={() => confirm(true)}>Confirm</Button>
                <Button variant={'secondary'} onClick={() => confirm(false)}>Abort script</Button>
            </Modal.Footer>
        </Modal>;
    }

    private toastUpdater(): ToastUpdater {
        return (update) => this.setState((state) => ({...state, toasts: update(state.toasts)}));
    }

    private toastsForCoil(coil?: CoilID): ToastsProps {
        return {
            closeToast: makeToastRemover(this.toastUpdater()),
            darkMode: this.props.config.darkMode,
            toasts: getToasts(this.state.toasts, (coil) => this.getCoilStatus(coil).name, coil),
        };
    }
}
