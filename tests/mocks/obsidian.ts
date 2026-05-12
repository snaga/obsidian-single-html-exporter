import { vi } from 'vitest';

export class Plugin {
    app: any;
    manifest: any;
    constructor(app: any, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    async loadData() {
        return {};
    }
    async saveData(data: any) {
        return;
    }
    addSettingTab(tab: any) {
        return;
    }
    addCommand(command: any) {
        return;
    }
}

export const Platform = {
    isDesktop: true,
    isMobile: false
};

export class Notice {
    constructor(message: string) {}
}

export class PluginSettingTab {
    app: any;
    plugin: any;
    containerEl: HTMLElement;
    constructor(app: any, plugin: any) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
        (this.containerEl as any).empty = () => {
            this.containerEl.innerHTML = '';
        };
    }
    display() { }
}

export class Setting {
    containerEl: HTMLElement;
    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }
    setName(name: string) { return this; }
    setDesc(desc: string) { return this; }
    addText(cb: (text: any) => any) {
        cb({
            setPlaceholder: () => ({ setValue: () => ({ onChange: () => { } }) }),
            setValue: () => ({ onChange: () => { } }),
            onChange: () => { }
        });
        return this;
    }
    addToggle(cb: (toggle: any) => any) {
        cb({
            setValue: () => ({ onChange: () => { } }),
            onChange: () => { }
        });
        return this;
    }
}

export class Component {
    load() {}
    unload() {}
}

export class TFile {
    path: string;
    name: string;
    extension: string;
    basename: string;
    vault: any;
    parent: any;
    stat: any;
}

export const MarkdownRenderer = {
    render: vi.fn()
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export class App {
    vault: any;
    metadataCache: any;
    workspace: any;
}

export const requestUrl = vi.fn();
