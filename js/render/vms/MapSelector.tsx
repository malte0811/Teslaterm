import {useState} from "react";
import {Button, ButtonGroup} from "react-bootstrap";
import Dropdown from "react-bootstrap/Dropdown";
import {BlockId, BlockMap, FullVMSData, MapReference, Program} from "../../common/VMS";
import {makeDefaultMap, makeDefaultProgram} from "../../common/VMSOperations";

interface MapSelectorPropsBase<T> {
    data: T;
    currentSelection: MapReference;
    setSelection: (newSelection: MapReference) => void;
    newBlockId: BlockId;
    setData: (newData: T) => void;
}

// TODO pull blocks out of this?
export type MapSelectorProps = MapSelectorPropsBase<FullVMSData>;

interface SubMapSelectorProps extends MapSelectorPropsBase<Program> {
    ownId: number;
    deleteProgram: () => void;
    expanded: boolean;
    expand: () => void;
}

interface MapButtonProps extends MapSelectorPropsBase<BlockMap> {
    ownProgram: number;
    ownMap: number;
    deleteMap: () => void;
}

function MapSelectorButton(props: MapButtonProps) {
    const map = props.data;
    const selectedMap = props.currentSelection;
    const selected = selectedMap?.programId === props.ownProgram && selectedMap?.mapId === props.ownMap;
    const variant = selected ? 'success' : 'info';
    return <Dropdown as={ButtonGroup}>
        <Button
            variant={variant}
            onClick={() => props.setSelection({programId: props.ownProgram, mapId: props.ownMap})}
        >
            {map.startNote} - {map.endNote}
        </Button>
        <Dropdown.Toggle split variant={variant} style={{flexGrow: 0}}/>
        <Dropdown.Menu>
            <Dropdown.Item>Configure map</Dropdown.Item>
            <Dropdown.Item style={{background: 'red'}} onClick={props.deleteMap}>Delete map</Dropdown.Item>
        </Dropdown.Menu>
    </Dropdown>;
}

function SubMapSelector(props: SubMapSelectorProps) {
    const current = props.currentSelection;
    const setMaps = (newMaps: BlockMap[]) => props.setData({...props.data, maps: newMaps});
    const mapDivs = props.expanded ? props.data.maps.map((map, i) => {
        return <MapSelectorButton
            key={i}
            ownProgram={props.ownId}
            ownMap={i}
            deleteMap={() => {
                const newMaps = [...props.data.maps];
                newMaps.splice(i, 1);
                setMaps(newMaps);
            }}
            data={map}
            currentSelection={props.currentSelection}
            setSelection={props.setSelection}
            newBlockId={props.newBlockId}
            setData={(newMap) => {
                const newMaps = [...props.data.maps];
                newMaps[i] = newMap;
                setMaps(newMaps);
            }}
        />;
    }) : [];
    const onClick = () => {
        if (!props.expanded) {
            props.expand();
            props.setSelection({programId: props.ownId, mapId: 0});
        }
    };
    const onAddMap = () => setMaps([...props.data.maps, makeDefaultMap(props.newBlockId)]);
    const variant = props.ownId === current?.programId ? 'success' : 'info';
    return <ButtonGroup vertical style={{width: '100%', paddingBottom: '10px'}}>
        <Dropdown as={ButtonGroup}>
            <Button variant={variant} onClick={onClick}>{props.data.name}</Button>
            <Dropdown.Toggle split variant={variant} style={{flexGrow: 0}}/>
            <Dropdown.Menu>
                <Dropdown.Item onClick={onAddMap}>Add map</Dropdown.Item>
                <Dropdown.Item onClick={props.deleteProgram} style={{background: 'red'}}>Delete program</Dropdown.Item>
                <Dropdown.Item>Rename</Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
        {...mapDivs}
    </ButtonGroup>;
}

// TODO
// - Program context
//   - Renaming programs
// - Map context
//   - Maps need a general settings popup!
export function MapSelector(props: MapSelectorProps) {
    const setProgram = (index: number, newProgram: Program) => {
        const newPrograms = [...props.data];
        newPrograms[index] = newProgram;
        props.setData(newPrograms);
    };
    const [expanded, setExpanded] = useState(-1);
    const deleteProgram = (toDelete: number) => {
        if (expanded === toDelete) {
            setExpanded(-1);
        }
        if (props.currentSelection?.programId === toDelete) {
            props.setSelection(undefined);
        }
        props.setData(props.data.filter((p, i) => i !== toDelete));
    };
    const addProgram = () => props.setData([...props.data, makeDefaultProgram(props.newBlockId)]);
    return <div style={{height: '100%', width: '100%', overflowY: 'auto'}}>
        {props.data.map((p, i) => <SubMapSelector
            data={p}
            currentSelection={props.currentSelection}
            setSelection={props.setSelection}
            ownId={i}
            key={i}
            newBlockId={props.newBlockId}
            deleteProgram={() => deleteProgram(i)}
            setData={(data) => setProgram(i, data)}
            expanded={expanded === i}
            expand={() => setExpanded(i)}
        />)}
        <Button style={{width: '100%'}} onClick={addProgram}>
            Add program
        </Button>
    </div>;
}
