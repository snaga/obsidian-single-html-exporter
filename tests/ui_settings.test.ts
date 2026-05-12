import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleHtmlExporterPlugin from '../src/main';
import { SingleHtmlSettingTab } from '../src/ui/settings';

describe('SingleHtmlSettingTab', () => {
    let plugin: SingleHtmlExporterPlugin;
    let tab: SingleHtmlSettingTab;

    beforeEach(async () => {
        // @ts-ignore
        plugin = new SingleHtmlExporterPlugin(null, null);
        vi.spyOn(plugin, 'loadData').mockResolvedValue({});
        await plugin.loadSettings();
        
        // @ts-ignore
        tab = new SingleHtmlSettingTab(null, plugin);
    });

    it('should update renderDelay when setting is changed', async () => {
        const saveSettingsSpy = vi.spyOn(plugin, 'saveSettings').mockResolvedValue();
        
        // Simulate UI change
        // In our mock, addText calls the callback immediately.
        // We need to capture the onChange callback.
        
        let onChangeCallback: (value: string) => Promise<void> = async () => {};
        
        // Re-mock Setting to capture the callback
        const { Setting } = await import('obsidian');
        vi.spyOn(Setting.prototype, 'addText').mockImplementation((cb: any) => {
            cb({
                setPlaceholder: () => ({ setValue: () => ({ onChange: (oc: any) => { onChangeCallback = oc; } }) }),
                setValue: () => ({ onChange: (oc: any) => { onChangeCallback = oc; } }),
                onChange: (oc: any) => { onChangeCallback = oc; }
            });
            return new Setting(document.createElement('div'));
        });

        tab.display();
        
        // Trigger change
        await onChangeCallback('1000');
        
        expect(plugin.settings.renderDelay).toBe(1000);
        expect(saveSettingsSpy).toHaveBeenCalled();
    });

    it('should not update renderDelay if value is invalid', async () => {
        const saveSettingsSpy = vi.spyOn(plugin, 'saveSettings').mockResolvedValue();
        
        let onChangeCallback: (value: string) => Promise<void> = async () => {};
        const { Setting } = await import('obsidian');
        vi.spyOn(Setting.prototype, 'addText').mockImplementation((cb: any) => {
            cb({
                setPlaceholder: () => ({ setValue: () => ({ onChange: (oc: any) => { onChangeCallback = oc; } }) }),
                setValue: () => ({ onChange: (oc: any) => { onChangeCallback = oc; } }),
                onChange: (oc: any) => { onChangeCallback = oc; }
            });
            return new Setting(document.createElement('div'));
        });

        tab.display();
        
        // Trigger change with invalid value
        await onChangeCallback('abc');
        
        expect(plugin.settings.renderDelay).toBe(500); // Remains default
        expect(saveSettingsSpy).not.toHaveBeenCalled();
    });
});
