import React from "react";
import {Button, Toast, ToastContainer} from "react-bootstrap";
import {ConnectionOptions, SerialConnectionOptions, UDPConnectionOptions} from "../../common/ConnectionOptions";
import {UD3ConnectionType} from "../../common/constants";
import {AvailableSerialPort, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {getDefaultAdvancedOptions, TTConfig} from "../../common/TTConfig";
import {TTComponent} from "../TTComponent";
import {ConnectedSerialDevices} from "./ConnectedSerialDevices";
import {ConnectForm} from "./ConnectForm";
import {ConnectionPresets} from "./ConnectionPresets";

export interface MergedConnectionOptions extends SerialConnectionOptions, UDPConnectionOptions {
    currentType: UD3ConnectionType;
    advanced: AdvancedOptions;
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
        case UD3ConnectionType.dummy:
            return true;
    }
}

export function toSingleOptions(merged: MergedConnectionOptions): ConnectionOptions {
    const advanced = merged.advanced;
    switch (merged.currentType) {
        case UD3ConnectionType.udp_min:
            return {
                advanced,
                connectionType: merged.currentType,
                options: {
                    remoteIP: merged.remoteIP,
                    udpMinPort: merged.udpMinPort,
                },
            };
        case UD3ConnectionType.serial_min:
        case UD3ConnectionType.serial_plain:
            return {
                advanced,
                connectionType: merged.currentType,
                options: {
                    autoProductID: merged.autoProductID,
                    autoVendorID: merged.autoVendorID,
                    autoconnect: merged.autoconnect,
                    baudrate: merged.baudrate,
                    serialPort: merged.serialPort,
                },
            };
        case UD3ConnectionType.dummy:
            return {connectionType: merged.currentType, options: {}, advanced};
    }
}

interface ConnectScreenState {
    error: string;
    showingError: boolean;

    autoPorts: AvailableSerialPort[];
    showingAutoPorts: boolean;

    currentOptions: MergedConnectionOptions;
}

export interface ConnectScreenProps {
    ttConfig: TTConfig;
    connecting: boolean;
    darkMode: boolean;
    setDarkMode: (newVal: boolean) => void;
}

export class ConnectScreen extends TTComponent<ConnectScreenProps, ConnectScreenState> {
    constructor(props: ConnectScreenProps) {
        super(props);
        const connectOptions = this.props.ttConfig.defaultConnectOptions;
        this.state = {
            autoPorts: [],
            currentOptions: {
                currentType: connectOptions.defaultConnectionType || UD3ConnectionType.serial_min,
                ...connectOptions.udpOptions,
                ...connectOptions.serialOptions,
                advanced: getDefaultAdvancedOptions(this.props.ttConfig),
            },
            error: '',
            showingAutoPorts: false,
            showingError: false,
        };
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.connectionError, (error) => this.setState({error, showingError: true}),
        );
    }

    public render(): React.ReactNode {
        const setOptions = (opts: Partial<MergedConnectionOptions>) => this.setState(
            (oldState) => ({currentOptions: {...oldState.currentOptions, ...opts}}),
        );
        return <div className={'tt-connect-screen'}>
            <ConnectForm
                currentOptions={this.state.currentOptions}
                setOptions={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.darkMode}
                openSerialOptionsScreen={autoPorts => this.setState({autoPorts, showingAutoPorts: true})}
            />
            <ConnectionPresets
                mainFormProps={this.state.currentOptions}
                setMainFormProps={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.darkMode}
            />
            {this.makeDarkmodeToggle()}
            {this.makeToast()}
            <ConnectedSerialDevices
                autoPorts={this.state.autoPorts}
                darkMode={this.props.darkMode}
                shown={this.state.showingAutoPorts}
                close={() => this.setState({showingAutoPorts: false})}
                setOption={opts => this.setState({currentOptions: {...this.state.currentOptions, ...opts}})}
            />
        </div>;
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
