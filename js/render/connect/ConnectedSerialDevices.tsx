import {Button, Modal, Table} from "react-bootstrap";
import {SerialConnectionOptions} from "../../common/SingleConnectionOptions";
import {AvailableSerialPort} from "../../common/IPCConstantsToRenderer";
import {TTComponent} from "../TTComponent";

export interface ConnectedDevicesProps {
    autoPorts: AvailableSerialPort[];
    shown: boolean;
    darkMode: boolean;

    setOption: (newOptions: Partial<SerialConnectionOptions>) => any;
    close: () => any;
}

export class ConnectedSerialDevices extends TTComponent<ConnectedDevicesProps, {}> {
    public render() {
        const makeRow = (port: AvailableSerialPort) => <tr key={port.path}>
            <td>{port.path}</td>
            <td>{port.manufacturer}</td>
            <td>{port.vendorID}</td>
            <td>{port.productID}</td>
            <td><Button size={"sm"} onClick={() => {
                this.props.setOption({
                    autoProductID: port.productID,
                    autoVendorID: port.vendorID,
                    serialPort: port.path,
                });
                this.props.close();
            }}>Select</Button></td>
        </tr>;
        const table = <Table hover bordered>
            <thead><tr>
                <th>Port</th><th>Manufacturer</th><th>Vendor ID</th><th>Product ID</th><th></th>
            </tr></thead>
            <tbody>{this.props.autoPorts.map(makeRow)}</tbody>
        </Table>;
        return <Modal
            show={this.props.shown}
            onHide={this.props.close}
            size={"lg"}
            className={this.props.darkMode && 'tt-dark-modal-root'}
        >
            <Modal.Header>Available devices</Modal.Header>
            <Modal.Body>{table}</Modal.Body>
            <Modal.Footer>
                <Button onClick={this.props.close}>Close</Button>
            </Modal.Footer>
        </Modal>;
    }
}
