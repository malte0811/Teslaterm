import React, {useState} from "react";
import {Button, Form} from "react-bootstrap";
import {CoilID} from "../../../common/constants";
import {getToMainIPCPerCoil, makeDefaultSimplePulse, SimpleQCWPulse} from "../../../common/IPCConstantsToMain";
import {processIPC} from "../../ipc/IPCProvider";
import {SimpleSlider} from "../sliders/SimpleSlider";
import {SimpleQCWPulseConfig} from "./SimpleQCWPulse";

export interface QCWControlsProps {
    coil: CoilID;
}

// TODO disable if connection lost (recursively)
export function QCWControls(props: QCWControlsProps) {
    const [simpleRamp, setSimpleRamp] = useState(true);
    const [isSingleShot, setSingleShot] = useState(false);
    const [repeatPeriod, setRepeatPeriod] = useState(500);
    const [simplePulse, setSimplePulse] = useState(makeDefaultSimplePulse());
    const [periodicRunning, setPeriodicRunning] = useState(false);
    const getIPCs = () => {
        return getToMainIPCPerCoil(props.coil).qcw;
    };

    const onMainButton = () => {
        if (isSingleShot) {
            processIPC.send(getIPCs().singleShot, undefined);
        } else {
            if (periodicRunning) {
                processIPC.send(getIPCs().stop, undefined);
            } else {
                processIPC.send(getIPCs().start, {repeat: repeatPeriod});
            }
            setPeriodicRunning(!periodicRunning);
        }
    };

    let rampControls: React.JSX.Element;
    if (simpleRamp) {
        rampControls = <SimpleQCWPulseConfig
            currentPulse={simplePulse}
            setProperty={(name, newValue) => {
                const newPulse: SimpleQCWPulse = {...simplePulse};
                newPulse[name] = newValue;
                setSimplePulse(newPulse);
                processIPC.send(getIPCs().setSimplePulseProp, {key: name, value: newValue});
            }}
        />;
    } else {
        rampControls = <div>TODO implement complex ramp</div>;
    }

    return (
        <div style={{overflowY: 'auto'}}>
            <strong>Pulse setup:</strong>
            <Form.Check
                type={'switch'}
                label={'Simple ramp'}
                checked={simpleRamp}
                onChange={(ev) => setSimpleRamp(ev.target.checked)}
            />
            {rampControls}
            <strong>Pulse sequence:</strong>
            <Form.Check
                type={'switch'}
                label={'Single Shot'}
                checked={isSingleShot}
                onChange={(ev) => setSingleShot(ev.target.checked)}
            />
            <SimpleSlider
                title={'Repeat period'}
                unit={'ms'}
                value={repeatPeriod}
                min={100}
                max={1000}
                setValue={(v) => {
                    setRepeatPeriod(v);
                    processIPC.send(getIPCs().setRepeat, v);
                }}
                visuallyEnabled={!isSingleShot}
            />
            <Button
                onClick={() => onMainButton()}
            >{isSingleShot ? 'Single shot' : periodicRunning ? 'Stop' : 'Start'}</Button>
        </div>
    );
}
