/**
 * Utility for file system operations outside the Obsidian vault.
 * These utilities are intended for use in the desktop version of Obsidian.
 */

/**
 * Shows a save dialog to the user.
 * @param defaultName The default name for the file.
 * @returns The selected file path, or null if the user canceled.
 */
export async function showSaveDialog(defaultName: string): Promise<string | null> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const electron = require("electron");
		// In some versions of Obsidian/Electron, dialog is on remote, in others it's directly on electron
		const remote = electron.remote;
		const dialog = remote ? remote.dialog : electron.dialog;

		if (!dialog) {
			throw new Error("Electron dialog API not available.");
		}

		const result = await dialog.showSaveDialog({
			title: "Export to Single HTML",
			defaultPath: defaultName,
			filters: [
				{ name: "HTML Files", extensions: ["html"] },
				{ name: "All Files", extensions: ["*"] },
			],
		});

		if (result.canceled || !result.filePath) {
			return null;
		}

		return result.filePath;
	} catch (error) {
		console.error("Failed to show save dialog:", error);
		throw error;
	}
}

/**
 * Writes data to a file at the specified path.
 * @param filePath The path to the file.
 * @param data The data to write.
 */
export async function writeToFile(filePath: string, data: string): Promise<void> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fs = require("fs");
		return new Promise((resolve, reject) => {
			fs.writeFile(filePath, data, "utf8", (err: Error | null) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	} catch (error) {
		console.error("Failed to write file:", error);
		throw error;
	}
}
