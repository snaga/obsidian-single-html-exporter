import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceManager } from '../src/exporter/resources';
import { App, TFile, requestUrl } from 'obsidian';

describe('ResourceManager', () => {
    let app: App;
    let resourceManager: ResourceManager;

    beforeEach(() => {
        app = {
            vault: {
                readBinary: vi.fn(),
            },
            metadataCache: {
                getFirstLinkpathDest: vi.fn(),
            },
        } as any;
        resourceManager = new ResourceManager(app);
        vi.clearAllMocks();
    });

    it('should collect resources from HTML and return Resource objects', async () => {
        const html = '<img src="image.png">';
        const sourcePath = 'note.md';
        const mockFile = new TFile();
        mockFile.path = 'attachments/image.png';
        mockFile.name = 'image.png';
        mockFile.extension = 'png';

        const mockBuffer = new Uint8Array([1, 2, 3]).buffer;

        (app.metadataCache.getFirstLinkpathDest as any).mockReturnValue(mockFile);
        (app.vault.readBinary as any).mockResolvedValue(mockBuffer);

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(1);
        expect(resources[0].location).toBe('image.png');
        expect(resources[0].mime).toBe('image/png');
        expect(resources[0].data).toBe(btoa('\x01\x02\x03'));
        expect(resources[0].cid).toMatch(/image_png\..*@obsidian\.html/);
        expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith('image.png', sourcePath);
    });

    it('should handle app:// protocol and URL-encoded paths', async () => {
        const html = '<img src="app://obsidian.md/path%20to/image.png">';
        const sourcePath = 'note.md';
        const mockFile = new TFile();
        mockFile.path = 'path to/image.png';
        mockFile.name = 'image.png';
        mockFile.extension = 'png';

        (app.metadataCache.getFirstLinkpathDest as any).mockReturnValue(mockFile);
        (app.vault.readBinary as any).mockResolvedValue(new ArrayBuffer(0));

        await resourceManager.collectResources(html, sourcePath);

        expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith('path to/image.png', sourcePath);
    });

    it('should use cache for duplicate files and maintain CID consistency', async () => {
        const html = `
            <img src="image.png">
            <img src="sub/../image.png">
        `;
        const sourcePath = 'note.md';
        const mockFile = new TFile();
        mockFile.path = 'attachments/image.png';
        mockFile.name = 'image.png';
        mockFile.extension = 'png';

        (app.metadataCache.getFirstLinkpathDest as any).mockImplementation((path: string) => {
            if (path === 'image.png' || path === 'sub/../image.png') return mockFile;
            return null;
        });
        (app.vault.readBinary as any).mockResolvedValue(new ArrayBuffer(0));

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(2);
        expect(resources[0].cid).toBe(resources[1].cid);
        expect(app.vault.readBinary).toHaveBeenCalledTimes(1);
    });

    it('should download external URLs and skip data URIs', async () => {
        const html = `
            <img src="https://example.com/image.png">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==">
        `;
        const sourcePath = 'note.md';

        const mockBuffer = new Uint8Array([4, 5, 6]).buffer;
        (requestUrl as any).mockResolvedValue({
            status: 200,
            arrayBuffer: mockBuffer,
            headers: {
                'content-type': 'image/png'
            }
        });

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(1);
        expect(resources[0].location).toBe('https://example.com/image.png');
        expect(resources[0].mime).toBe('image/png');
        expect(resources[0].data).toBe(btoa('\x04\x05\x06'));
        expect(resources[0].cid).toMatch(/image_png\..*@obsidian\.html/);
        expect(requestUrl).toHaveBeenCalledWith({ url: 'https://example.com/image.png', method: 'GET' });
        expect(app.metadataCache.getFirstLinkpathDest).not.toHaveBeenCalled();
    });

    it('should handle duplicate external URLs and download only once', async () => {
        const html = `
            <img src="https://example.com/image.png">
            <img src="https://example.com/image.png">
        `;
        const sourcePath = 'note.md';

        const mockBuffer = new Uint8Array([4, 5, 6]).buffer;
        (requestUrl as any).mockResolvedValue({
            status: 200,
            arrayBuffer: mockBuffer,
            headers: {
                'content-type': 'image/png'
            }
        });

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(1);
        expect(requestUrl).toHaveBeenCalledTimes(1);
    });

    it('should skip external URLs that return an error', async () => {
        const html = '<img src="https://example.com/missing.png">';
        const sourcePath = 'note.md';

        (requestUrl as any).mockResolvedValue({
            status: 404,
            arrayBuffer: new ArrayBuffer(0),
            headers: {}
        });

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(0);
        expect(requestUrl).toHaveBeenCalledTimes(1);
    });

    it('should skip non-existent files', async () => {
        const html = '<img src="missing.png">';
        const sourcePath = 'note.md';

        (app.metadataCache.getFirstLinkpathDest as any).mockReturnValue(null);

        const resources = await resourceManager.collectResources(html, sourcePath);

        expect(resources).toHaveLength(0);
    });

    it('should handle query strings and fragments in paths', async () => {
        const html = '<img src="image.png?v=123#fragment">';
        const sourcePath = 'note.md';
        const mockFile = new TFile();
        mockFile.path = 'image.png';
        mockFile.name = 'image.png';
        mockFile.extension = 'png';

        (app.metadataCache.getFirstLinkpathDest as any).mockReturnValue(mockFile);
        (app.vault.readBinary as any).mockResolvedValue(new ArrayBuffer(0));

        await resourceManager.collectResources(html, sourcePath);

        expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith('image.png', sourcePath);
    });
});
