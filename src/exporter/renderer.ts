import { App, Component, MarkdownRenderer } from "obsidian";
import { SingleHtmlPluginSettings } from "../main";
import { RenderingObserver } from "./observer";

/**
 * MarkdownHtmlRenderer converts markdown strings into HTML strings
 * using Obsidian's built-in renderer and waits for dynamic content.
 */
export class MarkdownHtmlRenderer {
	private observer: RenderingObserver;

	constructor(
		private app: App,
		private settings: SingleHtmlPluginSettings
	) {
		this.observer = new RenderingObserver();
	}

	/**
	 * Renders markdown to HTML and waits for dynamic elements to finish rendering.
	 * @param markdown The markdown string to render.
	 * @param sourcePath The path of the file being rendered (for link resolution).
	 * @returns The rendered HTML string.
	 */
	async render(markdown: string, sourcePath: string): Promise<string> {
		const container = document.createElement("div");
		// Adding markdown-rendered class helps with some default styling and plugin targeting
		container.classList.add("markdown-rendered");
		
		// CRITICAL: Many Obsidian sub-renderers (like Mermaid) require the element 
		// to be in the DOM to trigger correctly.
		// We use "ninja" positioning to keep it in the DOM and "visible" for size calculations
		// but hidden from the user.
		container.style.position = 'absolute';
		container.style.left = '-9999px';
		container.style.top = '-9999px';
		container.style.visibility = 'hidden';
		container.style.width = '1000px'; // Ensure enough width for Mermaid diagrams
		document.body.appendChild(container);

		const component = new Component();
		component.load();

		try {
			// Render the markdown into the container
			await MarkdownRenderer.render(this.app, markdown, container, sourcePath, component);

			// Wait for dynamic elements (like Mermaid) to finish rendering
			await this.observer.waitForRendering(container, this.settings.renderDelay);

			return container.innerHTML;
		} finally {
			// Clean up
			component.unload();
			if (container.parentNode) {
				container.parentNode.removeChild(container);
			}
		}
	}
}
