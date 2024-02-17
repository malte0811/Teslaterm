import JSZip from "jszip";
import React from "react";
import {Button, ButtonToolbar, Col, Modal, Nav, Row, Tab} from "react-bootstrap";
import * as xterm from "xterm";
import {FitAddon} from "xterm-addon-fit";
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
import {FileUploadIPC} from "../ipc/FileUpload";
import {processIPC} from "../ipc/IPCProvider";
import {ScreenWithDrop} from "../ScreenWithDrop";
import {CentralControlTab} from "./CentralControlTab";
import {SingleCoilTab} from "./SingleCoilTab";
import {addToast, getToasts, makeToastRemover, ToastManager, ToastUpdater} from "./ToastManager";
import {ToastsProps} from "./Toasts";

interface CoilState {
    connection: ConnectionStatus;
    ud: IUD3State;
    name?: string;
}

interface MainScreenState {
    scriptPopup: ConfirmationRequest;
    scriptPopupShown: boolean;
    coilStates: CoilState[];
    toasts: ToastManager;
}

export interface MainScreenProps {
    ttConfig: TTConfig;
    returnToConnect: () => any;
    darkMode: boolean;
    coils: CoilID[];
}

// TODO this is a hack. I'm not 100% sure why, but Terminal does not like open/dispose cycles
export interface TerminalRef {
    terminal?: xterm.Terminal;
    fitter: FitAddon;
}

export class MainScreen extends ScreenWithDrop<MainScreenProps, MainScreenState> {
    private readonly terminal = new Map<CoilID, TerminalRef>();

    constructor(props: any) {
        super(props);
        this.state = {
            coilStates: this.props.coils.map(() => ({connection: ConnectionStatus.IDLE, ud: UD3State.DEFAULT_STATE})),
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
        if (this.props.coils.length === 1) {
            return this.renderSingleTab(this.props.coils[0], 'combined');
        } else {
            return this.renderMultiCoil();
        }
    }

    protected async onDrop(e: DragEvent) {
        const files = e.dataTransfer.files;
        if (e.dataTransfer.items.length === 1 && !files[0].name.endsWith(".js")) {
            // only one file, not a script
            await FileUploadIPC.uploadFile(files[0]);
        } else {
            // Multiple files or a JS file => compress and treat as script
            let scriptName = MainScreen.findScriptName(files);
            if (!scriptName) {
                return;
            }
            scriptName = scriptName.substring(0, scriptName.length - 2) + "zip";
            const zip = new JSZip();
            // Not actually possible here!
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < files.length; ++i) {
                const file = files[i];
                zip.file(file.name, await file.arrayBuffer());
            }
            const zipContent = await zip.generateAsync({type: "uint8array"});
            FileUploadIPC.upload(scriptName, zipContent);
        }
    }

    private renderMultiCoil() {
        const tabs = this.props.coils.map((coil) => {
            const coilTitle = this.getTabTitle(coil);
            return <Nav.Item>
                <Nav.Link eventKey={"coil" + coilSuffix(coil)}>{coilTitle}</Nav.Link>
            </Nav.Item>;
        });
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
                                        ttConfig={this.props.ttConfig}
                                        darkMode={this.props.darkMode}
                                        numCoils={this.props.coils.length}
                                        numKilled={this.props.coils.filter(
                                            (c) => this.getCoilStatus(c).ud.killBitSet,
                                        ).length}
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

    private onConnectionChange(coil: CoilID, newState: Partial<CoilState>) {
        this.setState((oldState) => {
            const oldCoilState = this.getCoilStatus(coil, oldState);
            const index = this.props.coils.indexOf(coil);
            const newStates = [...oldState.coilStates];
            newStates[index] = {...oldCoilState, ...newState};
            return {coilStates: newStates};
        });
    }

    private makeCloseButton() {
        const anyConnected = !this.state.coilStates.every((v) => v.connection === ConnectionStatus.IDLE);
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
        const index = this.props.coils.indexOf(coil);
        return (state || this.state).coilStates[index] ||
            {connection: ConnectionStatus.IDLE, ud: UD3State.DEFAULT_STATE};
    }

    private renderSingleTab(coil: CoilID, type: 'single-coil' | 'combined'): React.ReactNode {
        if (!this.terminal.has(coil)) {
            this.terminal.set(coil, {
                fitter: new FitAddon(),
                terminal: undefined,
            });
        }
        const coilStatus = this.getCoilStatus(coil);
        return <SingleCoilTab
            terminal={this.terminal.get(coil)}
            allowInteraction={coilStatus.connection === ConnectionStatus.CONNECTED}
            ttConfig={this.props.ttConfig}
            connectionStatus={coilStatus.connection}
            darkMode={this.props.darkMode}
            coil={coil}
            ud3State={coilStatus.ud}
            toasts={this.toastsForCoil(coil)}
            level={type}
            returnToConnect={this.props.returnToConnect}
        />;
    }

    private makeScriptPopup(): JSX.Element {
        const confirm = (ok: boolean) => {
            processIPC.send(
                IPC_CONSTANTS_TO_MAIN.script.confirmOrDeny,
                new ConfirmReply(ok, this.state.scriptPopup.confirmationID),
            );
            this.setState({scriptPopupShown: false});
        };
        return <Modal
            show={this.state.scriptPopupShown}
            className={this.props.darkMode && 'tt-dark-modal-root'}
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

    private getTabTitle(coil: CoilID) {
        const coilProps = this.getCoilStatus(coil);
        if (coilProps.name) {
            return coilProps.name;
        } else {
            return 'Unknown UD3';
        }
    }

    private toastUpdater(): ToastUpdater {
        return (update) => this.setState((state) => ({...state, toasts: update(state.toasts)}));
    }

    private toastsForCoil(coil?: CoilID): ToastsProps {
        return {
            closeToast: makeToastRemover(this.toastUpdater()),
            darkMode: this.props.darkMode,
            toasts: getToasts(this.state.toasts, (coil) => this.getCoilStatus(coil).name, coil),
        };
    }

    private static findScriptName(files: FileList) {
        let scriptName: string;
        for (let i = 0; i < files.length; ++i) {
            const file = files[i].name;
            if (file.endsWith(".js")) {
                if (scriptName) {
                    // More than one script => Not able to run
                    return undefined;
                } else {
                    scriptName = file;
                }
            }
        }
        return scriptName;
    }
}
