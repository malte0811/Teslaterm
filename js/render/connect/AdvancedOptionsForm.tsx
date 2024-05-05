import React, {ReactElement} from "react";
import {Button, Col, Form, OverlayTrigger, Row, Tooltip} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {OverlayInjectedProps} from "react-bootstrap/Overlay";
import {AdvancedOptions, MidiConfig, NetSidConfig} from "../../common/Options";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {FormHelper} from "./FormHelper";

export interface AdvancedFormProps {
    currentOptions: AdvancedOptions;
    setOptions: (newOptions: Partial<AdvancedOptions>) => any;
    darkMode: boolean;
    connecting: boolean;
    keyPrefix?: string;
}

export class AdvancedOptionsForm extends TTComponent<AdvancedFormProps, {}> {
    private readonly helper: FormHelper;

    constructor(props) {
        super(props);
        this.helper = new FormHelper(this, 8);
    }

    public render() {
        return (
            <>
                <Form.Group key={'direct-midi'}>
                    {this.buildDirectMIDIConfig()}
                </Form.Group>
                <Form.Group key={'netsid'}>
                    <Form.Label key={'title'} style={({fontSize: 'large'})}>NetSID settings</Form.Label>
                    {this.buildNetSIDConfig()}
                </Form.Group>
                <Form.Group key={'rtpmidi'}>
                    <Form.Label key={'title'} style={({fontSize: 'large'})}>RTP-MIDI settings</Form.Label>
                    {this.buildRTPMIDIConfig()}
                </Form.Group>
            </>
        );
    }

    private buildNetSIDConfig(): JSX.Element[] {
        const current = this.props.currentOptions.netSidOptions;
        const setOption = (toSet: Partial<NetSidConfig>) => {
            this.props.setOptions({netSidOptions: {...current, ...toSet}});
        };
        const rows: React.JSX.Element[] = [
            this.helper.makeCheckbox(
                "Enable NetSID", current.enabled, enabled => setOption({enabled}), undefined, this.props.keyPrefix,
            ),
        ];
        if (current.enabled) {
            rows.push(this.helper.makeIntField('NetSID port', current.port, port => setOption({port})));
        }
        return rows;
    }

    private buildRTPMIDIConfig(): JSX.Element[] {
        const current = this.props.currentOptions.midiOptions;
        const setOption = (toSet: Partial<MidiConfig>) => {
            this.props.setOptions({midiOptions: {...current, ...toSet}});
        };
        const rows: JSX.Element[] = [this.helper.makeCheckbox(
            "Run RTP-MIDI server",
            current.runMidiServer,
            runMidiServer => setOption({runMidiServer}),
            undefined,
            this.props.keyPrefix,
        )];
        if (current.runMidiServer) {
            rows.push(this.helper.makeIntField('RTP-MIDI port', current.port, port => setOption({port})));
            rows.push(this.helper.makeString('Local name', current.localName, localName => setOption({localName})));
            rows.push(this.helper.makeString(
                'Bonjour name', current.bonjourName, bonjourName => setOption({bonjourName}),
            ));
        }
        return rows;
    }

    private makeSelect<T extends string>(label: string, values: T[], current: T, set: (val: T) => any) {
        const options: ReactElement[] = [];
        for (const value of values) {
            options.push(<Dropdown.Item
                key={value}
                as={Button}
                onClick={() => set(value)}
                disabled={this.props.connecting}
            >
                {value}
            </Dropdown.Item>);
        }
        return (
            <Form.Group as={Row} key={label}>
                <Form.Label column>{label}</Form.Label>
                <Col sm={8}>
                    <TTDropdown
                        title={current}
                        darkMode={this.props.darkMode}
                    >
                        {options}
                    </TTDropdown>
                </Col>
            </Form.Group>
        );
    }

    private buildDirectMIDIConfig() {
        const renderTooltip = (props: OverlayInjectedProps) => <Tooltip {...props}>
            Due to a Chromium issue enabling this causes Teslaterm to acquire all MIDI ports. This can cause issues with
            external interrupters.
        </Tooltip>;
        // Hack: without the width=100% div the tooltip only shows on the checkbox, not its label
        return <OverlayTrigger placement={'top'} overlay={renderTooltip}>
            <div style={{width: '100%'}}>
                {this.helper.makeCheckbox(
                    "Allow direct MIDI input",
                    this.props.currentOptions.enableMIDIInput,
                    (enableMIDIInput) => this.props.setOptions({enableMIDIInput}),
                    undefined,
                    this.props.keyPrefix,
                )}
            </div>
        </OverlayTrigger>;
    }
}
