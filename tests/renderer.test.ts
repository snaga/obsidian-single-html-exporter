import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkdownHtmlRenderer } from "../src/exporter/renderer";
import { MarkdownRenderer, App } from "obsidian";

describe("MarkdownHtmlRenderer", () => {
	let renderer: MarkdownHtmlRenderer;
	let mockApp: any;
	let mockSettings: any;

	beforeEach(() => {
		mockApp = new App();
		mockSettings = { renderDelay: 100 };
		renderer = new MarkdownHtmlRenderer(mockApp, mockSettings);
		vi.clearAllMocks();
	});

	it("should render markdown to HTML", async () => {
		const markdown = "# Hello World";
		const sourcePath = "test.md";
		const expectedHtml = "<h1>Hello World</h1>";

		(MarkdownRenderer.render as any).mockImplementation((app: any, md: string, container: HTMLElement) => {
			container.innerHTML = expectedHtml;
			return Promise.resolve();
		});

		const result = await renderer.render(markdown, sourcePath);

		expect(result).toBe(expectedHtml);
		expect(MarkdownRenderer.render).toHaveBeenCalledWith(
			mockApp,
			markdown,
			expect.any(HTMLElement),
			sourcePath,
			expect.any(Object)
		);
	});

	it("should wait for mermaid rendering", async () => {
		const markdown = "```mermaid\ngraph TD; A-->B;\n```";
		const sourcePath = "mermaid.md";

		(MarkdownRenderer.render as any).mockImplementation((app: any, md: string, container: HTMLElement) => {
			const mermaidDiv = document.createElement("div");
			mermaidDiv.classList.add("mermaid");
			container.appendChild(mermaidDiv);

			// Simulate mermaid rendering after a delay
			setTimeout(() => {
				mermaidDiv.setAttribute("data-processed", "true");
			}, 50);

			return Promise.resolve();
		});

		const result = await renderer.render(markdown, sourcePath);

		expect(result).toContain('class="mermaid"');
		expect(result).toContain('data-processed="true"');
	});

	it("should timeout if mermaid rendering takes too long", async () => {
		const markdown = "```mermaid\ngraph TD; A-->B;\n```";
		const sourcePath = "mermaid.md";

		(MarkdownRenderer.render as any).mockImplementation((app: any, md: string, container: HTMLElement) => {
			const mermaidDiv = document.createElement("div");
			mermaidDiv.classList.add("mermaid");
			container.appendChild(mermaidDiv);

			// Simulate mermaid rendering that takes longer than mockSettings.renderDelay
			setTimeout(() => {
				mermaidDiv.setAttribute("data-processed", "true");
			}, 200);

			return Promise.resolve();
		});

		const result = await renderer.render(markdown, sourcePath);

		expect(result).toContain('class="mermaid"');
		expect(result).not.toContain('data-processed="true"');
	});
});
