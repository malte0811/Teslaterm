import {FullVMSData, MapReference, Program} from "../../common/VMS";

interface MapSelectorPropsBase<T> {
    data: T;
    currentSelection: MapReference;
    setSelection: (newSelection: MapReference) => void;
}

// TODO pull blocks out of this?
type MapSelectorProps = MapSelectorPropsBase<FullVMSData>;

function SubMapSelector(props: MapSelectorPropsBase<Program> & {ownId: number}) {
    const fullClassName = (type: string, selected: boolean) => {
        return `vms-mapsel-${type}-row vms-mapsel-row-${selected ? 'selected' : 'default'}`;
    };
    const current = props.currentSelection;
    const mapDivs = props.data.maps.map((map, i) => {
        return <div
            key={i}
            className={fullClassName('map', props.ownId === current?.programId && i === current?.mapId)}
            onClick={() => props.setSelection({programId: props.ownId, mapId: i})}
        >
            {map.startNote} - {map.endNote}
        </div>;
    });
    return <div>
        <div
            className={fullClassName('program', props.ownId === current?.programId)}
            onClick={() => props.setSelection({programId: props.ownId, mapId: 0})}
        >
            {props.data.name}
        </div>
        {...mapDivs}
    </div>;
}

export function MapSelector(props: MapSelectorProps) {
    return <>
        {props.data.map((p, i) => <SubMapSelector
            data={p}
            currentSelection={props.currentSelection}
            setSelection={props.setSelection}
            ownId={i}
        />)}
    </>;
}
