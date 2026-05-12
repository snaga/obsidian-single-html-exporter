import { Plugin, Notice, TFile, Platform } from "obsidian";
import { SingleHtmlSettingTab } from "./ui/settings";
import { ExportController } from "./exporter/controller";
import { showSaveDialog, writeToFile } from "./utils/file-system";

export interface SingleHtmlPluginSettings {
	renderDelay: number;
	includeTitle: boolean;
	openAfterExport: boolean;
	enableImageZoom: boolean;
}

const DEFAULT_SETTINGS: SingleHtmlPluginSettings = {
	renderDelay: 500,
	includeTitle: false,
	openAfterExport: false,
	enableImageZoom: true,
};

export default class SingleHtmlExporterPlugin extends Plugin {
	settings: SingleHtmlPluginSettings;
	private controller: ExportController;

	async onload() {
		await this.loadSettings();

		this.controller = new ExportController(this.app, this.settings);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SingleHtmlSettingTab(this.app, this));

		// Add command to export the active file
		this.addCommand({
			id: "export-to-single-html",
			name: "Export to Single HTML",
			checkCallback: (checking: boolean) => {
				// Only available on Desktop and for Markdown files
				const activeFile = this.app.workspace.getActiveFile();
				const isMarkdown = activeFile?.extension === "md";

				if (Platform.isDesktop && activeFile && isMarkdown) {
					if (!checking) {
						this.exportFile(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		console.log("Obsidian Single HTML Exporter loaded");
	}

	onunload() {
		console.log("Obsidian Single HTML Exporter unloaded");
	}

	/**
	 * Orchestrates the export process for a single file.
	 * @param file The file to export.
	 */
	async exportFile(file: TFile) {
		try {
			new Notice(`Exporting "${file.name}" to Single HTML...`);

			// 1. Run the export pipeline to get HTML data
			const html = await this.controller.runExport(file);

			// 2. Ask the user where to save the file
			const defaultName = `${file.basename}.html`;
			const filePath = await showSaveDialog(defaultName);

			if (!filePath) {
				new Notice("Export canceled.");
				return;
			}

			// 3. Write the HTML data to the chosen path
			await writeToFile(filePath, html);

			new Notice(`Successfully exported to: ${filePath}`);

			// 4. Open the file if requested
			if (this.settings.openAfterExport && Platform.isDesktop) {
				try {
					const { shell } = require("electron");
					await shell.openPath(filePath);
				} catch (e) {
					console.error("Failed to open file:", e);
				}
			}
		} catch (error) {
			console.error("Single HTML Export failed:", error);
			new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
