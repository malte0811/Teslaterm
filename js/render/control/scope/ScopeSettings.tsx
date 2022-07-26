import React, {CSSProperties} from "react";
import {TTComponent} from "../../TTComponent";
import {TraceConfig} from './Trace'

class TraceSettings extends TTComponent<TraceConfig, {}> {
    render(): React.ReactNode {
        const style: CSSProperties = {
            color: this.props.wavecolor,
        };
        return <div style={style}>
            {this.props.name}<br/>
            {this.props.perDiv.toFixed(2)} {this.props.unit} / div
        </div>;
    }
}

export interface ScopeSettingsProps {
    configs: TraceConfig[];
}

export class ScopeSettings extends TTComponent<ScopeSettingsProps, {}> {
    render(): React.ReactNode {
        return <div className={'tt-scope-settings'}>
            {this.props.configs.map((cfg, i) => <TraceSettings {...cfg} key={i}/>)}
        </div>;
    }
}
