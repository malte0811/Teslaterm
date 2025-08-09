import React from "react";
import {
    ExpModulation, InverseExpModulation,
    LinearModulation, Modulation,
    modulationToString,
    ModulationType, SineModulation, StepModulation,
} from "../../common/VMS";
import {ValueOrConstantSelector, ValueSelector, VMSColumnSubForm} from "./BlockConfig";
import {makeInitialModulation} from "./VMSOperations";

function LinearModulation({value, set}: {value: LinearModulation, set: (newVal: LinearModulation) => void}) {
    return <VMSColumnSubForm>
        Slope
        <ValueOrConstantSelector current={value.slope} setValue={(slope) => set({...value, slope})}/>
    </VMSColumnSubForm>;
}

type SomeExpModulation = ExpModulation | InverseExpModulation;
function ExpModulation({value, set}: {value: SomeExpModulation, set: (newVal: SomeExpModulation) => void}) {
    return <VMSColumnSubForm>
        Multiplier
        <ValueOrConstantSelector current={value.growthFactor} setValue={(f) => set({...value, growthFactor: f})}/>
    </VMSColumnSubForm>;
}

function SineModulation({value, set}: {value: SineModulation, set: (newVal: SineModulation) => void}) {
    return <VMSColumnSubForm>
        Amplitude
        <ValueOrConstantSelector current={value.scale} setValue={(scale) => set({...value, scale})}/>
        Offset
        <ValueOrConstantSelector current={value.offset} setValue={(offset) => set({...value, offset})}/>
        Phase Rate
        <ValueOrConstantSelector current={value.timeIncrement} setValue={(f) => set({...value, timeIncrement: f})}/>
    </VMSColumnSubForm>;
}

export function ModulationSelector({modulation, set}: {modulation: Modulation, set: (newMod: Modulation) => void}) {
    const values: ModulationType[] = ['step', 'exp', 'exp-reverse', 'linear', 'sine'];
    const typeSelector = <ValueSelector
        current={modulation.type}
        values={values}
        toString={modulationToString}
        setValue={(v) => set(makeInitialModulation(v, modulation))}
    />;
    const specificConfig = (() => {
        switch (modulation.type) {
            case "exp":
            case "exp-reverse":
                return <ExpModulation value={modulation} set={set}/>;
            case "linear":
                return <LinearModulation value={modulation} set={set}/>;
            case "sine":
                return <SineModulation value={modulation} set={set}/>;
        }
        modulation satisfies StepModulation;
        return <></>;
    })();
    return <div>
        {typeSelector}
        {specificConfig}
    </div>;
}

