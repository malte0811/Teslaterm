import React from "react";
import {Button, Col, Form, FormCheck, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {
    AFFECTED_VALUES,
    AffectedValue,
    Block, ConstantOrValue,
    KnownValue,
    Modulation, modulationToString,
    ModulationType,
    vmsValueToString,
} from "../../common/VMS";
import {TTDropdown} from "../TTDropdown";

export interface BlockConfigProps {
    block: Block;
    updateBlock: (update: Partial<Block>) => void;
}

function ValueSelector<T>(props: {current: T, values: T[], toString: (t: T) => string, setValue: (t: T) => void}) {
    const valueItems = props.values.map((value, i) => (
        <Dropdown.Item as={Button} onClick={() => props.setValue(value)} key={i}>
            {props.toString(value)}
        </Dropdown.Item>
    ));
    return <TTDropdown title={props.toString(props.current)}>
        {...valueItems}
    </TTDropdown>;
}

// TODO may need to add support for limited value range!
function ValueOrConstantSelector(props: {current: ConstantOrValue, setValue: (v: ConstantOrValue) => void}) {
    const setter = (() => {
        if (props.current.type === 'value') {
            return <ValueSelector
                current={props.current.value}
                values={AFFECTED_VALUES}
                toString={vmsValueToString}
                setValue={(v) => props.setValue({...props.current, value: v})}
            />;
            // TODO start/end range!
        } else {
            return <Form.Control
                type={'number'}
                value={props.current.value}
                onChange={ev => props.setValue({...props.current, value: Number.parseFloat(ev.target.value)})}
            />;
        }
    })();
    const switchType = () => {
        if (props.current.type === 'constant') {
            props.setValue({type: 'value', value: KnownValue.frequency, rangeStart: 0, rangeEnd: 1});
        } else {
            props.setValue({type: 'constant', value: 1});
        }
    };
    return <div>
        <Form.Check checked={props.current.type === 'value'} label={'Known Value'} onChange={switchType}/>
        {setter}
    </div>;
}

function makeInitial(type: ModulationType): Modulation {
    const constant = (v: number): ConstantOrValue => ({type: 'constant', value: v});
    // TODO double check all of these
    switch (type) {
        case "step":
            return {type};
        case "exp":
            return {type, growthFactor: constant(1.1)};
        case "exp-reverse":
            return {type, growthFactor: constant(1.1)};
        case "linear":
            return {type, slope: constant(1)};
        case "sine":
            return {type, scale: constant(1), offset: constant(0), timeIncrement: constant(1)};
    }
}

function ModulationSelector(props: {block: Block, updateBlock: (p: Partial<Block>) => void}) {
    const values: ModulationType[] = ['step', 'exp', 'exp-reverse', 'linear', 'sine'];
    return <ValueSelector
        current={props.block.modulation.type}
        values={values}
        toString={modulationToString}
        setValue={(v) => props.updateBlock({modulation: makeInitial(v)})}
    />;
}

export function BlockConfig({block, updateBlock}: BlockConfigProps) {
    // TODO separate into sections:
    // - General: thresholdDirection, target, periodMS
    // - TargetFactor
    // - Modulation: Type and values needed for it
    const rows: Array<[string, React.JSX.Element]> = [
        [
            'Target Value',
            <ValueSelector<AffectedValue>
                current={block.target}
                values={AFFECTED_VALUES}
                toString={vmsValueToString}
                setValue={(newValue) => updateBlock({target: newValue})}
            />,
        ],
        [
            'Target Factor',
            <ValueOrConstantSelector current={block.targetFactor} setValue={(p) => updateBlock({targetFactor: p})}/>,
        ],
        ['Modulation', <ModulationSelector block={block} updateBlock={updateBlock}/>],
    ];
    const rightCol = 8;
    return <Form onSubmit={(e) => e.preventDefault()}>
        {...rows.map(([label, element]) => <Form.Group as={Row} className={'tt-connect-form-row'}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={rightCol} style={{marginTop: 'auto'}}>{element}</Col>
        </Form.Group>)}
    </Form>;
}
