import React from "react";
import {Button, Toast, ToastContainer} from "react-bootstrap";
import {UD3ConnectionType} from "../../common/constants";
import {InitialFRState, ParsedEvent} from "../../common/FlightRecorderTypes";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {
    SerialConnectionOptions,
    UD3ConnectionOptions,
    UDPConnectionOptions,
} from "../../common/SingleConnectionOptions";
import {SyncedUIConfig} from "../../common/UIConfig";
import {processIPC} from "../ipc/IPCProvider";
import {ScreenWithDrop} from "../ScreenWithDrop";
import {ConnectForm} from "./ConnectForm";
import {ConnectionPresets} from "./ConnectionPresets";

export interface MergedConnectionOptions extends SerialConnectionOptions, UDPConnectionOptions {
    currentType: UD3ConnectionType;
}

export function areOptionsValid(options: MergedConnectionOptions): boolean {
    const isNonEmpty = (toCheck: string) => toCheck.trim().length > 0;
    switch (options.currentType) {
        case UD3ConnectionType.udp_min:
            return isNonEmpty(options.remoteIP) && options.udpMinPort > 0;
        case UD3ConnectionType.serial_min:
        case UD3ConnectionType.serial_plain:
            if (options.autoconnect) {
                return isNonEmpty(options.autoVendorID) && isNonEmpty(options.autoProductID);
            } else {
                return isNonEmpty(options.serialPort);
            }
    }
}

export function toSingleOptions(merged: MergedConnectionOptions): UD3ConnectionOptions {
    switch (merged.currentType) {
        case UD3ConnectionType.udp_min:
            return {
                connectionType: merged.currentType,
                options: {
                    remoteDesc: merged.remoteDesc,
                    remoteIP: merged.remoteIP,
                    udpMinPort: merged.udpMinPort,
                    useDesc: merged.useDesc,
                },
            };
        case UD3ConnectionType.serial_min:
        case UD3ConnectionType.serial_plain:
            return {
                connectionType: merged.currentType,
                options: {
                    autoProductID: merged.autoProductID,
                    autoVendorID: merged.autoVendorID,
                    autoconnect: merged.autoconnect,
                    baudrate: merged.baudrate,
                    serialPort: merged.serialPort,
                },
            };
    }
}

interface ConnectScreenState {
    error: string;
    showingError: boolean;

    currentOptions: MergedConnectionOptions;
    currentAdvancedOptions: AdvancedOptions;
}

export interface FRDisplayData {
    events: ParsedEvent[];
    initial: InitialFRState;
}

export interface ConnectScreenProps {
    config: SyncedUIConfig;
    connecting: boolean;
    setDarkMode: (newVal: boolean) => void;
    openFlightRecording: (data: FRDisplayData) => any;
}

export class ConnectScreen extends ScreenWithDrop<ConnectScreenProps, ConnectScreenState> {
    constructor(props: ConnectScreenProps) {
        super(props);
        const connectOptions = this.props.config.lastConnectOptions;
        console.log(connectOptions);
        this.state = {
            currentAdvancedOptions: this.props.config.advancedOptions,
            currentOptions: {
                currentType: connectOptions.type,
                ...connectOptions.udpOptions,
                ...connectOptions.serialOptions,
            },
            error: '',
            showingError: false,
        };
    }

    public render(): React.ReactNode {
        const setOptions = (opts: Partial<MergedConnectionOptions>) => this.setState(
            (oldState) => ({currentOptions: {...oldState.currentOptions, ...opts}}),
        );
        const setAdvancedOptions = (opts: Partial<AdvancedOptions>) => this.setState(
            (oldState) => ({currentAdvancedOptions: {...oldState.currentAdvancedOptions, ...opts}}),
        );
        return <div className={'tt-connect-screen'} ref={this.mainDivRef}>
            <ConnectForm
                currentOptions={this.state.currentOptions}
                currentAdvancedOptions={this.state.currentAdvancedOptions}
                setOptions={setOptions}
                setAdvancedOptions={setAdvancedOptions}
                connecting={this.props.connecting}
                darkMode={this.props.config.darkMode}
            />
            <ConnectionPresets
                mainAdvanced={this.state.currentAdvancedOptions}
                setMainAdvanced={setAdvancedOptions}
                mainOptions={this.state.currentOptions}
                setMainOptions={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.config.darkMode}
                presets={this.props.config.connectionPresets}
            />
            {this.makeDarkmodeToggle()}
            {this.makeToast()}
        </div>;
    }

    protected async onDrop(e: DragEvent) {
        const files = e.dataTransfer.files;
        if (files.length !== 1 || !files[0].name.endsWith('.zip')) {
            return;
        }
        const data = await files[0].arrayBuffer();
        processIPC.once(IPC_CONSTANTS_TO_RENDERER.flightRecorder.fullList, (frData) => {
            this.props.openFlightRecording(frData);
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.loadFlightRecording, [...new Uint8Array(data)]);
    }

    private makeToast() {
        const style = this.props.config.darkMode ? 'dark' : 'light';
        return <ToastContainer position={'bottom-end'}>
            <Toast
                show={this.state.showingError}
                onClose={() => this.setState({showingError: false})}
                className={'tt-' + style + '-toast'}
                bg={'danger'}
            >
                <Toast.Header>Failed to connect</Toast.Header>
                <Toast.Body>{this.state.error}</Toast.Body>
            </Toast>
        </ToastContainer>;
    }

    private makeDarkmodeToggle() {
        const otherMode = this.props.config.darkMode ? 'light' : 'dark';
        return <Button
            className={'tt-darkmode-toggle'}
            onClick={() => this.props.setDarkMode(!this.props.config.darkMode)}
            variant={otherMode}
        >
            Switch to {otherMode} mode
        </Button>;
    }
}
