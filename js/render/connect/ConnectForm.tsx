import React from "react";
import {Button, Col, DropdownButton, Form, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {baudrate, connection_type, remote_ip, serial_port, udp_min_port} from "../../common/ConnectionOptions";
import {connection_types, serial_min, serial_plain, udp_min} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUDPConnectionSuggestion} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";

export interface ConnectFormProps {
    ttConfig: TTConfig;
    connecting: boolean;
}

export interface ConnectFormState {
    currentType: string;

    serialPort: string;
    baudrate: string;
    serialSuggestions: string[];

    remoteIP: string;
    udpPort: string;
    udpSuggestions: IUDPConnectionSuggestion[];
}

export class ConnectForm extends TTComponent<ConnectFormProps, ConnectFormState> {
    private readonly firstFieldRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props) {
        super(props);
        let startType;
        if (props.ttConfig.autoconnect && connection_types.has(props.ttConfig.autoconnect)) {
            startType = props.ttConfig.autoconnect;
        } else {
            startType = serial_min;
        }
        this.state = {
            currentType: startType,
            serialPort: props.ttConfig.serial.serial_port,
            baudrate: props.ttConfig.serial.baudrate.toString(),
            remoteIP: props.ttConfig.ethernet.remote_ip,
            udpPort: props.ttConfig.ethernet.udpMinPort.toString(),
            serialSuggestions: [],
            udpSuggestions: [],
        };
        this.connect = this.connect.bind(this);
    }

    componentDidMount() {
        this.addIPCListener(
            IPC_CONSTANTS_TO_RENDERER.connect.setUDPSuggestions, (suggestion: IUDPConnectionSuggestion[]) => {
                this.setState({udpSuggestions: suggestion})
            }
        );
        this.addIPCListener(IPC_CONSTANTS_TO_RENDERER.connect.setSerialSuggestions, (suggestions: string[]) => {
            this.setState({serialSuggestions: suggestions});
        });
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestConnectSuggestions);
        if (this.firstFieldRef.current) {
            this.firstFieldRef.current.focus();
        }
    }

    render() {
        let optionsForType: JSX.Element[] = this.getConfigOptions();
        if (!optionsForType) {
            return <div>Unsupported connection type {this.state.currentType}</div>
        }
        let possibleTypes: JSX.Element[] = [];
        for (const [type, desc] of connection_types.entries()) {
            possibleTypes.push(
                <Dropdown.Item
                    key={possibleTypes.length}
                    as={Button}
                    onClick={() => this.setState({currentType: type})}
                    disabled={this.props.connecting}
                >
                    {desc}
                </Dropdown.Item>
            );
        }
        return <div className={'tt-connect-form'}>
            <DropdownButton title={connection_types.get(this.state.currentType)}>
                {possibleTypes}
            </DropdownButton>
            <Form onSubmit={e => e.preventDefault()}>
                {optionsForType}
                <Button
                    disabled={this.props.connecting}
                    onClick={this.connect}
                    type={'submit'}
                >{this.props.connecting ? 'Connecting…' : 'Connect'}</Button>
            </Form>
        </div>;
    }

    protected makeField(
        label: string,
        isNumber: boolean,
        key: keyof ConnectFormState,
        first: boolean = false,
    ): JSX.Element {
        return <Form.Group as={Row}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={9}>
                <Form.Control
                    type={isNumber? 'number' : 'text'}
                    value={this.state[key] as string}
                    onChange={(ev) => {
                        let obj = {};
                        obj[key] = ev.target.value;
                        this.setState(obj);
                    }}
                    disabled={this.props.connecting}
                    ref={first ? this.firstFieldRef : undefined}
                />
            </Col>
        </Form.Group>;
    }

    protected makeSuggestedField(
        label: string,
        key: keyof ConnectFormState,
        suggestions: string[],
        first: boolean = false,
        placeholder?: string
    ): JSX.Element {
        return <Form.Group as={Row} style={{marginBottom: '5px'}}>
            <Form.Label column>Port</Form.Label>
            <Col sm={9}>
                <Form.Control
                    type={'text'}
                    placeholder={placeholder}
                    value={this.state[key] as string}
                    onChange={(ev) => {
                        // TODO is there a better way to do this?
                        let obj = {};
                        obj[key] = ev.target.value;
                        this.setState(obj);
                    }}
                    list={'suggestions'}
                    ref={first ? this.firstFieldRef : undefined}
                    disabled={this.props.connecting}
                />
                <datalist id={'suggestions'}>
                    {suggestions.map((s, i) => <option value={s} key={i}/>)}
                </datalist>
            </Col>
        </Form.Group>
    }

    private getConfigOptions() {
        switch (this.state.currentType) {
            case serial_min:
            case serial_plain:
                return [
                    this.makeSuggestedField(
                        'Port', 'serialPort', this.state.serialSuggestions, true, 'Autoconnect'
                    ),
                    this.makeField('Baudrate', true, 'baudrate'),
                ];
            case udp_min:
                const suggestionStrings = this.state.udpSuggestions.map(
                    (s) => s.desc ? s.desc + ' (' + s.remoteIP + ')' : s.remoteIP,
                );
                return [
                    this.makeSuggestedField('Remote IP', 'remoteIP', suggestionStrings, true),
                    this.makeField('Remote port', true, 'udpPort'),
                ];
        }
    }

    private connect() {
        const options = {};
        options[connection_type] = this.state.currentType;
        options[serial_port] = this.state.serialPort;
        options[baudrate] = Number.parseInt(this.state.baudrate);
        options[remote_ip] = this.state.remoteIP;
        options[udp_min_port] = this.state.udpPort;
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect, options);
    }
}
