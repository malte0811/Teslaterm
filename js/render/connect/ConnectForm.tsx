import React from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {ConnectionOptions, SerialConnectionOptions, UDPConnectionOptions} from "../../common/ConnectionOptions";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUDPConnectionSuggestion} from "../../common/IPCConstantsToRenderer";
import {TTConfig} from "../../common/TTConfig";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";

export interface ConnectFormProps {
    ttConfig: TTConfig;
    connecting: boolean;
    darkMode: boolean;
}

export interface ConnectFormState extends SerialConnectionOptions, UDPConnectionOptions{
    currentType: UD3ConnectionType;
    serialSuggestions: string[];
    udpSuggestions: IUDPConnectionSuggestion[];
}

export class ConnectForm extends TTComponent<ConnectFormProps, ConnectFormState> {
    private readonly firstFieldRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props_) {
        super(props_);
        const connectOptions = this.props.ttConfig.defaultConnectOptions;
        this.state = {
            currentType: connectOptions.defaultConnectionType || UD3ConnectionType.serial_min,
            serialSuggestions: [],
            udpSuggestions: [],
            ...connectOptions.serialOptions,
            ...connectOptions.udpOptions,
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
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestConnectSuggestions, undefined);
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
        for (const [type, desc] of CONNECTION_TYPE_DESCS.entries()) {
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
            <TTDropdown
                title={CONNECTION_TYPE_DESCS.get(this.state.currentType)}
                darkMode={this.props.darkMode}
            >
                {possibleTypes}
            </TTDropdown>
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
        label: string, isNumber: boolean, key: keyof ConnectFormState, first: boolean = false,
    ): JSX.Element {
        return <Form.Group as={Row} key={key}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={9}>
                <Form.Control
                    type={isNumber? 'number' : 'text'}
                    value={this.state[key] as string}
                    onChange={(ev) => {
                        let obj = {};
                        obj[key] = isNumber ? Number.parseInt(ev.target.value) : ev.target.value;
                        this.setState(obj);
                    }}
                    disabled={this.props.connecting}
                    ref={first ? this.firstFieldRef : undefined}
                    className={this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                />
            </Col>
        </Form.Group>;
    }

    protected makeSuggestedField(
        label: string, key: keyof ConnectFormState, suggestions: string[], first: boolean = false, placeholder?: string
    ): JSX.Element {
        return <Form.Group as={Row} style={{marginBottom: '5px'}} key={key}>
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
                    className={this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                />
                <datalist id={'suggestions'}>
                    {suggestions.map((s, i) => <option value={s} key={i}/>)}
                </datalist>
            </Col>
        </Form.Group>;
    }

    private getConfigOptions() {
        switch (this.state.currentType) {
            case UD3ConnectionType.serial_min:
            case UD3ConnectionType.serial_plain:
                return [
                    this.makeSuggestedField(
                        'Port', 'serialPort', this.state.serialSuggestions, true, 'Autoconnect'
                    ),
                    this.makeField('Baudrate', true, 'baudrate'),
                ];
            case UD3ConnectionType.udp_min:
                const suggestionStrings = this.state.udpSuggestions.map(
                    (s) => s.desc ? s.desc + ' (' + s.remoteIP + ')' : s.remoteIP,
                );
                return [
                    this.makeSuggestedField('Remote IP', 'remoteIP', suggestionStrings, true),
                    this.makeField('Remote port', true, 'udpMinPort'),
                ];
        }
    }

    private connect() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect, {connectionType: this.state.currentType, options: this.state});
    }
}
