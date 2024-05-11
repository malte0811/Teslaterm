import {TransmittedFile} from "../../common/IPCConstantsToMain";
import {ChannelID} from "../../common/IPCConstantsToRenderer";
import {MediaFileType} from "../../common/MediaTypes";
import {ipcs} from "../ipc/IPCProvider";
import {media_state} from "../media/media_player";
import {player, startCurrentMidiFile, stopMidiFile} from "./midi";

// TODO for some reason MidiPlayer::getEvents() is a 2-dim array despite the signature?
function fixBrokenArray<T>(reallyTwoDimArray: T[]): T[] {
    const result: T[] = [];
    for (const subarray of reallyTwoDimArray) {
        result.push(...(subarray as unknown as T[]));
    }
    return result;
}

export async function loadMidiFile(file: TransmittedFile) {
    player.loadArrayBuffer(file.contents);
    const events = fixBrokenArray(player.getEvents());
    const uniqueChannels: number[] = [];
    const programByChannel = new Map<ChannelID, number>();
    const volumeByChannel = new Map<ChannelID, number>();
    const multiProgramChannels = new Set<ChannelID>();
    const nameByTrack = new Map<number, string>();
    const trackByChannel = new Map<ChannelID, number>();
    for (const event of events) {
        if (event.name === 'Sequence/Track Name') {
            nameByTrack.set(event.track, event.string);
        }
        if (event.channel !== undefined && !uniqueChannels.includes(event.channel)) {
            uniqueChannels.push(event.channel);
        }
        // TODO detect invalid data
        if (event.channel !== undefined && event.track !== undefined) {
            trackByChannel.set(event.channel, event.track);
        }
        if (event.name === 'Program Change' && !multiProgramChannels.has(event.channel)) {
            if (programByChannel.has(event.channel) && programByChannel.get(event.channel) !== event.value) {
                console.warn(`Channel ${event.channel} has multiple program change events!`);
                multiProgramChannels.add(event.channel);
                programByChannel.delete(event.channel);
            }
            programByChannel.set(event.channel, event.value);
        } else if (event.name === 'Controller Change' && event.number === 7) {
            volumeByChannel.set(event.channel, event.value * (100 / 127));
        }
    }
    const nameByChannel = new Map<ChannelID, string>();
    for (const [channel, track] of trackByChannel) {
        nameByChannel.set(channel, nameByTrack.get(track) || `Channel ${channel}`);
    }
    uniqueChannels.sort((a, b) => a - b);
    await media_state.loadFile(
        file,
        MediaFileType.midi,
        file.name.substring(0, file.name.length - 4),
        uniqueChannels,
        startCurrentMidiFile,
        stopMidiFile,
    );
    ipcs.mixer.setProgramsByVoice(programByChannel);
    ipcs.mixer.setChannelNames(nameByChannel);
    uniqueChannels.forEach((channel) => {
        if (volumeByChannel.has(channel)) {
            ipcs.mixer.setVolume({channel}, volumeByChannel.get(channel));
        }
    });
    ipcs.misc.updateMediaInfo();
}
