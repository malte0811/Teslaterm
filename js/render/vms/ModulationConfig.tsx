import React from "react";
import {useCaseSensitiveFileNames} from "ts-loader/dist/utils";
import {
    ExpModulation,
    InverseExpModulation,
    LinearModulation,
    Modulation,
    modulationToString,
    ModulationType,
    SineModulation,
    StepModulation,
} from "../../common/VMS";
import {makeInitialModulation} from "../../common/VMSOperations";
import {getEnumValues} from "../../main/helper";
import {ValueOrConstantSelector, ValueSelector, VMSColumnSubForm} from "./BlockConfig";

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
    const values = getEnumValues(ModulationType);
    const typeSelector = <ValueSelector
        current={modulation.type}
        values={values}
        toString={modulationToString}
        setValue={(v) => set(makeInitialModulation(v, modulation))}
    />;
    const specificConfig = (() => {
        switch (modulation.type) {
            case ModulationType.exp:
            case ModulationType.exp_inverse:
                return <ExpModulation value={modulation} set={set}/>;
            case ModulationType.linear:
                return <LinearModulation value={modulation} set={set}/>;
            case ModulationType.sine:
                return <SineModulation value={modulation} set={set}/>;
            case ModulationType.step:
                return <></>;
        }
    })();
    return <div>
        {typeSelector}
        {specificConfig}
    </div>;
}

