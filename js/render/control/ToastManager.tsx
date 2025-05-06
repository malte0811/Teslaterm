import {CoilID} from "../../common/constants";
import {ToastData, ToastSeverity} from "../../common/IPCConstantsToRenderer";

export interface ShownToastData extends ToastData {
    hideTimeout?: NodeJS.Timeout;
    occurrences: number;
    uniqueIndex: number;
    coil?: CoilID;
}

export interface ToastManager {
    allToasts: ShownToastData[];
    nextIndex: number;
}

export type ToastUpdater = (replacer: (old: ToastManager) => ToastManager) => any;

export function addToast(updater: ToastUpdater, newToastData: ToastData, coil?: CoilID) {
    updater((oldManager) => {
        const newToasts: ShownToastData[] = [...oldManager.allToasts];
        let occurrences = 1;
        if (newToastData.mergeKey !== undefined) {
            for (let i = 0; i < newToasts.length; ++i) {
                const oldToast = newToasts[i];
                if (newToastData.mergeKey === oldToast.mergeKey && coil === oldToast.coil) {
                    occurrences += oldToast.occurrences;
                    if (oldToast.hideTimeout !== undefined) {
                        clearTimeout(oldToast.hideTimeout);
                    }
                    newToasts.splice(i, 1);
                    break;
                }
            }
        }
        const newToast: ShownToastData = {...newToastData, occurrences, coil, uniqueIndex: oldManager.nextIndex};
        if (newToast.level === ToastSeverity.info) {
            // Manual implementation of autohide, since the default one seems to have issues with dynamic
            // indices
            newToast.hideTimeout = setTimeout(() => removeToast(updater, newToast), 3000);
        }
        newToasts.push(newToast);
        return {allToasts: newToasts, nextIndex: oldManager.nextIndex + 1};
    });
}

function removeToast(updater: ToastUpdater, removeToast: ShownToastData) {
    updater((oldManager) => ({
        allToasts: oldManager.allToasts.filter((toast) => toast.uniqueIndex !== removeToast.uniqueIndex),
        nextIndex: oldManager.nextIndex,
    }));
}

export function getToasts(manager: ToastManager, getTitle: (coil: CoilID) => string, coil?: CoilID): ShownToastData[] {
    if (coil === undefined) {
        return manager.allToasts.map((toast) => {
            const coilTitle = toast.coil !== undefined ? getTitle(toast.coil) : undefined;
            return {
                ...toast,
                title: coilTitle ? coilTitle + ': ' + toast.title : toast.title,
            };
        });
    } else {
        return manager.allToasts.filter((toast) => !toast.coil || toast.coil === coil);
    }
}

export function makeToastRemover(updater: ToastUpdater): (toast: ShownToastData) => any {
    return (toast) => removeToast(updater, toast);
}
