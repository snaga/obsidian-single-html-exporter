/**
 * RenderingObserver handles waiting for dynamic content (like Mermaid diagrams)
 * to finish rendering in the DOM.
 */
export class RenderingObserver {
	/**
	 * Waits for the rendering of dynamic elements within the container to complete.
	 * @param container The element containing the rendered markdown.
	 * @param timeoutMs Maximum time to wait in milliseconds.
	 */
	async waitForRendering(container: HTMLElement, timeoutMs: number): Promise<void> {
		// Give a small initial delay for Obsidian to start its post-processing
		await new Promise((resolve) => setTimeout(resolve, 50));

		return new Promise((resolve) => {
			const checkFinished = () => {
				// 1. Check all elements that are supposed to be Mermaid diagrams
				const mermaidElements = container.querySelectorAll(".mermaid");
				const mermaidBlocks = container.querySelectorAll(
					'pre[class*="language-mermaid"], code[class*="language-mermaid"], .block-language-mermaid'
				);

				// If there are no mermaid-related elements at all, we might be done
				// But we check if they are in the process of being rendered
				if (mermaidElements.length === 0 && mermaidBlocks.length === 0) {
					// No mermaid found
				} else {
					// Check if all .mermaid elements are processed
					for (const el of Array.from(mermaidElements)) {
						if (!el.hasAttribute("data-processed") || !el.querySelector("svg")) {
							return false;
						}
					}

					// Check if all mermaid blocks have been converted to processed .mermaid elements
					for (const el of Array.from(mermaidBlocks)) {
						// If the block itself hasn't been replaced/augmented with a processed SVG, it's not done
						if (!el.querySelector(".mermaid[data-processed] svg")) {
							// If the block IS the mermaid element and it's processed, it's fine
							if (
								el.classList.contains("mermaid") &&
								el.hasAttribute("data-processed") &&
								el.querySelector("svg")
							) {
								continue;
							}
							return false;
						}
					}
				}

				// Check MathJax
				const mathJax = container.querySelectorAll(".MathJax");
				if (mathJax.length > 0) {
					// MathJax usually renders quickly or we might need a specific check.
					// For now, we assume if they exist, they are being handled.
				}

				return true;
			};

			// If already finished, resolve immediately
			if (checkFinished()) {
				resolve();
				return;
			}

			const observer = new MutationObserver(() => {
				if (checkFinished()) {
					cleanup();
					resolve();
				}
			});

			observer.observe(container, {
				attributes: true,
				childList: true,
				subtree: true,
			});

			const timeoutId = setTimeout(() => {
				cleanup();
				// Resolve anyway on timeout to avoid hanging the export process
				resolve();
			}, timeoutMs);

			const cleanup = () => {
				observer.disconnect();
				clearTimeout(timeoutId);
			};
		});
	}
}
