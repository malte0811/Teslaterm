import * as MidiPlayer from "midi-player-js";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {forEachCoilAsync, getMixer} from "../connection/connection";
import {sendProgramChange, sendVolume, VOLUME_CC_KEY} from "./midi";

async function maybeRedirectProgramChange(channel: ChannelID): Promise<boolean> {
    const programOverride = getMixer()?.getProgramFor(channel);
    if (programOverride !== undefined) {
        await sendProgramChange(channel, programOverride);
        return true;
    } else {
        return false;
    }
}

// TODO always send volume at start of song?
async function redirectVolumeChange(channel: ChannelID): Promise<boolean> {
    const mixer = getMixer();
    if (mixer) {
        await forEachCoilAsync(async (coil) => {
            const volume = mixer.getVolumeMultiplier(coil, channel);
            await sendVolume(coil, channel, volume * 100);
        });
        return true;
    } else {
        return false;
    }
}

export async function maybeRedirectEvent(event: MidiPlayer.Event): Promise<boolean> {
    if (event.name === 'Program Change') {
        return maybeRedirectProgramChange(event.channel);
    } else if (event.name === 'Controller Change' && event.number === VOLUME_CC_KEY) {
        return redirectVolumeChange(event.channel);
    } else {
        return false;
    }
}
