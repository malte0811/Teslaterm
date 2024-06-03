import React from "react";
import {Accordion, Button, Col, Form, OverlayTrigger, Row, Tooltip} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {OverlayInjectedProps} from "react-bootstrap/Overlay";
import {
    AdvancedOptions,
    getMixerTypeName,
    MidiConfig,
    NetSidConfig,
    PHYSICAL_MIXER_TYPES,
    PhysicalMixerConfig,
    PhysicalMixerType
} from "../../common/Options";
import {TTComponent} from "../TTComponent";
import {TTDropdown} from "../TTDropdown";
import {FormHelper} from "./FormHelper";

export interface AdvancedFormProps {
    currentOptions: AdvancedOptions;
    setOptions: (newOptions: Partial<AdvancedOptions>) => any;
    darkMode: boolean;
    connecting: boolean;
    keyPrefix?: string;
    showMixer: boolean;
}

export class AdvancedOptionsForm extends TTComponent<AdvancedFormProps, {}> {
    private readonly helper: FormHelper;

    constructor(props: AdvancedFormProps) {
        super(props);
        this.helper = new FormHelper(this, 8);
    }

    public render() {
        const mixerElement = (() => {
            if (this.props.showMixer) {
                return <Form.Group key={'mixer'} style={{borderTop: 'solid'}}>
                    {this.buildPhysicalMixerConfig()}
                </Form.Group>;
            } else {
                return <></>;
            }
        })();
        return (
            <Accordion defaultActiveKey={'-1'} className={this.props.darkMode && 'dark-accordion'}>
                <Accordion.Item eventKey={'0'}>
                    <Accordion.Header>Advanced Settings</Accordion.Header>
                    <Accordion.Body style={({
                        // TODO sort of a hack, but works well enough
                        height: '50vh',
                        overflowY: 'auto',
                    })}>
                        <Form.Group key={'direct-midi'}>
                            {this.buildDirectMIDIConfig()}
                        </Form.Group>
                        <Form.Group key={'netsid'} style={{borderTop: 'solid'}}>
                            {this.buildNetSIDConfig()}
                        </Form.Group>
                        <Form.Group key={'rtpmidi'} style={{borderTop: 'solid'}}>
                            {this.buildRTPMIDIConfig()}
                        </Form.Group>
                        {mixerElement}
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>
        );
    }

    private buildNetSIDConfig(): React.JSX.Element[] {
        const current = this.props.currentOptions.netSidOptions;
        const setOption = (toSet: Partial<NetSidConfig>) => {
            this.props.setOptions({netSidOptions: {...current, ...toSet}});
        };
        const rows: React.JSX.Element[] = [
            this.helper.makeLargeLabeledCheckbox(
                'NetSID',
                'Enable NetSID',
                current.enabled,
                    enabled => setOption({enabled}),
                undefined,
                this.props.keyPrefix,
            ),
        ];
        if (current.enabled) {
            rows.push(this.helper.makeIntField('NetSID port', current.port, port => setOption({port})));
        }
        return rows;
    }

    private buildRTPMIDIConfig(): React.JSX.Element[] {
        const current = this.props.currentOptions.midiOptions;
        const setOption = (toSet: Partial<MidiConfig>) => {
            this.props.setOptions({midiOptions: {...current, ...toSet}});
        };
        const rows: React.JSX.Element[] = [
            this.helper.makeLargeLabeledCheckbox(
                'RTP-MIDI',
                'Run RTP-MIDI server',
                current.runMidiServer,
                runMidiServer => setOption({runMidiServer}),
                undefined,
                this.props.keyPrefix,
            ),
        ];
        if (current.runMidiServer) {
            rows.push(this.helper.makeIntField('RTP-MIDI port', current.port, port => setOption({port})));
            rows.push(this.helper.makeString('Local name', current.localName, localName => setOption({localName})));
            rows.push(this.helper.makeString(
                'Bonjour name', current.bonjourName, bonjourName => setOption({bonjourName}),
            ));
        }
        return rows;
    }

    private buildPhysicalMixerConfig(): React.JSX.Element[] {
        const current = this.props.currentOptions.mixerOptions;
        const setOption = (toSet: Partial<PhysicalMixerConfig>) => {
            this.props.setOptions({mixerOptions: {...current, ...toSet}});
        };
        const rows: React.JSX.Element[] = [this.buildMixerOptions(current.type, (type) => setOption({type}))];
        if (current.type === PhysicalMixerType.behringer_x_touch) {
            rows.push(this.helper.makeIntField('Remote port', current.port, port => setOption({port})));
            rows.push(this.helper.makeString('Remote IP', current.ip, ip => setOption({ip})));
        }
        return rows;
    }

    private buildMixerOptions(current: PhysicalMixerType, set: (option: PhysicalMixerType) => any) {
        const possibleTypes: React.JSX.Element[] = [];
        for (const type of PHYSICAL_MIXER_TYPES) {
            possibleTypes.push(<Dropdown.Item key={possibleTypes.length} as={Button} onClick={() => set(type)}>
                {getMixerTypeName(type)}
            </Dropdown.Item>);
        }
        return <Form.Group as={Row} className={'tt-connect-form-row'} key={'mixer-select'}>
            <Form.Label style={({fontSize: 'large'})} column>Physical Mixer</Form.Label>
            <Col sm={8}>
                <TTDropdown title={getMixerTypeName(current)} darkMode={this.props.darkMode}>
                    {possibleTypes}
                </TTDropdown>
            </Col>
        </Form.Group>;
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
