import React from 'react';
import {MediaFileType, PlayerActivity} from '../../../common/CommonTypes';
import {MediaState} from '../../../common/IPCConstantsToRenderer';
import {TTComponent} from "../../TTComponent";

export class MediaProgress extends TTComponent<MediaState, {}> {
    render(): React.ReactNode {
        return <div className={'tt-media-progress'}>
            {this.getText()}
        </div>;
    }

    private getText() {
        if (this.props.type === MediaFileType.none) {
            return '';
        }
        const type = (() => {
            switch (this.props.type) {
                case MediaFileType.midi:
                    return 'MIDI';
                case MediaFileType.sid_dmp:
                    return 'SID-DMP';
                case MediaFileType.sid_emulated:
                    return 'SID';
            }
        })();
        const state = (() => {
            switch (this.props.state) {
                case PlayerActivity.playing:
                    if (this.props.type === MediaFileType.sid_emulated) {
                        return 'playing';
                    } else {
                        return 'playing ' + this.props.progress + '% / 100%';
                    }
                case PlayerActivity.idle:
                    return 'idle';
            }
        })();
        return type + '-File: ' + this.props.title + ' State: ' + state;
    }
}
