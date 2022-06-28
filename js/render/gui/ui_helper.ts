export function addFirstMenuEntry(menu: string, id: string, text: string, icon: string): void {
    const mnu = w2ui.toolbar.get(menu, false) as W2UI.W2Menu;
    mnu.items = [{text, icon, id}].concat(mnu.items);
}

export function removeMenuEntry(menu: string, id: string): void {
    const mnu = w2ui.toolbar.get(menu, false) as W2UI.W2Menu;
    const items = mnu.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) {
            mnu.items.splice(i, 1);
            return;
        }
    }
    console.log("Didn't find name to remove!");
}

export function warn(message: string, onConfirmed: () => void) {
    w2confirm(message)
        .no(() => {
        })
        .yes(onConfirmed);
}

export function confirmPromise(message: string, title: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        w2confirm(message, title)
            .yes(() => resolve(true))
            .no(() => resolve(false));
    });
}

export function changeMenuEntry(menu: string, id: string, newName: string): void {
    const items = (w2ui.toolbar.get(menu, false) as W2UI.W2Menu).items;
    for (const item of items) {
        if (item.id === id) {
            item.text = newName;
            w2ui.toolbar.set(menu, items);
            return;
        }
    }
    console.log("Didn't find name to replace!");
}

export function openPopup(options: any): Promise<void> {
    return new Promise<void>((res) => {
        options.onOpen = (event) => event.onComplete = res;
        w2popup.open(options);
    });
}
