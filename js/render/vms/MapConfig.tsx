import React from "react";
import {Button, Form, Modal} from "react-bootstrap";
import ReactRangeSliderInput from "react-range-slider-input";
import {MapFrequency, MapOptions} from "../../common/VMS";
import {KeyOfType} from "../../main/helper";
import {SimpleSlider} from "../control/sliders/SimpleSlider";

export interface MapConfigProps {
    options: MapOptions;
    setOptions: (newOptions: Partial<MapOptions>) => void;
    close: (save: boolean) => void;
    visible: boolean;
}

function MapFrequencySelector(props: {freq: MapFrequency, setFreq: (freq: MapFrequency) => void}) {
    const extraSelector = (() => {
        if (props.freq.type === 'offset') {
            return <div>
                Offset (MIDI notes):
                <Form.Control
                    type={'number'}
                    value={props.freq.midiNotes}
                    onChange={(ev) => props.setFreq({type: 'offset', midiNotes: Number.parseInt(ev.target.value, 10)})}
                />
            </div>;
        } else {
            return <div>
                Frequency (Hz):
                <Form.Control
                    type={'number'}
                    value={props.freq.frequencyHz}
                    onChange={(ev) => props.setFreq({type: 'fixed', frequencyHz: Number.parseInt(ev.target.value, 10)})}
                />
            </div>;
        }
    })();

    return <div style={{marginBottom: '30px'}}>
        <Form.Check
            checked={props.freq.type === 'fixed'}
            onChange={(ev) => {
                props.setFreq(ev.target.checked ? {type: 'fixed', frequencyHz: 440} : {type: 'offset', midiNotes: 0});
            }}
            label={'Fixed Frequency'}
            type={'switch'}
        />
        {extraSelector}
    </div>;
}

export function MapConfig(props: MapConfigProps) {
    const updateNoteRange = ([min, max]: number[]) => {
        props.setOptions({startNote: min, endNote: max});
    };
    const makeSwitchFor = (key: KeyOfType<MapOptions, boolean>, title: string) => {
        return <Form.Check
            checked={options[key]}
            onChange={(ev) => {
                const update: Partial<MapOptions> = {};
                update[key] = ev.target.checked;
                props.setOptions(update);
            }}
            label={title}
            type={'switch'}
        />;
    };
    const options = props.options;
    // TODO This is not working in UD3 as I understand it, so no switch for now
    // enablePortamento: boolean;
    // TODO CSS for ReactRangeSliderInput matching other siders
    return <Modal show={props.visible} size={'lg'} onHide={() => props.close(false)}>
        <Modal.Body>
            Note range: {options.startNote} - {options.endNote}
            <div style={{marginTop: '10px', marginBottom: '30px'}}>
                <ReactRangeSliderInput
                    min={0}
                    max={127}
                    value={[options.startNote, options.endNote]}
                    onInput={updateNoteRange}
                />
            </div>
            <MapFrequencySelector freq={options.noteFrequency} setFreq={(f) => props.setOptions({noteFrequency: f})}/>
            <SimpleSlider
                title={'Volume scaling'}
                unit={'%'}
                min={0}
                max={100}
                value={Math.round(100 * options.volumeScale)}
                setValue={(v) => props.setOptions({volumeScale: v / 100})}
                visuallyEnabled={true}
                disabled={false}
            />
            {makeSwitchFor('enablePitchbend', 'Enable Pitchbend')}
            <div style={{marginTop: '30px'}}>Volume modifiers:</div>
            {makeSwitchFor('enableStereo', 'Scale with stereo volume')}
            {makeSwitchFor('enableVolume', 'Scale with main volume')}
            {makeSwitchFor('enableDamper', 'Scale with damper volume')}
        </Modal.Body>
        <Modal.Footer>
            <Button onClick={() => props.close(true)}>Close and Save</Button>
            <Button onClick={() => props.close(false)}>Close and Discard</Button>
        </Modal.Footer>
    </Modal>;
}
