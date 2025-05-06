import React from "react";
import {Button} from "react-bootstrap";
import {IPC_CONSTANTS_TO_MAIN} from "../../../../common/IPCConstantsToMain";
import {SongListData} from "../../../../common/IPCConstantsToRenderer";
import {processIPC} from "../../../ipc/IPCProvider";
import {TTComponent} from "../../../TTComponent";

export class Playlist extends TTComponent<SongListData, {}> {
    public render() {
        const songs = this.props.songs.map((song, i) => this.makeSongRow(song, i));
        return <div style={{overflowY: 'auto'}}>
            {...songs}
        </div>;
    }

    private makeSongRow(name: string, index: number) {
        const selected = index === this.props.current;
        const selectButton = <Button
            size={'sm'}
            onClick={() => processIPC.send(IPC_CONSTANTS_TO_MAIN.centralTab.setPlaylistIndex, index)}
            disabled={selected}
            style={{marginLeft: '5px'}}
        >Load</Button>;
        return <div style={{
            display: 'flex',
            flexDirection: 'row',
            marginBottom: '5px',
            width: '100%',
        }}>
            <span style={{color: selected && 'red', flexGrow: 1}}>{name}</span>
            {selectButton}
        </div>;
    }
}
