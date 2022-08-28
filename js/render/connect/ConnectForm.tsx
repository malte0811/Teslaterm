import React from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {CONNECTION_TYPE_DESCS, UD3ConnectionType} from "../../common/constants";
import {IPC_CONSTANTS_TO_MAIN} from "../../common/IPCConstantsToMain";
import {IPC_CONSTANTS_TO_RENDERER, IUDPConnectionSuggestion} from "../../common/IPCConstantsToRenderer";
import {processIPC} from "../ipc/IPCProvider";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {MergedConnectionOptions} from "./ConnectScreen";

export interface ConnectFormProps {
    currentOptions: MergedConnectionOptions;
    setOptions: (newOptions: Partial<MergedConnectionOptions>) => any;
    connecting: boolean;
    darkMode: boolean;
}

export interface ConnectFormState {
    serialSuggestions: string[];
    udpSuggestions: IUDPConnectionSuggestion[];
}

export class ConnectForm extends TTComponent<ConnectFormProps, ConnectFormState> {
    private readonly firstFieldRef: React.RefObject<HTMLInputElement> = React.createRef();

    constructor(props_) {
        super(props_);
        this.state = {
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
        processIPC.send(IPC_CONSTANTS_TO_MAIN.requestConnectSuggestions, undefined);
        if (this.firstFieldRef.current) {
            this.firstFieldRef.current.focus();
        }
    }

    render() {
        const currentType = this.props.currentOptions.currentType;
        let optionsForType: JSX.Element[] = this.getConfigOptions(currentType);
        if (!optionsForType) {
            return <div>Unsupported connection type {currentType}</div>
        }
        let possibleTypes: JSX.Element[] = [];
        for (const [type, desc] of CONNECTION_TYPE_DESCS.entries()) {
            possibleTypes.push(
                <Dropdown.Item
                    key={possibleTypes.length}
                    as={Button}
                    onClick={() => this.props.setOptions({currentType: type})}
                    disabled={this.props.connecting}
                >
                    {desc}
                </Dropdown.Item>
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
                <Button
                    disabled={this.props.connecting}
                    onClick={this.connect}
                    type={'submit'}
                >{this.props.connecting ? 'Connecting…' : 'Connect'}</Button>
            </Form>
        </div>;
    }

    protected makeIntField(label: string, key: keyof MergedConnectionOptions): JSX.Element {
        return <Form.Group as={Row} key={key}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={9}>
                <Form.Control
                    type={'number'}
                    value={this.props.currentOptions[key] as string}
                    onChange={(ev) => {
                        let obj = {};
                        obj[key] = Number.parseInt(ev.target.value);
                        this.props.setOptions(obj);
                    }}
                    disabled={this.props.connecting}
                    className={this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                />
            </Col>
        </Form.Group>;
    }

    protected makeSuggestedField(
        label: string,
        key: keyof MergedConnectionOptions,
        suggestions: string[],
        placeholder?: string
    ): JSX.Element {
        return <Form.Group as={Row} style={{marginBottom: '5px'}} key={key}>
            <Form.Label column>Port</Form.Label>
            <Col sm={9}>
                <Form.Control
                    type={'text'}
                    placeholder={placeholder}
                    value={this.props.currentOptions[key] as string}
                    onChange={(ev) => {
                        // TODO is there a better way to do this?
                        let obj = {};
                        obj[key as string] = ev.target.value;
                        this.props.setOptions(obj);
                    }}
                    list={'suggestions'}
                    ref={this.firstFieldRef}
                    disabled={this.props.connecting}
                    className={this.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                />
                <datalist id={'suggestions'}>
                    {suggestions.map((s, i) => <option value={s} key={i}/>)}
                </datalist>
            </Col>
        </Form.Group>;
    }

    private getConfigOptions(currentType: UD3ConnectionType) {
        switch (currentType) {
            case UD3ConnectionType.serial_min:
            case UD3ConnectionType.serial_plain:
                return [
                    this.makeSuggestedField(
                        'Port', 'serialPort', this.state.serialSuggestions, 'Autoconnect'
                    ),
                    this.makeIntField('Baudrate', 'baudrate'),
                ];
            case UD3ConnectionType.udp_min:
                const suggestionStrings = this.state.udpSuggestions.map(
                    (s) => s.desc ? s.desc + ' (' + s.remoteIP + ')' : s.remoteIP,
                );
                return [
                    this.makeSuggestedField('Remote IP', 'remoteIP', suggestionStrings),
                    this.makeIntField('Remote port', 'udpMinPort'),
                ];
        }
    }

    private connect() {
        processIPC.send(IPC_CONSTANTS_TO_MAIN.connect, {
            connectionType: this.props.currentOptions.currentType,
            options: this.props.currentOptions,
        });
    }
}
