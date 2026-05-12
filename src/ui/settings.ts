import { App, PluginSettingTab, Setting } from "obsidian";
import SingleHtmlExporterPlugin from "../main";

export class SingleHtmlSettingTab extends PluginSettingTab {
	plugin: SingleHtmlExporterPlugin;

	constructor(app: App, plugin: SingleHtmlExporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Rendering delay (ms)")
			.setDesc(
				"The amount of time to wait for dynamic content (like Mermaid or MathJax) to render before capturing the HTML."
			)
			.addText((text) =>
				text
					.setPlaceholder("500")
					.setValue(this.plugin.settings.renderDelay.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue >= 0) {
							this.plugin.settings.renderDelay = numValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Include note title")
			.setDesc("Include the note title as an H1 at the top of the exported HTML.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeTitle)
					.onChange(async (value) => {
						this.plugin.settings.includeTitle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Open after export")
			.setDesc("Automatically open the exported HTML file in your default browser.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openAfterExport)
					.onChange(async (value) => {
						this.plugin.settings.openAfterExport = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable image zoom (open in new tab)")
			.setDesc("Clicking on an image in the exported HTML will open its original size in a new browser tab.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableImageZoom)
					.onChange(async (value) => {
						this.plugin.settings.enableImageZoom = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
