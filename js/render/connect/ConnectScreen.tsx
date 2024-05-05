import React from "react";
import {Button, Toast, ToastContainer} from "react-bootstrap";
import {UD3ConnectionType} from "../../common/constants";
import {InitialFRState, ParsedEvent} from "../../common/FlightRecorderTypes";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {AvailableSerialPort, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {
    SerialConnectionOptions,
    UD3ConnectionOptions,
    UDPConnectionOptions,
} from "../../common/SingleConnectionOptions";
import {getDefaultAdvancedOptions, TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {ScreenWithDrop} from "../ScreenWithDrop";
import {ConnectedSerialDevices} from "./ConnectedSerialDevices";
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
                    remoteIP: merged.remoteIP,
                    udpMinPort: merged.udpMinPort,
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

    autoPorts: AvailableSerialPort[];
    showingAutoPorts: boolean;

    currentOptions: MergedConnectionOptions;
    currentAdvancedOptions: AdvancedOptions;
}

export interface FRDisplayData {
    events: ParsedEvent[];
    initial: InitialFRState;
}

export interface ConnectScreenProps {
    ttConfig: TTConfig;
    connecting: boolean;
    darkMode: boolean;
    setDarkMode: (newVal: boolean) => void;
    openFlightRecording: (data: FRDisplayData) => any;
}

export class ConnectScreen extends ScreenWithDrop<ConnectScreenProps, ConnectScreenState> {
    constructor(props: ConnectScreenProps) {
        super(props);
        const connectOptions = this.props.ttConfig.defaultConnectOptions;
        this.state = {
            autoPorts: [],
            currentAdvancedOptions: getDefaultAdvancedOptions(this.props.ttConfig),
            currentOptions: {
                currentType: connectOptions.defaultConnectionType || UD3ConnectionType.serial_min,
                ...connectOptions.udpOptions,
                ...connectOptions.serialOptions,
            },
            error: '',
            showingAutoPorts: false,
            showingError: false,
        };
    }

    public componentDidMount() {
        super.componentDidMount();
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.connectionError, (error) => this.setState({error, showingError: true}),
        );
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
                darkMode={this.props.darkMode}
                openSerialOptionsScreen={autoPorts => this.setState({autoPorts, showingAutoPorts: true})}
            />
            <ConnectionPresets
                mainAdvanced={this.state.currentAdvancedOptions}
                setMainAdvanced={setAdvancedOptions}
                mainOptions={this.state.currentOptions}
                setMainOptions={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.darkMode}
                ttConfig={this.props.ttConfig}
            />
            {this.makeDarkmodeToggle()}
            {this.makeToast()}
            <ConnectedSerialDevices
                autoPorts={this.state.autoPorts}
                darkMode={this.props.darkMode}
                shown={this.state.showingAutoPorts}
                close={() => this.setState({showingAutoPorts: false})}
                setOption={setOptions}
            />
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
        const style = this.props.darkMode ? 'dark' : 'light';
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
        const otherMode = this.props.darkMode ? 'light' : 'dark';
        return <Button
            className={'tt-darkmode-toggle'}
            onClick={() => this.props.setDarkMode(!this.props.darkMode)}
            variant={otherMode}
        >
            Switch to {otherMode} mode
        </Button>;
    }
}
