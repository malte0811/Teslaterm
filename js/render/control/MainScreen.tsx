import JSZip from "jszip";
import React from "react";
import {Button, Modal} from "react-bootstrap";
import * as xterm from "xterm";
import {FitAddon} from "xterm-addon-fit";
import {ConfirmReply, IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    ConfirmationRequest,
    ConnectionStatus,
    IPC_CONSTANTS_TO_RENDERER,
    IUD3State
} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {FileUploadIPC} from "../ipc/FileUpload";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {Gauges} from "./gauges/Gauges";
import {MenuBar} from "./menu/Menu";
import {Oscilloscope} from "./scope/Oscilloscope";
import {Sliders} from "./sliders/Sliders";
import {Terminal} from "./Terminal";
import {Toasts} from "./Toasts";

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

export class MainScreen extends TTComponent<MainScreenProps, MainScreenState> {
    private readonly terminal: TerminalRef;
    private readonly mainDivRef: React.RefObject<HTMLDivElement>;
    private readonly dropListener: (e: DragEvent) => any;
    private readonly dragoverListener: (e: DragEvent) => any;

    constructor(props: any) {
        super(props);
        this.state = {
            scriptPopup: {confirmationID: 0, message: "", title: undefined},
            scriptPopupShown: false,
            ud3state: {
                busActive: false,
                killBitSet: false,
                busControllable: false,
                transientActive: false,
            },
        };
        this.terminal = {
            fitter: new FitAddon(),
            terminal: undefined,
        };
        this.mainDivRef = React.createRef();
        this.dropListener = (e) => {
            this.onDrop(e).catch((err) => console.error('While processing dropped files:', err));
        };
        this.dragoverListener = (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        };
    }

    public componentDidMount() {
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.menu.ud3State, (state) => this.setState({ud3state: state}));
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.script.requestConfirm,
            (req: ConfirmationRequest) => this.setState({scriptPopup: req, scriptPopupShown: true}),
        )
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestFullSync, undefined);
        if (this.mainDivRef.current) {
            this.mainDivRef.current.addEventListener('dragover', this.dragoverListener);
            this.mainDivRef.current.addEventListener('drop', this.dropListener);
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        if (this.mainDivRef.current) {
            this.mainDivRef.current.removeEventListener('dragover', this.dragoverListener);
            this.mainDivRef.current.removeEventListener('drop', this.dropListener);
        }
    }

    public render(): React.ReactNode {
        const allowInteraction = this.props.connectionStatus == ConnectionStatus.CONNECTED;
        return <div className={'tt-main-screen'} ref={this.mainDivRef}>
            <div className={'tt-menu-bar'}>
                <MenuBar
                    ud3state={this.state.ud3state}
                    connectionStatus={this.props.connectionStatus}
                    ttConfig={this.props.ttConfig}
                    clearWasConnected={this.props.clearWasConnected}
                    darkMode={this.props.darkMode}
                />
            </div>
            <div className={'tt-terminal-and-gauges'}>
                <div className={'tt-terminal-container'}>
                    <div className={'tt-scope-container'}>
                        <Oscilloscope/>
                        <Sliders
                            ud3State={this.state.ud3state}
                            disabled={!allowInteraction}
                            enableMIDI={this.props.ttConfig.useMIDIPorts}
                            darkMode={this.props.darkMode}
                        />
                    </div>
                    <Terminal
                        terminal={this.terminal}
                        disabled={!allowInteraction}
                    />
                </div>
                <Gauges darkMode={this.props.darkMode}/>
            </div>
            {this.makeScriptPopup()}
            <Toasts darkMode={this.props.darkMode}/>
        </div>;
    }

    private async onDrop(e: DragEvent) {
        e.stopPropagation();
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (e.dataTransfer.items.length === 1 && !files[0].name.endsWith(".js")) {
            // only one file, not a script
            FileUploadIPC.uploadFile(files[0]);
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
