import React from "react";
import {Accordion, Button, Form} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {
    AvailableSerialPort,
    IPC_CONSTANTS_TO_RENDERER,
    IUDPConnectionSuggestion,
} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {AdvancedOptionsForm} from "./AdvancedOptionsForm";
import {areOptionsValid, MergedConnectionOptions, toSingleOptions} from "./ConnectScreen";
import {FormHelper} from "./FormHelper";

export interface ConnectFormProps {
    currentOptions: MergedConnectionOptions;
    setOptions: (newOptions: Partial<MergedConnectionOptions>) => any;
    connecting: boolean;
    darkMode: boolean;
    openSerialOptionsScreen: (options: AvailableSerialPort[]) => any;
}

export interface ConnectFormState {
    availableSerialPorts: AvailableSerialPort[];
    udpSuggestions: IUDPConnectionSuggestion[];
    serialAutoconnect: boolean;
}

export class ConnectForm extends TTComponent<ConnectFormProps, ConnectFormState> {
    private static abort() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.menu.connectButton, undefined);
    }

    private readonly firstFieldRef: React.RefObject<HTMLInputElement> = React.createRef();
    private readonly helper: FormHelper;

    constructor(props) {
        super(props);
        this.state = {
            availableSerialPorts: [],
            serialAutoconnect: this.props.currentOptions.serialPort !== undefined,
            udpSuggestions: [],
        };
        this.connect = this.connect.bind(this);
        this.helper = new FormHelper(this, 9);
    }

    public componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.setUDPSuggestions, (suggestion: IUDPConnectionSuggestion[]) => {
                this.setState({udpSuggestions: suggestion});
            },
        );
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions, (ports: AvailableSerialPort[]) => {
            this.setState({availableSerialPorts: ports});
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.requestSuggestions, undefined);
        if (this.firstFieldRef.current) {
            this.firstFieldRef.current.focus();
        }
    }

    public render() {
        const currentType = this.props.currentOptions.currentType;
        const optionsForType = this.getConfigOptions(currentType);
        if (!optionsForType) {
            return <div>Unsupported connection type {currentType}</div>;
        }
        const possibleTypes: JSX.Element[] = [];
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
                <Accordion
                    defaultActiveKey={'-1'}
                    className={this.props.darkMode && 'dark-accordion'}
                >
                    <Accordion.Item eventKey={'0'}>
                        <Accordion.Header>Advanced settings</Accordion.Header>
                        <Accordion.Body style={({
                            // TODO sort of a hack, but works well enough
                            height: '50vh',
                            overflowY: 'auto',
                        })}>
                            <AdvancedOptionsForm
                                currentOptions={this.props.currentOptions.advanced}
                                setOptions={opts => {
                                    this.props.setOptions({advanced: {...this.props.currentOptions.advanced, ...opts}});
                                }}
                                darkMode={this.props.darkMode}
                                connecting={this.props.connecting}
                            />
                        </Accordion.Body>
                    </Accordion.Item>
                </Accordion>
                <Button
                    onClick={this.props.connecting ? ConnectForm.abort : this.connect}
                    variant={this.props.connecting ? 'warning' : 'primary'}
                    type={'submit'}
                    disabled={!this.props.connecting && !areOptionsValid(this.props.currentOptions)}
                >{this.props.connecting ? 'Abort connection' : 'Connect'}</Button>
            </Form>
        </div>;
    }

    private getConfigOptions(currentType: UD3ConnectionType): JSX.Element[] {
        switch (currentType) {
            case UD3ConnectionType.serial_min:
            case UD3ConnectionType.serial_plain:
                return this.makeSerialOptions();
            case UD3ConnectionType.udp_min:
                const options = this.props.currentOptions;
                const suggestionStrings = this.state.udpSuggestions.map(
                    (s) => s.desc ? s.desc + ' (' + s.remoteIP + ')' : s.remoteIP,
                );
                return [
                    this.helper.makeSuggestedField(
                        'Remote IP',
                        options.remoteIP,
                        remoteIP => this.props.setOptions({remoteIP}),
                        suggestionStrings,
                        this.firstFieldRef,
                    ),
                    this.helper.makeIntField(
                        'Remote port', options.udpMinPort, udpMinPort => this.props.setOptions({udpMinPort}),
                    ),
                ];
        }
    }

    private makeSerialOptions(): JSX.Element[] {
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
            'Show connected devices',
            () => this.props.openSerialOptionsScreen(this.state.availableSerialPorts),
        ));
        formElements.push(this.helper.makeIntField(
            'Baudrate', options.baudrate, baudrate => this.props.setOptions({baudrate}),
        ));
        return formElements;
    }

    private connect() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect.connect, toSingleOptions(this.props.currentOptions));
    }
}
