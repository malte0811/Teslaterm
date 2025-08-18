import {useState} from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {FullVMSData, MapReference, Program} from "../../common/VMS";

interface MapSelectorPropsBase<T> {
    data: T;
    currentSelection: MapReference;
    setSelection: (newSelection: MapReference) => void;
}

// TODO pull blocks out of this?
type MapSelectorProps = MapSelectorPropsBase<FullVMSData>;

function SubMapSelector(props: MapSelectorPropsBase<Program> & {ownId: number}) {
    const current = props.currentSelection;
    const [expanded, setExpanded] = useState(false);
    const mapDivs = expanded ? props.data.maps.map((map, i) => {
        return <Button
            key={i}
            variant={props.ownId === current?.programId && i === current?.mapId ? 'danger' : 'info'}
            onClick={() => props.setSelection({programId: props.ownId, mapId: i})}
        >
            {map.startNote} - {map.endNote}
        </Button>;
    }) : [];
    const onClick = () => {
        if (!expanded) {
            props.setSelection({programId: props.ownId, mapId: 0});
        }
        setExpanded(!expanded);
    };
    const variant = props.ownId === current?.programId ? 'danger' : 'info';
    return <ButtonGroup vertical style={{width: '100%', paddingBottom: '10px'}}>
        <Dropdown as={ButtonGroup}>
            <Button variant={variant} onClick={onClick}>{props.data.name}</Button>
            <Dropdown.Toggle split variant={variant} style={{flexGrow: 0}}/>
            <Dropdown.Menu>
                <Dropdown.Item>Action</Dropdown.Item>
                <Dropdown.Item>Another action</Dropdown.Item>
                <Dropdown.Item>Something else</Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
        {...mapDivs}
    </ButtonGroup>;
}

export function MapSelector(props: MapSelectorProps) {
    return <div style={{height: '100%', width: '100%', overflowY: 'auto'}}>
        {props.data.map((p, i) => <SubMapSelector
            data={p}
            currentSelection={props.currentSelection}
            setSelection={props.setSelection}
            ownId={i}
            key={i}
        />)}
    </div>;
}
