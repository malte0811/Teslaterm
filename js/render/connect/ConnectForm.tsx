import React from "react";
import {Button, Form} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    AvailableSerialPort,
    IPC_CONSTANTS_TO_RENDERER,
    IUDPConnectionSuggestion,
} from "../../common/IPCConstantsToRenderer";
import {AdvancedOptions} from "../../common/Options";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {AdvancedOptionsForm} from "./AdvancedOptionsForm";
import {ConnectedDevices, DeviceInfo} from "./ConnectedDevices";
import {areOptionsValid, MergedConnectionOptions, toSingleOptions} from "./ConnectScreen";
import {FormHelper} from "./FormHelper";

export interface ConnectFormProps {
    currentOptions: MergedConnectionOptions;
    currentAdvancedOptions: AdvancedOptions;
    setOptions: (newOptions: Partial<MergedConnectionOptions>) => any;
    setAdvancedOptions: (newOptions: Partial<AdvancedOptions>) => any;
    connecting: boolean;
    darkMode: boolean;
}

enum ShownPopup {
    none,
    serial,
    udp,
}

interface ConnectFormState {
    availableSerialPorts: AvailableSerialPort[];
    udpSuggestions: IUDPConnectionSuggestion[];
    shownPopup: ShownPopup;
}

export class ConnectForm extends TTComponent<ConnectFormProps, ConnectFormState> {
    private static abort() {
        // TODO
        //  processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.connectButton, undefined);
    }

    private readonly firstFieldRef: React.RefObject<HTMLInputElement> = React.createRef();
    private readonly helper: FormHelper;
    private suggestionTimer: NodeJS.Timeout;

    constructor(props: ConnectFormProps) {
        super(props);
        this.state = {
            availableSerialPorts: [],
            shownPopup: ShownPopup.none,
            udpSuggestions: [],
        };
        this.connect = this.connect.bind(this);
        this.helper = new FormHelper(this, 8);
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.setUDPSuggestions,
            (suggestion: IUDPConnectionSuggestion[]) => this.setState({udpSuggestions: suggestion}),
        );
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions,
            (ports: AvailableSerialPort[]) => this.setState({availableSerialPorts: ports}),
        );
        const requestSuggestions = () => processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.requestSuggestions, undefined);
        this.suggestionTimer = setInterval(requestSuggestions, 10000);
        requestSuggestions();
        if (this.firstFieldRef.current) {
            this.firstFieldRef.current.focus();
        }
    }

    public componentWillUnmount() {
        super.componentWillUnmount();
        clearInterval(this.suggestionTimer);
    }

    public render() {
        const currentType = this.props.currentOptions.currentType;
        const optionsForType = this.getConfigOptions(currentType);
        if (!optionsForType) {
            return <div>Unsupported connection type {currentType}</div>;
        }
        const possibleTypes: React.JSX.Element[] = [];
        for (const [type, desc] of CONNECTION_TYPE_DESCS.entries()) {
            possibleTypes.push(
                <Dropdown.Item
                    key={possibleTypes.length}
                    as={Button}
                    onClick={() => this.props.setOptions({currentType: type})}
                    disabled={this.props.connecting}
                >
                    {desc}
                </Dropdown.Item>,
            );
        }
        return <div className={'tt-connect-form'}>
            <TTDropdown
                title={CONNECTION_TYPE_DESCS.get(currentType)}
                darkMode={this.props.darkMode}
            >
                {possibleTypes}
            </TTDropdown>
            <Form onSubmit={e => e.preventDefault()}>
                {optionsForType}
                <AdvancedOptionsForm
                    currentOptions={this.props.currentAdvancedOptions}
                    setOptions={this.props.setAdvancedOptions}
                    darkMode={this.props.darkMode}
                    connecting={this.props.connecting}
                    showMixer={false}
                />
                <Button
                    onClick={this.props.connecting ? ConnectForm.abort : this.connect}
                    variant={this.props.connecting ? 'warning' : 'primary'}
                    type={'submit'}
                    disabled={!this.props.connecting && !areOptionsValid(this.props.currentOptions)}
                >{this.props.connecting ? 'Abort connection' : 'Connect'}</Button>
            </Form>
            {this.makeConnectedSerialPopup()}
            {this.makeConnectedUDPPopup()}
        </div>;
    }

    private getConfigOptions(currentType: UD3ConnectionType): React.JSX.Element[] {
        return currentType === UD3ConnectionType.udp_min ? this.makeUDPOptions() : this.makeSerialOptions();
    }

    private makeSerialOptions(): React.JSX.Element[] {
        const options = this.props.currentOptions;
        const auto = options.autoconnect;
        const formElements = [
            this.helper.makeCheckbox(
                "Autoconnect", auto, autoconnect => this.props.setOptions({autoconnect}), this.firstFieldRef,
            ),
        ];
        if (options.autoconnect) {
            formElements.push(this.helper.makeString(
                "Vendor", options.autoVendorID, autoVendorID => this.props.setOptions({autoVendorID}),
            ));
            formElements.push(this.helper.makeString(
                "Product", options.autoProductID, pid => this.props.setOptions({autoProductID: pid}),
            ));
        } else {
            formElements.push(this.helper.makeSuggestedField(
                'Port',
                options.serialPort,
                serialPort => this.props.setOptions({serialPort}),
                this.state.availableSerialPorts.map(p => p.path),
            ));
        }
        formElements.push(this.helper.makeButton(
            'Show connected devices', () => this.setState({shownPopup: ShownPopup.serial}),
        ));
        formElements.push(this.helper.makeIntField(
            'Baudrate', options.baudrate, baudrate => this.props.setOptions({baudrate}),
        ));
        return formElements;
    }

    private makeUDPOptions(): React.JSX.Element[] {
        const options = this.props.currentOptions;
        const suggestionStrings = this.state.udpSuggestions.map(
            (s) => s.desc ? s.desc + ' (' + s.remoteIP + ')' : s.remoteIP,
        );
        const formElements = [
            this.helper.makeCheckbox(
                "Connect by name", options.useDesc, useDesc => this.props.setOptions({useDesc}), this.firstFieldRef,
            ),
        ];
        if (options.useDesc) {
            formElements.push(this.helper.makeString(
                "UD3 Name", options.remoteDesc, remoteDesc => this.props.setOptions({remoteDesc}),
            ));
        } else {
            formElements.push(this.helper.makeSuggestedField(
                'Remote IP',
                options.remoteIP,
                remoteIP => this.props.setOptions({remoteIP}),
                suggestionStrings,
                this.firstFieldRef,
            ));
        }
        formElements.push(this.helper.makeButton(
            'Show connected devices',
            () => this.setState({shownPopup: ShownPopup.udp}),
        ));
        formElements.push(this.helper.makeIntField(
            'Remote port', options.udpMinPort, udpMinPort => this.props.setOptions({udpMinPort}),
        ));
        return formElements;
    }

    private connect() {
        processIPC.send(
            IPC_CONSTANTS_TO_MAIN.connect.connect,
            {...toSingleOptions(this.props.currentOptions), advanced: this.props.currentAdvancedOptions},
        );
    }

    private makeConnectedSerialPopup() {
        const rows: DeviceInfo[] = this.state.availableSerialPorts.map((port) => ({
            columns: [port.path, port.manufacturer, port.vendorID, port.productID],
            select: () => this.props.setOptions({
                autoProductID: port.productID,
                autoVendorID: port.vendorID,
                serialPort: port.path,
            }),
        }));
        return <ConnectedDevices
            columnTitles={['Port', 'Manufacturer', 'Vendor ID', 'Product ID']}
            rows={rows}
            darkMode={this.props.darkMode}
            shown={this.state.shownPopup === ShownPopup.serial}
            close={() => this.setState({shownPopup: ShownPopup.none})}
            key={'serial-suggestions'}
        />;
    }

    private makeConnectedUDPPopup() {
        const rows: DeviceInfo[] = this.state.udpSuggestions.map((suggestion) => ({
            columns: [suggestion.desc, suggestion.remoteIP],
            select: () => this.props.setOptions({remoteDesc: suggestion.desc, remoteIP: suggestion.remoteIP}),
        }));
        return <ConnectedDevices
            columnTitles={['Description', 'Remote address']}
            rows={rows}
            darkMode={this.props.darkMode}
            shown={this.state.shownPopup === ShownPopup.udp}
            close={() => this.setState({shownPopup: ShownPopup.none})}
            key={'udp-suggestions'}
        />;
    }
}
