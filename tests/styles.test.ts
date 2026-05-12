import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StyleManager } from "../src/exporter/styles";

describe("StyleManager", () => {
	let styleManager: StyleManager;

	let originalStyleSheets: any;

	beforeEach(() => {
		styleManager = new StyleManager();
		originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (originalStyleSheets) {
			Object.defineProperty(document, 'styleSheets', originalStyleSheets);
		}
	});

	it("should collect CSS variables from body and include 'body {' selector", () => {
		const mockComputedStyle = {
			length: 2,
			item: (i: number) => ["--text-normal", "--background-primary"][i],
			getPropertyValue: (prop: string) => {
				if (prop === "--text-normal") return "#ffffff";
				if (prop === "--background-primary") return "#000000";
				return "";
			},
			0: "--text-normal",
			1: "--background-primary"
		};
		
		vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle as any);

		const styles = styleManager.getActiveStyles();
		expect(styles).toContain("body {");
		expect(styles).toContain("--text-normal: #ffffff;");
		expect(styles).toContain("--background-primary: #000000;");
		expect(styles).toMatch(/body \{[\s\S]*--text-normal: #ffffff;[\s\S]*\}/);
	});

	it("should collect rules from multiple stylesheets", () => {
		const mockRules1 = [
			{ cssText: ".test-rule-1 { color: red; }" },
		];
		const mockRules2 = [
			{ cssText: ".test-rule-2 { color: blue; }" },
		];

		// Mock document.styleSheets
		Object.defineProperty(document, 'styleSheets', {
			value: [
				{ cssRules: mockRules1 },
				{ cssRules: mockRules2 },
			],
			configurable: true
		});

		const styles = styleManager.getActiveStyles();
		expect(styles).toContain(".test-rule-1 { color: red; }");
		expect(styles).toContain(".test-rule-2 { color: blue; }");
	});

	it("should skip inaccessible stylesheets", () => {
		Object.defineProperty(document, 'styleSheets', {
			value: [
				{
					get cssRules() {
						throw new Error("SecurityError: CSSStyleSheet.cssRules getter: Not allowed to access cross-origin stylesheet");
					},
					href: "http://external.com/style.css",
				},
				{
					cssRules: [{ cssText: ".accessible { color: blue; }" }],
				},
			],
			configurable: true
		});

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const styles = styleManager.getActiveStyles();
		expect(styles).toContain(".accessible { color: blue; }");
		expect(consoleSpy).toHaveBeenCalled();
	});
});
