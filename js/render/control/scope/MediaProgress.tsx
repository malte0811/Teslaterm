import React from 'react';
import {MediaState} from '../../../common/IPCConstantsToRenderer';
import {MediaFileType, PlayerActivity} from '../../../common/MediaTypes';

export function MediaProgress(props: MediaState) {
    const text = (() => {
        if (props.type === MediaFileType.none) {
            return '';
        }
        const type = (() => {
            switch (props.type) {
                case MediaFileType.midi:
                    return 'MIDI';
                case MediaFileType.sid_dmp:
                    return 'SID-DMP';
                case MediaFileType.sid_emulated:
                    return 'SID';
            }
        })();
        const state = (() => {
            switch (props.state) {
                case PlayerActivity.playing:
                    if (props.type === MediaFileType.sid_emulated) {
                        return 'playing';
                    } else {
                        return 'playing ' + props.progressPercent + '% / 100%';
                    }
                case PlayerActivity.idle:
                    return 'idle';
            }
        })();
        return type + '-File: ' + props.title + ' State: ' + state;
    })();
    return <div className={'tt-media-progress'}>
        {text}
    </div>;
}
