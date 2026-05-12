import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleHtmlExporterPlugin from '../src/main';

describe('SingleHtmlExporterPlugin Settings', () => {
    let plugin: SingleHtmlExporterPlugin;

    beforeEach(() => {
        // @ts-ignore
        plugin = new SingleHtmlExporterPlugin(null, null);
    });

    it('should have default settings with renderDelay = 500', async () => {
        // Mock loadData to return empty object (no saved settings)
        vi.spyOn(plugin, 'loadData').mockResolvedValue({});
        
        await plugin.loadSettings();
        
        expect(plugin.settings).toBeDefined();
        expect(plugin.settings.renderDelay).toBe(500);
    });

    it('should load saved settings and merge with defaults', async () => {
        // Mock loadData to return saved settings
        vi.spyOn(plugin, 'loadData').mockResolvedValue({ renderDelay: 1000 });
        
        await plugin.loadSettings();
        
        expect(plugin.settings.renderDelay).toBe(1000);
    });

    it('should save settings correctly', async () => {
        const saveDataSpy = vi.spyOn(plugin, 'saveData').mockResolvedValue();
        
        plugin.settings = { renderDelay: 2000 };
        await plugin.saveSettings();
        
        expect(saveDataSpy).toHaveBeenCalledWith({ renderDelay: 2000 });
    });
});
