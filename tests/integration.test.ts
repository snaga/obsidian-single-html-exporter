import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SingleHtmlExporterPlugin from '../src/main';
import { App, Plugin, Platform, TFile } from 'obsidian';
import * as fileSystem from '../src/utils/file-system';
import { ExportController } from '../src/exporter/controller';

// Mock obsidian module
vi.mock('obsidian', async () => {
    const actual = await vi.importActual('obsidian');
    return {
        ...actual,
        Platform: {
            isDesktop: true,
            isMobile: false
        },
        Notice: vi.fn()
    };
});

// Mock file-system utils
vi.mock('../src/utils/file-system', () => ({
    showSaveDialog: vi.fn(),
    writeToFile: vi.fn()
}));

// Mock electron
const mockOpenPath = vi.fn().mockResolvedValue(undefined);
vi.mock('electron', () => ({
    shell: {
        openPath: mockOpenPath
    }
}));
// To support dynamic require('electron') in Vitest
import module from 'module';
const originalRequire = module.prototype.require;
(module.prototype.require as any) = function(id: string) {
    if (id === 'electron') return { shell: { openPath: mockOpenPath } };
    return originalRequire.apply(this, arguments as any);
};

// Mock ExportController
export const mockRunExport = vi.fn().mockResolvedValue('mocked-html-content');
vi.mock('../src/exporter/controller', () => {
    return {
        ExportController: class {
            runExport = mockRunExport;
        }
    };
});

describe('SingleHtmlExporterPlugin Integration', () => {
    let app: App;
    let plugin: SingleHtmlExporterPlugin;
    let mockManifest: any;

    beforeEach(() => {
        app = new App();
        app.workspace = {
            getActiveFile: vi.fn()
        };
        mockManifest = {
            id: 'obsidian-single-html-exporter',
            name: 'Obsidian Single HTML Exporter',
            version: '1.0.0'
        };
        plugin = new SingleHtmlExporterPlugin(app, mockManifest);
        
        // Spy on addCommand
        vi.spyOn(plugin, 'addCommand');
        
        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Command Registration', () => {
        it('should register export-to-single-html command on load', async () => {
            await plugin.onload();
            
            expect(plugin.addCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'export-to-single-html',
                    name: 'Export to Single HTML',
                    checkCallback: expect.any(Function)
                })
            );
        });
    });

    describe('Command checkCallback logic', () => {
        let checkCallback: (checking: boolean) => boolean;

        beforeEach(async () => {
            await plugin.onload();
            const addCommandCall = (plugin.addCommand as any).mock.calls[0][0];
            checkCallback = addCommandCall.checkCallback;
            
            // Mock exportFile to prevent actual execution during checkCallback tests
            vi.spyOn(plugin, 'exportFile').mockImplementation(async () => {});
        });

        it('should return false if not on Desktop', () => {
            Platform.isDesktop = false;
            app.workspace.getActiveFile = vi.fn().mockReturnValue({ extension: 'md' });
            
            expect(checkCallback(true)).toBe(false);
            
            // Restore
            Platform.isDesktop = true;
        });

        it('should return false if no active file', () => {
            app.workspace.getActiveFile = vi.fn().mockReturnValue(null);
            
            expect(checkCallback(true)).toBe(false);
        });

        it('should return false if active file is not markdown', () => {
            app.workspace.getActiveFile = vi.fn().mockReturnValue({ extension: 'pdf' });
            
            expect(checkCallback(true)).toBe(false);
        });

        it('should return true if on Desktop and active file is markdown', () => {
            app.workspace.getActiveFile = vi.fn().mockReturnValue({ extension: 'md' });
            
            expect(checkCallback(true)).toBe(true);
        });

        it('should call exportFile if checking is false and conditions are met', () => {
            const mockFile = { extension: 'md' } as TFile;
            app.workspace.getActiveFile = vi.fn().mockReturnValue(mockFile);
            
            const result = checkCallback(false);
            
            expect(result).toBe(true);
            expect(plugin.exportFile).toHaveBeenCalledWith(mockFile);
        });
    });

    describe('Export Pipeline (exportFile)', () => {
        let mockFile: TFile;

        beforeEach(async () => {
            await plugin.onload();
            mockFile = {
                name: 'test-file.md',
                basename: 'test-file',
                extension: 'md',
                path: 'test-file.md',
                vault: {} as any,
                parent: {} as any,
                stat: {} as any
            } as TFile;
            mockRunExport.mockClear();
            mockRunExport.mockResolvedValue('mocked-html-content');
        });

        it('should run the full export pipeline successfully', async () => {
            // Setup mocks
            const mockSavePath = '/path/to/save/test-file.html';
            vi.mocked(fileSystem.showSaveDialog).mockResolvedValue(mockSavePath);
            vi.mocked(fileSystem.writeToFile).mockResolvedValue(undefined);

            // Execute
            await plugin.exportFile(mockFile);

            // Verify controller.runExport was called
            expect(mockRunExport).toHaveBeenCalledWith(mockFile);

            // Verify showSaveDialog was called with default name
            expect(fileSystem.showSaveDialog).toHaveBeenCalledWith('test-file.html');

            // Verify writeToFile was called with correct path and data
            expect(fileSystem.writeToFile).toHaveBeenCalledWith(mockSavePath, 'mocked-html-content');
        });

        it('should cancel export if save dialog is canceled', async () => {
            // Setup mocks
            vi.mocked(fileSystem.showSaveDialog).mockResolvedValue(null); // User canceled

            // Execute
            await plugin.exportFile(mockFile);

            // Verify controller.runExport was called
            expect(mockRunExport).toHaveBeenCalledWith(mockFile);

            // Verify showSaveDialog was called
            expect(fileSystem.showSaveDialog).toHaveBeenCalledWith('test-file.html');

            // Verify writeToFile was NOT called
            expect(fileSystem.writeToFile).not.toHaveBeenCalled();
        });
        
        it('should handle errors during export', async () => {
            // Setup mocks to throw error
            mockRunExport.mockRejectedValue(new Error('Export failed'));
            
            // Execute
            await plugin.exportFile(mockFile);
            
            // Verify showSaveDialog was NOT called
            expect(fileSystem.showSaveDialog).not.toHaveBeenCalled();
        });

        it('should open the file after export if openAfterExport is true', async () => {
            // Setup settings
            plugin.settings.openAfterExport = true;
            
            // Setup mocks
            const mockSavePath = '/path/to/save/test-file.html';
            vi.mocked(fileSystem.showSaveDialog).mockResolvedValue(mockSavePath);
            vi.mocked(fileSystem.writeToFile).mockResolvedValue(undefined);

            // Execute
            await plugin.exportFile(mockFile);

            // Verify shell.openPath was called
            expect(mockOpenPath).toHaveBeenCalledWith(mockSavePath);
        });

        it('should NOT open the file after export if openAfterExport is false', async () => {
            // Setup settings
            plugin.settings.openAfterExport = false;
            
            // Setup mocks
            const mockSavePath = '/path/to/save/test-file.html';
            vi.mocked(fileSystem.showSaveDialog).mockResolvedValue(mockSavePath);
            vi.mocked(fileSystem.writeToFile).mockResolvedValue(undefined);

            // Execute
            await plugin.exportFile(mockFile);

            // Verify shell.openPath was NOT called
            expect(mockOpenPath).not.toHaveBeenCalled();
        });
    });
});
