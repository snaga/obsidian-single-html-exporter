/**
 * StyleManager handles the extraction of active CSS styles from the Obsidian environment.
 * It collects rules from all accessible stylesheets and captures essential CSS variables.
 */
export class StyleManager {
	/**
	 * Collects all active CSS styles and variables into a single string.
	 * @returns A consolidated CSS string.
	 */
	public getActiveStyles(): string {
		const styles: string[] = [];

		// 1. Collect rules from all document stylesheets
		for (let i = 0; i < document.styleSheets.length; i++) {
			const sheet = document.styleSheets[i];
			try {
				// Filter out community plugins to reduce CSS size
				// Check href for /plugins/ or the ownerNode ID for plugin-
				const href = sheet.href || "";
				const ownerNode = sheet.ownerNode as HTMLElement | null;
				const id = ownerNode ? (ownerNode.id || "") : "";
				
				if (href.includes("/plugins/") || id.startsWith("plugin-")) {
					// Skip community plugin CSS
					continue;
				}

				const rules = sheet.cssRules;
				if (rules) {
					for (let j = 0; j < rules.length; j++) {
						styles.push(rules[j].cssText);
					}
				}
			} catch (e) {
				// Skip stylesheets that are inaccessible due to CORS (e.g., external fonts/styles)
				console.warn("Could not access stylesheet rules:", sheet.href, e);
			}
		}

		// 2. Collect CSS variables from the body element
		// We do this after collecting stylesheets to ensure computed variables have priority
		styles.push(this.collectCssVariables());

		return styles.join("\n");
	}

	/**
	 * Gets the class names currently applied to the document body.
	 * This is crucial for Obsidian themes to apply correctly.
	 * @returns A string of class names.
	 */
	public getBodyClasses(): string {
		return document.body.className;
	}

	/**
	 * Extracts CSS variables defined on the body or root element.
	 * Obsidian uses many variables for themes and plugins.
	 */
	private collectCssVariables(): string {
		const body = document.body;
		const computedStyle = window.getComputedStyle(body);
		const variables: string[] = [];

		// Use 'body' selector instead of ':root' to ensure higher specificity and avoid conflicts
		variables.push("body {");

		// Iterate through all computed styles and pick those starting with '--'
		for (let i = 0; i < computedStyle.length; i++) {
			const propertyName = computedStyle.item(i);
			if (propertyName.startsWith("--")) {
				const value = computedStyle.getPropertyValue(propertyName);
				if (value) {
					variables.push(`  ${propertyName}: ${value.trim()};`);
				}
			}
		}

		variables.push("}");

		return variables.join("\n");
	}
}
