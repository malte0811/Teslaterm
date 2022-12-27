import React from "react";
import {Button, Modal, Table, Toast, ToastContainer} from "react-bootstrap";
import {ConnectionOptions, SerialConnectionOptions, UDPConnectionOptions} from "../../common/ConnectionOptions";
import {UD3ConnectionType} from "../../common/constants";
import {AutoSerialPort, IPC_CONSTANTS_TO_RENDERER} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {getDefaultAdvanccedOptions, TTConfig} from "../../common/TTConfig";
import {TTComponent} from "../TTComponent";
import {ConnectForm} from "./ConnectForm";
import {ConnectionPresets} from "./ConnectionPresets";

export interface MergedConnectionOptions extends SerialConnectionOptions, UDPConnectionOptions {
    currentType: UD3ConnectionType;
    advanced: AdvancedOptions;
}

export function toSingleOptions(merged: MergedConnectionOptions): ConnectionOptions {
    const advanced = merged.advanced;
    switch (merged.currentType) {
        case UD3ConnectionType.udp_min:
            return {
                connectionType: merged.currentType,
                options: {
                    udpMinPort: merged.udpMinPort,
                    remoteIP: merged.remoteIP,
                },
                advanced
            };
        case UD3ConnectionType.serial_min:
        case UD3ConnectionType.serial_plain:
            return {
                connectionType: merged.currentType,
                options: {
                    serialPort: merged.serialPort,
                    autoProductID: merged.autoProductID,
                    autoVendorID: merged.autoVendorID,
                    baudrate: merged.baudrate,
                },
                advanced
            };
        case UD3ConnectionType.dummy:
            return {connectionType: merged.currentType, options: {}, advanced};
    }
}

interface ConnectScreenState {
    error: string;
    showingError: boolean;

    autoPorts: AutoSerialPort[];
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
            error: '',
            showingError: false,
            autoPorts: [],
            showingAutoPorts: false,
            currentOptions: {
                currentType: connectOptions.defaultConnectionType || UD3ConnectionType.serial_min,
                ...connectOptions.udpOptions,
                ...connectOptions.serialOptions,
                advanced: getDefaultAdvanccedOptions(this.props.ttConfig),
            },
        };
    }

    componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.connectionError, (error) => this.setState({error, showingError: true})
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.showAutoPortOptions, (options) => this.setState({
                autoPorts: options,
                showingAutoPorts: true,
            })
        );
    }

    render(): React.ReactNode {
        const setOptions = (opts: Partial<MergedConnectionOptions>) => this.setState(
            (oldState) => ({currentOptions: {...oldState.currentOptions, ...opts}})
        );
        return <div className={'tt-connect-screen'}>
            <ConnectForm
                currentOptions={this.state.currentOptions}
                setOptions={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.darkMode}
            />
            <ConnectionPresets
                mainFormProps={this.state.currentOptions}
                setMainFormProps={setOptions}
                connecting={this.props.connecting}
                darkMode={this.props.darkMode}
            />
            {this.makeDarkmodeToggle()}
            {this.makeToast()}
            {this.makeModal()}
        </div>;
    }

    private makeToast() {
        const style = this.props.darkMode ? 'dark' : 'light';
        return <ToastContainer position={'bottom-end'}>
            <Toast
                show={this.state.showingError}
                onClose={() => this.setState({showingError: false})}
                className={'tt-' + style + '-toast'}
                bg={style}
            >
                <Toast.Header>Failed to connect</Toast.Header>
                <Toast.Body>{this.state.error}</Toast.Body>
            </Toast>
        </ToastContainer>;
    }

    private makeModal() {
        const makeRow = (port: AutoSerialPort) => <tr key={port.path}>
            <td>{port.path}</td><td>{port.manufacturer}</td><td>{port.vendorID}</td><td>{port.productID}</td>
        </tr>;
        const table = <Table hover bordered>
            <thead><tr>
                <th>Port</th><th>Manufacturer</th><th>Vendor ID</th><th>Product ID</th>
            </tr></thead>
            <tbody>{this.state.autoPorts.map(makeRow)}</tbody>
        </Table>;
        const close = () => this.setState({showingAutoPorts: false});
        return <Modal
            show={this.state.showingAutoPorts}
            onHide={close}
            size={"lg"}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Header>Data for autoconnect</Modal.Header>
            <Modal.Body>{table}</Modal.Body>
            <Modal.Footer>
                <Button onClick={close}>Close</Button>
            </Modal.Footer>
        </Modal>;
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
