import React from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {
    AFFECTED_VALUES,
    AffectedValue,
    Block, ConstantOrValue, KNOWN_VALUES,
    KnownValue,
    vmsValueToString,
} from "../../common/VMS";
import {TTDropdown} from "../TTDropdown";
import {ModulationSelector} from "./ModulationConfig";

export interface BlockConfigProps {
    block: Block;
    updateBlock: (update: Partial<Block>) => void;
    useAsStart: () => void;
    isStart: boolean;
}

export function ValueSelector<T>(
    props: {current: T, values: T[], toString: (t: T) => string, setValue: (t: T) => void},
) {
    const valueItems = props.values.map((value, i) => (
        <Dropdown.Item as={Button} onClick={() => props.setValue(value)} key={i}>
            {props.toString(value)}
        </Dropdown.Item>
    ));
    return <TTDropdown title={props.toString(props.current)}>
        {...valueItems}
    </TTDropdown>;
}

function FloatField({current, setValue}: {current: number, setValue: (newVal: number) => void}) {
    return <Form.Control
        type={'number'} value={current} onChange={ev => setValue(Number.parseFloat(ev.target.value))}
    />;
}

export function VMSColumnSubForm(props: {children: Array<string | React.JSX.Element>}) {
    const rightCol = 8;
    const rows: React.JSX.Element[] = [];
    for (let i = 0; i + 1 < props.children.length; i += 2) {
        const label = props.children[i];
        const value = props.children[i + 1];
        rows.push(<Form.Group as={Row} className={'tt-connect-form-row'}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={rightCol} style={{marginTop: 'auto'}}>{value}</Col>
        </Form.Group>);
    }
    return <div>
        {...rows}
    </div>;
}

// TODO may need to add support for limited value range!
export function ValueOrConstantSelector(
    {current, setValue}: {current: ConstantOrValue, setValue: (v: ConstantOrValue) => void},
) {
    const setter: React.JSX.Element = (() => {
        if (current.type === 'value') {
            return <VMSColumnSubForm>
                Base Value
                <ValueSelector
                    current={current.value}
                    values={KNOWN_VALUES}
                    toString={vmsValueToString}
                    setValue={(v) => setValue({...current, value: v})}
                />
                Mapped Min
                <FloatField current={current.rangeStart} setValue={(v) => setValue({...current, rangeStart: v})}/>
                Mapped Max
                <FloatField current={current.rangeEnd} setValue={(v) => setValue({...current, rangeEnd: v})}/>
            </VMSColumnSubForm>;
        } else {
            return <VMSColumnSubForm>
                Value
                <FloatField current={current.value} setValue={(value) => setValue({...current, value})}/>
            </VMSColumnSubForm>;
        }
    })();
    const switchType = () => {
        if (current.type === 'constant') {
            setValue({type: 'value', value: KnownValue.frequency, rangeStart: 0, rangeEnd: 1});
        } else {
            setValue({type: 'constant', value: 1});
        }
    };
    return <Form onSubmit={(e) => e.preventDefault()}>
        <Form.Check checked={current.type === 'value'} label={'Known Value'} onChange={switchType} type={"switch"}/>
        {setter}
    </Form>;
}

function ConfigSection(props: {name: string, children: React.JSX.Element}) {
    // TODO also line at bottom
    return <div style={{marginBottom: '10px'}}>
        <strong>{props.name}</strong>
        {props.children}
    </div>;
}

export function BlockConfig(props: BlockConfigProps) {
    return <div>
        <Button onClick={props.useAsStart} disabled={props.isStart}>Use as start</Button>
        <ConfigSection name={'Target Value'}>
            <ValueSelector<AffectedValue>
                current={props.block.target}
                values={AFFECTED_VALUES}
                toString={vmsValueToString}
                setValue={(newValue) => props.updateBlock({target: newValue})}
            />
        </ConfigSection>
        <ConfigSection name={'Target Factor'}>
            <ValueOrConstantSelector
                current={props.block.targetFactor}
                setValue={(p) => props.updateBlock({targetFactor: p})}
            />
        </ConfigSection>
        <ConfigSection name={'Modulation'}>
            <ModulationSelector
                modulation={props.block.modulation}
                set={(modulation) => props.updateBlock({modulation})}
            />
        </ConfigSection>
    </div>;
}
