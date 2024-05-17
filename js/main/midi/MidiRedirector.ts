import * as MidiPlayer from "midi-player-js";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {forEachCoilAsync} from "../connection/connection";
import {ipcs} from "../ipc/IPCProvider";
import {sendProgramChange, sendVolume, VOLUME_CC_KEY} from "./midi";

async function maybeRedirectProgramChange(channel: ChannelID): Promise<boolean> {
    const programOverride = ipcs.mixer.getProgramFor(channel);
    if (programOverride !== undefined) {
        await sendProgramChange(channel, programOverride);
        return true;
    } else {
        return false;
    }
}

// TODO always send volume at start of song?
async function redirectVolumeChange(channel: ChannelID): Promise<void> {
    await forEachCoilAsync(async (coil) => {
        const volume = ipcs.mixer.getVolume(coil, channel);
        await sendVolume(coil, channel, volume);
    });
}

export async function maybeRedirectEvent(event: MidiPlayer.Event): Promise<boolean> {
    if (event.name === 'Program Change') {
        return maybeRedirectProgramChange(event.channel);
    } else if (event.name === 'Controller Change' && event.number === VOLUME_CC_KEY) {
        await redirectVolumeChange(event.channel);
        return true;
    } else {
        return false;
    }
}
