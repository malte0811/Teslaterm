import React from "react";
import {Button, Col, Form, Row} from "react-bootstrap";
import {TTComponent} from "../TTComponent";

export interface FormPropsBase {
    connecting: boolean;
    darkMode: boolean;
}

export class FormHelper {
    private readonly component: TTComponent<FormPropsBase, any>;
    private readonly rightColumnWidth: number;

    constructor(component: TTComponent<FormPropsBase, any>, rightColumnWidth: number) {
        this.component = component;
        this.rightColumnWidth = rightColumnWidth;
    }

    public makeCheckbox(
        label: string,
        enabled: boolean,
        set: (val: boolean) => any,
        ref?: React.RefObject<HTMLInputElement>,
        keyPrefix?: string,
    ) {
        return (
            <Form.Check
                type={'checkbox'}
                id={(keyPrefix || '') + label}
                label={label}
                checked={enabled}
                onChange={ev => set(ev.target.checked)}
                disabled={this.component.props.connecting}
                className={'tt-connect-form-row'}
                key={(keyPrefix || '') + label}
                ref={ref}
            />
        );
    }

    public makeString(
        label: string, current: string, set: (val: string) => any, type: string = 'text',
    ) {
        return (
            <Form.Group as={Row} className={'tt-connect-form-row'} key={label}>
                <Form.Label column>{label}</Form.Label>
                <Col sm={this.rightColumnWidth}>
                    <Form.Control
                        type={type}
                        value={current}
                        onChange={ev => set(ev.target.value)}
                        disabled={this.component.props.connecting}
                        className={this.component.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                    />
                </Col>
            </Form.Group>
        );
    }

    public makeButton(label: string, onClick: () => any) {
        return (
            <Form.Group as={Row} className={'tt-connect-form-row'} key={label}>
                <Col/>
                <Col sm={this.rightColumnWidth}>
                    <Button
                        disabled={this.component.props.connecting}
                        onClick={onClick}
                        size={'sm'}>{label}</Button>
                </Col>
            </Form.Group>
        );
    }

    public makeIntField(label: string, current: number, set: (val: number) => any): JSX.Element {
        return this.makeString(label, current.toString(), val => set(Number.parseInt(val, 10)), 'number');
    }

    public makeSuggestedField(
        label: string,
        current: string,
        set: (newVal: string) => any,
        suggestions: string[],
        ref?: React.RefObject<HTMLInputElement>,
    ): JSX.Element {
        return <Form.Group as={Row} className={'tt-connect-form-row'} key={label}>
            <Form.Label column>{label}</Form.Label>
            <Col sm={this.rightColumnWidth}>
                <Form.Control
                    type={'text'}
                    value={current}
                    onChange={(ev) => set(ev.target.value)}
                    list={'suggestions'}
                    ref={ref}
                    disabled={this.component.props.connecting}
                    className={this.component.props.darkMode ? 'tt-dark-form-input' : 'tt-light-form-input'}
                />
                <datalist id={'suggestions'}>
                    {suggestions.map((s, i) => <option value={s} key={i}/>)}
                </datalist>
            </Col>
        </Form.Group>;
    }

}
