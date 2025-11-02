import {useContext, useState} from "react";
import {Button, Form, Modal} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN, SimpleQCWPulse, SimpleQCWPulseKey} from "../../../common/IPCConstantsToMain";
import {UIConfigContext} from "../../Contexts";
import {processIPC} from "../../ipc/IPCProvider";
import {SimpleSlider} from "../sliders/SimpleSlider";

export const QCW_STEPS_PER_MS = 8;
export const QCW_STEPS = 400;

interface ExtraOptions {
    step?: number;
    displayScale?: number;
}

interface QCWSliderSpec {
    title: string;
    unit: string;
    min: number;
    max: number;
    key: SimpleQCWPulseKey;
    extra: ExtraOptions;
}

const QCW_SLIDERS: QCWSliderSpec[] = (() => {
    const makeSpec = (
        title: string, unit: string, min: number, max: number, key: SimpleQCWPulseKey, extra: ExtraOptions = {},
    ): QCWSliderSpec => ({extra, key, max, min, title, unit});
    // TODO check all min/max's. Dynamic update for PW?
    // TODO check unit for frequency
    return [
        makeSpec('Pulse Width', 'ms', 0, 15, 'pulseWidth', {step: 0.05}),
        makeSpec('Slope', 'cnt/ms', 0, 5, 'slope', {step: 0.1, displayScale: QCW_STEPS_PER_MS}),
        makeSpec('Offset', 'cnt', 0, 255, 'initialValue'),
        makeSpec('Holdoff', 'ms', 0, 400, 'initialTime', {displayScale: 1 / QCW_STEPS_PER_MS}),
        makeSpec('Maximum', 'cnt', 0, 255, 'maxValue'),
        makeSpec('Modulation volume', 'cnt', 0, 255, 'modulationAmplitude'),
        makeSpec('Modulation frequency', 'Hz', 10, 2000, 'modulationFreq'),
    ];
})();

function QCWSlider({spec, current, setValue}: {
    spec: QCWSliderSpec,
    current: SimpleQCWPulse,
    setValue: (key: SimpleQCWPulseKey, v: number) => void,
}) {
    return <SimpleSlider
        title={spec.title}
        unit={spec.unit}
        min={spec.min}
        max={spec.max}
        value={current[spec.key]}
        setValue={(v) => setValue(spec.key, v)}
        visuallyEnabled={true}
        step={spec.extra.step}
        displayMultiplier={spec.extra.displayScale}
    />;
}

function CommonChoiceSlider(props: {
    slider: QCWSliderSpec,
    currentPulse: SimpleQCWPulse,
    setProperty: (key: SimpleQCWPulseKey, value: number) => void,
    currentlyCommon: boolean,
    setCommon: (key: SimpleQCWPulseKey, isCommon: boolean) => any,
}) {
    return <div style={{display: 'flex'}}>
        <div style={{width: '80%'}}>
            <QCWSlider spec={props.slider} current={props.currentPulse} setValue={props.setProperty}/>
        </div>
        <Form.Check
            label={'Common'}
            type={'switch'}
            checked={props.currentlyCommon}
            onChange={(ev) => props.setCommon(props.slider.key, ev.target.checked)}
            style={{marginLeft: 'auto'}}
        />
    </div>;
}

function FullSimpleQCWOverlay(props: {
    currentPulse: SimpleQCWPulse,
    setProperty: (key: SimpleQCWPulseKey, value: number) => void,
    isCommonSlider: { [slider: string]: boolean },
    setCommon: (name: SimpleQCWPulseKey, isCommon: boolean) => any,
}) {
    const sliders: React.JSX.Element[] = QCW_SLIDERS.map((slider, i) => {
        return <CommonChoiceSlider
            slider={slider}
            currentPulse={props.currentPulse}
            setProperty={props.setProperty}
            currentlyCommon={props.isCommonSlider[slider.key]}
            setCommon={props.setCommon}
            key={i}/>;
    });
    const [shown, setShown] = useState(false);
    return <>
        <Button onClick={() => setShown(true)}>Show all options</Button>
        <Modal show={shown}>
            <Modal.Body>
                {...sliders}
            </Modal.Body>
            <Modal.Footer>
                <Button onClick={() => setShown(false) }>Close</Button>
            </Modal.Footer>
        </Modal>
    </>;
}

export interface SimplePulseProps {
    currentPulse: SimpleQCWPulse;
    setProperty: (key: SimpleQCWPulseKey, value: number) => void;
}

export function SimpleQCWPulseConfig(props: SimplePulseProps) {
    const uiConfig = useContext(UIConfigContext);
    const commonOptions = uiConfig.qcwOptions.simpleRamp.commonOptions;
    const sliders = QCW_SLIDERS.filter((spec) => commonOptions[spec.key])
        .map((spec, i) => {
            return <QCWSlider spec={spec} current={props.currentPulse} setValue={props.setProperty} key={i}/>;
        });
    const setOptionCommon = (name: SimpleQCWPulseKey, isCommon: boolean) => {
        const newQCWOptions = {...uiConfig.qcwOptions};
        newQCWOptions.simpleRamp = {commonOptions: {...newQCWOptions.simpleRamp.commonOptions}};
        newQCWOptions.simpleRamp.commonOptions[name] = isCommon;
        processIPC.send(IPC_CONSTANTS_TO_MAIN.setUIConfig, {qcwOptions: newQCWOptions});
    };
    return <div>
        <div>{...sliders}</div>
        <FullSimpleQCWOverlay
            currentPulse={props.currentPulse}
            setProperty={props.setProperty}
            isCommonSlider={commonOptions}
            setCommon={setOptionCommon}
        />
    </div>;
}
