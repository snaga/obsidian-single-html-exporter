import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportController } from '../src/exporter/controller';
import { MarkdownHtmlRenderer } from '../src/exporter/renderer';
import { StyleManager } from '../src/exporter/styles';
import { ResourceManager } from '../src/exporter/resources';
import { HtmlPacker } from '../src/exporter/packer';
import { App, TFile } from './mocks/obsidian';

// Mock the dependencies
vi.mock('../src/exporter/renderer');
vi.mock('../src/exporter/styles');
vi.mock('../src/exporter/resources');
vi.mock('../src/exporter/packer');

describe('ExportController', () => {
	let controller: ExportController;
	let mockApp: any;
	let mockSettings: any;
	let mockFile: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			vault: {
				read: vi.fn().mockResolvedValue('# Test Content')
			}
		};
		mockSettings = { renderDelay: 500, includeTitle: false, enableImageZoom: true };
		mockFile = {
			path: 'test.md',
			name: 'test.md',
			basename: 'test'
		} as unknown as TFile;

		controller = new ExportController(mockApp as any, mockSettings);
	});

	it('should orchestrate the export pipeline correctly and in the right order', async () => {
		// Setup mock returns
		const mockHtml = '<div>Test</div>';
		const mockCss = 'body { color: red; }';
		const mockResources = [{ cid: 'img1', data: 'base64', mime: 'image/png', location: 'img.png' }];
		const mockHtmlOutput = 'HTML CONTENT';

		const callOrder: string[] = [];

		mockApp.vault.read.mockImplementation(async () => {
			callOrder.push('vault.read');
			return '# Test Content';
		});
		(MarkdownHtmlRenderer.prototype.render as any).mockImplementation(async () => {
			callOrder.push('renderer.render');
			return mockHtml;
		});
		(StyleManager.prototype.getActiveStyles as any).mockImplementation(() => {
			callOrder.push('styleManager.getActiveStyles');
			return mockCss;
		});
		(StyleManager.prototype.getBodyClasses as any).mockImplementation(() => {
			callOrder.push('styleManager.getBodyClasses');
			return 'theme-dark';
		});
		(ResourceManager.prototype.collectResources as any).mockImplementation(async () => {
			callOrder.push('resourceManager.collectResources');
			return mockResources;
		});
		(ResourceManager.prototype.collectResourcesFromCss as any).mockImplementation(async () => {
			callOrder.push('resourceManager.collectResourcesFromCss');
			return [];
		});
		(HtmlPacker.prototype.pack as any).mockImplementation(() => {
			callOrder.push('packer.pack');
			return mockHtmlOutput;
		});

		// Run the export
		const result = await controller.runExport(mockFile);

		// Verify the pipeline steps
		expect(mockApp.vault.read).toHaveBeenCalledWith(mockFile);
		expect(MarkdownHtmlRenderer.prototype.render).toHaveBeenCalledWith('# Test Content', 'test.md');
		expect(StyleManager.prototype.getActiveStyles).toHaveBeenCalled();
		expect(StyleManager.prototype.getBodyClasses).toHaveBeenCalled();
		expect(ResourceManager.prototype.collectResources).toHaveBeenCalledWith(mockHtml, 'test.md');
		expect(ResourceManager.prototype.collectResourcesFromCss).toHaveBeenCalledWith(mockCss);
		expect(HtmlPacker.prototype.pack).toHaveBeenCalledWith(
			mockHtml,
			mockCss,
			mockResources, // All resources (HTML + CSS)
			'theme-dark',
			'test',
			mockSettings.includeTitle,
			mockSettings.enableImageZoom
		);
		
		// Verify the order
		expect(callOrder).toEqual([
			'vault.read',
			'renderer.render',
			'styleManager.getActiveStyles',
			'styleManager.getBodyClasses',
			'resourceManager.collectResources',
			'resourceManager.collectResourcesFromCss',
			'packer.pack'
		]);

		expect(result).toBe(mockHtmlOutput);
	});

	it('should throw an error if any step fails', async () => {
		// Setup a failure in the pipeline
		(MarkdownHtmlRenderer.prototype.render as any).mockRejectedValue(new Error('Render failed'));

		// Run the export and expect it to throw
		await expect(controller.runExport(mockFile)).rejects.toThrow('Failed to export "test.md" to Single HTML: Render failed');
	});
});
