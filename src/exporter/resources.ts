import { App, TFile, arrayBufferToBase64, requestUrl } from 'obsidian';

/**
 * Represents an external resource (like an image) to be embedded in the MHTML.
 */
export interface Resource {
	/** Content-ID for the resource, used in cid: links */
	cid: string;
	/** Base64 encoded data of the resource */
	data: string;
	/** MIME type of the resource (e.g., image/png) */
	mime: string;
	/** Original location (src attribute) in the HTML */
	location: string;
}

/**
 * ResourceManager handles the discovery, loading, and encoding of external resources
 * referenced in the rendered HTML.
 */
export class ResourceManager {
	constructor(private app: App) {}

	/**
	 * Collects all resources from the HTML, resolves their paths within the vault,
	 * and converts them to Base64 encoded Resource objects.
	 * 
	 * @param html The rendered HTML string.
	 * @param sourcePath The path of the source Markdown file (used for link resolution).
	 * @returns A promise that resolves to an array of Resource objects.
	 */
	async collectResources(html: string, sourcePath: string): Promise<Resource[]> {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		
		// Define tags and attributes to look for. 
		// This list can be easily expanded in the future.
		const resourceSelectors = [
			{ tag: 'img', attr: 'src' },
			{ tag: 'audio', attr: 'src' },
			{ tag: 'video', attr: 'src' },
			{ tag: 'source', attr: 'src' },
			{ tag: 'track', attr: 'src' },
			{ tag: 'iframe', attr: 'src' }
		];

		const resources: Resource[] = [];
		// Map file path to its loaded resource data to avoid redundant loads and ensure CID consistency
		const fileCache = new Map<string, { cid: string, data: string, mime: string }>();
		// Set of processed original locations to avoid duplicate Resource entries for the exact same string
		const processedLocations = new Set<string>();

		for (const { tag, attr } of resourceSelectors) {
			const elements = Array.from(doc.querySelectorAll(tag));
			
			for (const el of elements) {
				const originalSrc = el.getAttribute(attr);
				if (!originalSrc || processedLocations.has(originalSrc)) continue;

				// Handle YouTube iframes specifically
				if (tag === 'iframe' && this.isYoutubeUrl(originalSrc)) {
					processedLocations.add(originalSrc);
					try {
						const videoId = this.extractYoutubeVideoId(originalSrc);
						if (videoId) {
							const resourceData = await this.loadYoutubeThumbnail(videoId);
							if (resourceData) {
								resources.push({
									...resourceData,
									location: originalSrc
								});
							}
						}
					} catch (error) {
						console.warn(`Failed to load YouTube thumbnail for: ${originalSrc}`, error);
					}
					continue;
				}

				if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://')) {
					processedLocations.add(originalSrc);
					try {
						const resourceData = await this.loadExternalResourceData(originalSrc);
						if (resourceData) {
							resources.push({
								...resourceData,
								location: originalSrc
							});
						}
					} catch (error) {
						console.warn(`Failed to load external resource: ${originalSrc}`, error);
					}
					continue;
				}

				const normalizedPath = this.normalizeResourcePath(originalSrc);
				if (!normalizedPath) continue;

				const file = this.app.metadataCache.getFirstLinkpathDest(normalizedPath, sourcePath);
				if (file instanceof TFile) {
					processedLocations.add(originalSrc);
					
					try {
						let resourceData = fileCache.get(file.path);
						if (!resourceData) {
							// Load and cache the file content
							resourceData = await this.loadResourceData(file);
							fileCache.set(file.path, resourceData);
						}

						// We add a Resource entry for each unique originalSrc.
						// If multiple different src strings point to the same file, 
						// they will share the same CID and data.
						resources.push({
							...resourceData,
							location: originalSrc
						});
					} catch (error) {
						console.warn(`Failed to load resource: ${originalSrc}`, error);
					}
				} else {
					// Resource not found in vault. We don't warn for external URLs as they are filtered out.
					if (!originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
						console.debug(`Resource not found in vault: ${normalizedPath} (original: ${originalSrc})`);
					}
				}
			}
		}

		return resources;
	}

	/**
	 * Collects resources referenced in CSS (url() links).
	 */
	async collectResourcesFromCss(css: string): Promise<Resource[]> {
		const resources: Resource[] = [];
		const urlRegex = /url\(['"]?([^'")]+)['"]?\)/gi;
		const processedUrls = new Set<string>();
		
		let match;
		while ((match = urlRegex.exec(css)) !== null) {
			const originalUrl = match[1];
			if (processedUrls.has(originalUrl) || originalUrl.startsWith('data:')) continue;
			processedUrls.add(originalUrl);

			if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
				try {
					const resourceData = await this.loadExternalResourceData(originalUrl);
					if (resourceData) {
						resources.push({
							...resourceData,
							location: originalUrl
						});
					}
				} catch (error) {
					console.warn(`Failed to load external CSS resource: ${originalUrl}`, error);
				}
				continue;
			}

			// For local files in CSS (like app://), we try to resolve them too
			const normalizedPath = this.normalizeResourcePath(originalUrl);
			if (!normalizedPath) continue;

			const file = this.app.metadataCache.getFirstLinkpathDest(normalizedPath, "");
			if (file instanceof TFile) {
				try {
					const resourceData = await this.loadResourceData(file);
					resources.push({
						...resourceData,
						location: originalUrl
					});
				} catch (error) {
					console.warn(`Failed to load local CSS resource: ${originalUrl}`, error);
				}
			}
		}

		return resources;
	}

	/**
	 * Normalizes a resource path by removing app:// prefix, stripping query strings, 
	 * and decoding URI components. Returns null if the path is an external URL or data URI.
	 */
	private normalizeResourcePath(src: string): string | null {
		// Skip data URIs and external URLs
		if (src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:')) {
			return null;
		}

		let path = src;
		// Remove app:// protocol (e.g., app://obsidian.md/path/to/file)
		if (path.startsWith('app://')) {
			path = path.replace(/^app:\/\/[^\/]+\//, '');
		}

		// Remove query strings or fragments (e.g., ?123 or #fragment)
		path = path.split(/[?#]/)[0];

		// Decode URL encoding (e.g., %20 -> space)
		try {
			path = decodeURIComponent(path);
		} catch (e) {
			// keep path as is
		}

		// Handle absolute paths by stripping the vault base path
		const adapter = this.app.vault.adapter as any;
		if (adapter && typeof adapter.getBasePath === 'function') {
			const basePath = adapter.getBasePath().replace(/\\/g, '/');
			const lowerPath = path.toLowerCase();
			const lowerBasePath = basePath.toLowerCase();
			
			if (lowerPath.startsWith(lowerBasePath)) {
				path = path.substring(basePath.length);
				if (path.startsWith('/')) {
					path = path.substring(1);
				}
			}
		}

		return path;
	}

	/**
	 * Loads an external resource via URL and returns its encoded data and metadata.
	 */
	private async loadExternalResourceData(url: string): Promise<{ cid: string, data: string, mime: string } | null> {
		try {
			const response = await requestUrl({ url, method: 'GET' });
			if (response.status !== 200) {
				console.warn(`Failed to download external resource: ${url} (Status: ${response.status})`);
				return null;
			}
			
			const buffer = response.arrayBuffer;
			const base64Data = arrayBufferToBase64(buffer);
			
			// Try to get mime type from headers, fallback to extension
			let mimeType = response.headers['content-type'] || response.headers['Content-Type'];
			if (!mimeType) {
				const urlWithoutQuery = url.split(/[?#]/)[0];
				const extension = urlWithoutQuery.split('.').pop() || '';
				mimeType = this.getMimeType(extension);
			} else {
				// Clean up mime type (e.g., "image/jpeg; charset=utf-8" -> "image/jpeg")
				mimeType = mimeType.split(';')[0].trim();
			}
			
			// Generate a safe filename for CID
			const urlWithoutQuery = url.split(/[?#]/)[0];
			const fileName = urlWithoutQuery.split('/').pop() || 'external_resource';
			const cid = this.generateCid(fileName);

			return { cid, data: base64Data, mime: mimeType };
		} catch (error) {
			console.warn(`Error downloading external resource: ${url}`, error);
			return null;
		}
	}

	/**
	 * Loads a file from the vault and returns its encoded data and metadata.
	 */
	private async loadResourceData(file: TFile): Promise<{ cid: string, data: string, mime: string }> {
		const buffer = await this.app.vault.readBinary(file);
		const base64Data = arrayBufferToBase64(buffer);
		const mimeType = this.getMimeType(file.extension);
		const cid = this.generateCid(file.name);

		return { cid, data: base64Data, mime: mimeType };
	}

	/**
	 * Generates a unique Content-ID for a resource.
	 */
	private generateCid(fileName: string): string {
		const randomPart = Math.random().toString(36).substring(2, 11);
		const timestamp = Date.now();
		// Sanitize filename to be safe for CID
		const safeName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
		return `${safeName}.${randomPart}.${timestamp}@obsidian.html`;
	}

	/**
	 * Determines the MIME type based on the file extension.
	 */
	private getMimeType(extension: string): string {
		const mimeMap: Record<string, string> = {
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'svg': 'image/svg+xml',
			'bmp': 'image/bmp',
			'ico': 'image/x-icon',
			'pdf': 'application/pdf',
			'mp4': 'video/mp4',
			'webm': 'video/webm',
			'ogv': 'video/ogg',
			'mp3': 'audio/mpeg',
			'wav': 'audio/wav',
			'ogg': 'audio/ogg',
			'woff': 'font/woff',
			'woff2': 'font/woff2',
			'ttf': 'font/ttf',
			'otf': 'font/otf',
			'eot': 'application/vnd.ms-fontobject',
		};

		return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
	}

	/**
	 * Checks if a URL is a YouTube URL.
	 */
	private isYoutubeUrl(url: string): boolean {
		return (
			url.includes('youtube.com') || 
			url.includes('youtu.be') || 
			url.includes('youtube-nocookie.com') ||
			url.includes('saved_resource.html') ||
			/[?&]v=[a-zA-Z0-9_-]{11}/.test(url)
		);
	}

	/**
	 * Extracts the YouTube video ID from a URL.
	 */
	private extractYoutubeVideoId(url: string): string | null {
		// Standard YouTube URL formats
		const standardRegex = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
		let match = url.match(standardRegex);
		if (match) return match[1];

		// Fallback for saved_resource.html or other wrappers that use v=VIDEO_ID
		const vParamRegex = /[?&]v=([^"&?\/\s]{11})/i;
		match = url.match(vParamRegex);
		return match ? match[1] : null;
	}

	/**
	 * Downloads the YouTube thumbnail for a given video ID.
	 */
	private async loadYoutubeThumbnail(videoId: string): Promise<{ cid: string, data: string, mime: string } | null> {
		const qualities = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
		
		for (const quality of qualities) {
			const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
			try {
				const response = await requestUrl({ url, method: 'GET' });
				if (response.status === 200) {
					const buffer = response.arrayBuffer;
					const base64Data = arrayBufferToBase64(buffer);
					const cid = this.generateCid(`youtube_${videoId}_${quality}.jpg`);
					return { cid, data: base64Data, mime: 'image/jpeg' };
				}
			} catch (error) {
				// Try next quality
			}
		}
		return null;
	}
}
