import JSZip from "jszip";
import React from "react";
import {Button, ButtonToolbar, Col, Modal, Nav, Row, Tab} from "react-bootstrap";
import * as xterm from "xterm";
import {FitAddon} from "xterm-addon-fit";
import {ConfirmReply, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConfirmationRequest,
    ConnectionStatus,
    IPC_CONSTANTS_TO_RENDERER,
    IUD3State,
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {FileUploadIPC} from "../ipc/FileUpload";
import {processIPC} from "../ipc/IPCProvider";
import {ScreenWithDrop} from "../ScreenWithDrop";
import {CentralControlTab} from "./CentralControlTab";
import {SingleCoilTab} from "./SingleCoilTab";

interface MainScreenState {
    ud3state: IUD3State;
    scriptPopup: ConfirmationRequest;
    scriptPopupShown: boolean;
}

export interface MainScreenProps {
    ttConfig: TTConfig;
    connectionStatus: ConnectionStatus;
    clearWasConnected: () => any;
    darkMode: boolean;
}

// TODO this is a hack. I'm not 100% sure why, but Terminal does not like open/dispose cycles
export interface TerminalRef {
    terminal?: xterm.Terminal;
    fitter: FitAddon;
}

export class MainScreen extends ScreenWithDrop<MainScreenProps, MainScreenState> {
    private readonly terminal: TerminalRef[];

    constructor(props: any) {
        super(props);
        this.state = {
            scriptPopup: {confirmationID: 0, message: "", title: undefined},
            scriptPopupShown: false,
            ud3state: {
                busActive: false,
                busControllable: false,
                killBitSet: false,
                transientActive: false,
            },
        };
        this.terminal = [];
    }

    public componentDidMount() {
        super.componentDidMount();
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, (state) => this.setState({ud3state: state}));
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.script.requestConfirm,
            (req: ConfirmationRequest) => this.setState({scriptPopup: req, scriptPopupShown: true}),
        );
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
    }

    public render(): React.ReactNode {
        return (
            <div ref={this.mainDivRef} className={'tt-main-screen'}>
                <Tab.Container mountOnEnter={true} transition={false} defaultActiveKey={'control'}>
                    <Col className={'tt-coil-tabs'}>
                        <Row className={'tt-coil-tab-bar'}>
                            <ButtonToolbar className="justify-content-between">
                                <Nav variant={'tabs'}>
                                    <Nav.Item><Nav.Link eventKey="control">Control</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="coil1">Coil 1</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="coil2">Coil 2</Nav.Link></Nav.Item>
                                    <Nav.Item><Nav.Link eventKey="coil3">Coil 3</Nav.Link></Nav.Item>
                                </Nav>
                                <Button
                                    variant={"warning"}
                                    disabled={this.props.connectionStatus !== ConnectionStatus.IDLE}
                                    onClick={this.props.clearWasConnected}
                                >Close</Button>
                            </ButtonToolbar>
                        </Row>
                        <Row className={'tt-coil-tab-main'}>
                            <Tab.Content style={{
                                overflow: 'hidden',
                                flex: '1 1 auto',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <Tab.Pane eventKey="control" style={{
                                    height: '100%',
                                    overflow: 'hidden',
                                }}>
                                    <CentralControlTab
                                        ttConfig={this.props.ttConfig}
                                        darkMode={this.props.darkMode}
                                        ud3state={this.state.ud3state}
                                        />
                                </Tab.Pane>
                                <Tab.Pane eventKey="coil1" style={{
                                    height: '100%',
                                    overflow: 'hidden',
                                }}>{this.renderSingleTab(0)}</Tab.Pane>
                                <Tab.Pane eventKey="coil2" style={{
                                    height: '100%',
                                    overflow: 'hidden',
                                }}>{this.renderSingleTab(1)}</Tab.Pane>
                                <Tab.Pane eventKey="coil3" style={{
                                    height: '100%',
                                    overflow: 'hidden',
                                }}>{this.renderSingleTab(2)}</Tab.Pane>
                            </Tab.Content>
                        </Row>
                    </Col>
                    {this.makeScriptPopup()}
                </Tab.Container>
            </div>
        );
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
            scriptName = scriptName.substr(0, scriptName.length - 2) + "zip";
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

    private renderSingleTab(id: number): React.ReactNode {
        const allowInteraction = this.props.connectionStatus === ConnectionStatus.CONNECTED;
        if (!this.terminal[id]) {
            this.terminal[id] = {
                fitter: new FitAddon(),
                terminal: undefined,
            };
        }
        return <SingleCoilTab
            terminal={this.terminal[id]}
            allowInteraction={allowInteraction}
            ttConfig={this.props.ttConfig}
            connectionStatus={this.props.connectionStatus}
            darkMode={this.props.darkMode}
            ud3state={this.state.ud3state}
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
