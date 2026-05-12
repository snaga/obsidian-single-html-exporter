import { App, TFile } from "obsidian";
import { SingleHtmlPluginSettings } from "../main";
import { MarkdownHtmlRenderer } from "./renderer";
import { StyleManager } from "./styles";
import { ResourceManager } from "./resources";
import { HtmlPacker } from "./packer";

/**
 * ExportController orchestrates the Single HTML export pipeline.
 * It coordinates the rendering, style extraction, resource collection, and packing.
 */
export class ExportController {
	private renderer: MarkdownHtmlRenderer;
	private styleManager: StyleManager;
	private resourceManager: ResourceManager;
	private packer: HtmlPacker;

	constructor(
		private app: App,
		private settings: SingleHtmlPluginSettings
	) {
		this.renderer = new MarkdownHtmlRenderer(app, settings);
		this.styleManager = new StyleManager();
		this.resourceManager = new ResourceManager(app);
		this.packer = new HtmlPacker();
	}

	/**
	 * Runs the full export pipeline for a given file.
	 * @param file The TFile to export.
	 * @returns A promise that resolves to the final HTML string.
	 * @throws Error if any step in the pipeline fails.
	 */
	async runExport(file: TFile): Promise<string> {
		try {
			// 1. Read Markdown content
			const markdown = await this.app.vault.read(file);

			// 2. Render to HTML
			// We use the file path for link resolution during rendering
			const html = await this.renderer.render(markdown, file.path);

			// 3. Extract active styles
			const css = this.styleManager.getActiveStyles();
			const bodyClasses = this.styleManager.getBodyClasses();

			// 4. Collect resources (images, etc.) from both HTML and CSS
			const htmlResources = await this.resourceManager.collectResources(html, file.path);
			const cssResources = await this.resourceManager.collectResourcesFromCss(css);
			const allResources = [...htmlResources, ...cssResources];

			// 5. Pack into Single HTML
			const finalHtml = this.packer.pack(
				html,
				css,
				allResources,
				bodyClasses,
				file.basename,
				this.settings.includeTitle,
				this.settings.enableImageZoom
			);

			return finalHtml;
		} catch (error) {
			console.error("Single HTML Export failed:", error);
			throw new Error(`Failed to export "${file.name}" to Single HTML: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
