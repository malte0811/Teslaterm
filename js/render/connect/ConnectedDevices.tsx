import {Button, Modal, Table} from "react-bootstrap";
import {TTComponent} from "../TTComponent";

export interface DeviceInfo {
    columns: string[];
    select: () => any;
}

export interface ConnectedDevicesProps {
    columnTitles: string[];
    rows: DeviceInfo[];

    shown: boolean;

    close: () => any;
}

export class ConnectedDevices extends TTComponent<ConnectedDevicesProps, {}> {
    public render() {
        const makeRow = (port: DeviceInfo, i: number) => <tr key={`suggestion-${i}`}>
            {port.columns.map((col) => <td>{col}</td>)}
            <td><Button size={"sm"} onClick={() => {
                port.select();
                this.props.close();
            }}>Select</Button></td>
        </tr>;
        const table = <Table hover bordered>
            <thead><tr>
                {this.props.columnTitles.map((col) => <td>{col}</td>)}
                <th></th>
            </tr></thead>
            <tbody>{this.props.rows.map(makeRow)}</tbody>
        </Table>;
        return <Modal
            show={this.props.shown}
            onHide={this.props.close}
            size={"lg"}
        >
            <Modal.Header>Available devices</Modal.Header>
            <Modal.Body>{table}</Modal.Body>
            <Modal.Footer>
                <Button onClick={this.props.close}>Close</Button>
            </Modal.Footer>
        </Modal>;
    }
}
