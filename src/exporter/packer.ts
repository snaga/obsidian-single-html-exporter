import { Resource } from './resources';

/**
 * HtmlPacker handles the creation of a single, self-contained HTML file.
 * It bundles HTML, CSS, and external resources (as Data URIs) into a single string.
 */
export class HtmlPacker {
	/**
	 * Packs the provided HTML, CSS, and resources into a single HTML string.
	 * 
	 * @param html The rendered HTML content.
	 * @param css The consolidated CSS styles.
	 * @param resources An array of collected resources (images, etc.).
	 * @param bodyClasses The classes to apply to the body element.
	 * @param title The title of the exported HTML document.
	 * @param includeTitle Whether to include the title as an H1 in the HTML body.
	 * @param enableImageZoom Whether to wrap images in links to open them in a new tab.
	 * @returns The complete HTML string.
	 */
	pack(html: string, css: string, resources: Resource[], bodyClasses: string = "", title: string = "Obsidian Export", includeTitle: boolean = false, enableImageZoom: boolean = true): string {
		// 0. Wrap HTML in boilerplate if needed
		let fullHtml = html;
		const titleHtml = includeTitle ? `<h1>${title}</h1>\n` : "";

		// Ensure body has 'print' class to satisfy Obsidian's internal print CSS rules
		const finalBodyClasses = bodyClasses.includes('print') ? bodyClasses : `${bodyClasses} print`.trim();

		if (!fullHtml.toLowerCase().includes('<html')) {
			fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body class="${finalBodyClasses}">
<div class="app-container">
<div class="markdown-reading-view">
<div class="markdown-preview-view markdown-rendered">
${titleHtml}${fullHtml}
</div>
</div>
</div>
</body>
</html>`;
		}

		// Add custom layout override CSS to ensure it renders as a flat document, not an app
		let layoutOverrideCss = `
		/* Override Obsidian's default app layout for a flat document */
		html, body {
			overflow: auto !important;
			background-color: var(--background-primary, #ffffff) !important;
			color: var(--text-normal, #000000) !important;
			width: 100% !important;
			margin: 0 !important;
			padding: 0 !important;
		}
		.app-container, .markdown-reading-view, .markdown-preview-view {
			position: static !important;
			display: block !important;
			overflow: visible !important;
			width: 100% !important;
			height: auto !important;
			/* CRITICAL: Reset stacking context triggers to ensure position: fixed 
			   works relative to the viewport, not these containers. */
			transform: none !important;
			contain: none !important;
			perspective: none !important;
			filter: none !important;
			backdrop-filter: none !important;
		}
		.markdown-reading-view {
			max-width: 900px !important;
			margin: 0 auto !important;
			padding: 40px !important;
		}
		.markdown-rendered {
			opacity: 1 !important;
			visibility: visible !important;
			height: auto !important;
			contain: none !important; /* Fix for blank screens */
		}
		.markdown-rendered img {
			max-width: 100% !important;
			height: auto !important;
		}
		.markdown-rendered .image-link {
			cursor: zoom-in;
			display: inline-block;
			max-width: 100%;
		}

		/* YouTube Thumbnail Link Styles */
		.youtube-embed-wrapper {
			max-width: 600px;
			margin: 1.5em auto;
		}
		.youtube-embed-replacement {
			position: relative;
			display: block;
			width: 100%;
			aspect-ratio: 16 / 9;
			background-color: #000;
			cursor: pointer;
			text-decoration: none !important;
			border-radius: 8px;
			overflow: hidden;
			box-shadow: 0 4px 15px rgba(0,0,0,0.1);
		}
		.youtube-embed-replacement img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			opacity: 0.9;
			transition: opacity 0.2s, transform 0.3s;
		}
		.youtube-embed-replacement:hover img {
			opacity: 1;
			transform: scale(1.02);
		}
		.youtube-play-button {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 68px;
			height: 48px;
			background: rgba(255, 0, 0, 0.9);
			border-radius: 12px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: background 0.2s, transform 0.2s;
			z-index: 2;
		}
		.youtube-embed-replacement:hover .youtube-play-button {
			background: rgba(255, 0, 0, 1);
			transform: translate(-50%, -50%) scale(1.1);
		}
		.youtube-play-button div {
			width: 0;
			height: 0;
			border-style: solid;
			border-width: 10px 0 10px 20px;
			border-color: transparent transparent transparent white;
			margin-left: 4px;
		}

		/* Print Styles - Basic overrides (Nuclear Reset v2 will handle the heavy lifting) */
		@media print {
			.youtube-play-button {
				display: none !important; /* Hide play button on print */
			}
		}
		`;

		if (enableImageZoom) {
			fullHtml = this.wrapImagesInLinks(fullHtml);
		}

		// 1. Prepare the HTML content
		let consolidatedCss = css + '\n' + layoutOverrideCss;
		consolidatedCss = this.replaceResourceLinksInCss(consolidatedCss, resources);
		
		let processedHtml = this.injectStyles(fullHtml, consolidatedCss);
		
		// 2. Inject the Nuclear Print Reset at the very end of the body
		// This is crucial to ensure it wins the specificity battle against Obsidian's internal styles.
		processedHtml = this.injectNuclearPrintReset(processedHtml);

		// 3. Unescape HTML entities in src attributes
		processedHtml = this.unescapeImageSrc(processedHtml);

		// 4. Replace resource URLs with Data URIs
		processedHtml = this.replaceResourceLinks(processedHtml, resources);

		// 5. Replace YouTube iframes with thumbnail links
		processedHtml = this.replaceYoutubeIframes(processedHtml, resources);

		// 6. Inject Data URI navigation bypass script if image zoom is enabled
		if (enableImageZoom) {
			processedHtml = this.injectDataUriBypassScript(processedHtml);
		}

		return processedHtml;
	}

	/**
	 * Injects a script to bypass browser security restrictions when opening data:image URLs.
	 * Modern browsers block top-frame navigation to data: URLs.
	 */
	private injectDataUriBypassScript(html: string): string {
		const script = `
		<script id="data-uri-bypass">
		document.addEventListener('click', function(e) {
			const link = e.target.closest('a.image-link');
			if (link && link.href && link.href.startsWith('data:image/')) {
				e.preventDefault();
				const dataUri = link.getAttribute('href');
				const win = window.open();
				if (win) {
					win.document.write('<html><head><title>Image Preview</title><style>body { margin: 0; display: flex; align-items: center; justify-content: center; background: #202020; min-height: 100vh; } img { max-width: 100%; height: auto; cursor: zoom-out; }</style></head><body onclick="window.close()"><img src="' + dataUri + '"></body></html>');
					win.document.close();
				} else {
					console.error('Failed to open image preview window. Pop-up blocker might be active.');
				}
			}
		}, true);
		</script>`;

		if (html.includes('</body>')) {
			return html.replace('</body>', `${script}\n</body>`);
		} else {
			return html + script;
		}
	}

	/**
	 * Injects a powerful print reset at the end of the body to override 
	 * any specificity conflicts with Obsidian's internal styles.
	 */
	private injectNuclearPrintReset(html: string): string {
		const resetCss = `
		<style id="nuclear-print-reset">
		@media print {
			/* Nuclear Reset v2: Use highest possible specificity by targeting body explicitly */
			html, body {
				display: block !important;
				overflow: visible !important;
				height: auto !important;
				min-height: 100% !important;
				background: white !important;
				color: black !important;
				contain: none !important;
				margin: 0 !important;
				padding: 0 !important;
				print-color-adjust: exact;
				-webkit-print-color-adjust: exact;
			}

			/* Force display of the entire hierarchy from body down to the content.
			   We target body.print to ensure we win against Obsidian's internal !important rules. */
			body.print,
			body.print .app-container, 
			body.print .markdown-reading-view, 
			body.print .markdown-preview-view, 
			body.print .markdown-rendered {
				display: block !important;
				visibility: visible !important;
				opacity: 1 !important;
				position: static !important;
				height: auto !important;
				min-height: 100% !important;
				width: 100% !important;
				overflow: visible !important;
				contain: none !important;
			}

			/* Target the specific container that is often hidden by Obsidian's print style */
			body.print > .app-container {
				display: block !important;
			}

			/* Ensure background colors and images are printed for all elements */
			* {
				print-color-adjust: exact !important;
				-webkit-print-color-adjust: exact !important;
			}

			/* Re-hide only the things we definitely don't want */
			.titlebar, .status-bar, .sidebar, .ribbon, .nav-header, .view-header {
				display: none !important;
			}
			.youtube-play-button {
				display: none !important; /* Hide play button on print */
			}
		}
		</style>`;

		if (html.includes('</body>')) {
			return html.replace('</body>', `${resetCss}\n</body>`);
		} else {
			return html + resetCss;
		}
	}

	/**
	 * Injects the CSS into the HTML's <head> section.
	 */
	private injectStyles(html: string, css: string): string {
		const styleTag = `<style>\n${css}\n</style>`;
		
		if (html.includes('</head>')) {
			return html.replace('</head>', `${styleTag}\n</head>`);
		} else if (html.includes('<body>')) {
			return html.replace('<body>', `<head>\n${styleTag}\n</head>\n<body>`);
		} else {
			return `${styleTag}\n${html}`;
		}
	}

	/**
	 * Replaces resource URLs in the HTML with their corresponding Data URIs.
	 */
	private replaceResourceLinks(html: string, resources: Resource[]): string {
		let result = html;
		for (const resource of resources) {
			// Skip YouTube iframes here, they are handled separately
			if (
				resource.location.includes('youtube.com') || 
				resource.location.includes('youtu.be') || 
				resource.location.includes('youtube-nocookie.com') ||
				resource.location.includes('saved_resource.html') ||
				/[?&]v=[a-zA-Z0-9_-]{11}/.test(resource.location)
			) {
				continue;
			}

			const dataUri = `data:${resource.mime};base64,${resource.data}`;
			// Escape special characters in location for regex
			const escapedLocation = resource.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Replace src="location" or href="location"
			const regex = new RegExp(`((?:src|href)=["'])${escapedLocation}(["'])`, 'g');
			result = result.replace(regex, `$1${dataUri}$2`);
		}
		return result;
	}

	/**
	 * Replaces resource URLs in CSS url() links with their corresponding Data URIs.
	 */
	private replaceResourceLinksInCss(css: string, resources: Resource[]): string {
		let result = css;
		for (const resource of resources) {
			const dataUri = `data:${resource.mime};base64,${resource.data}`;
			// Escape special characters in location for regex
			const escapedLocation = resource.location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Replace url("location") or url('location') or url(location)
			const regex = new RegExp(`url\\(['"]?${escapedLocation}['"]?\\)`, 'g');
			result = result.replace(regex, `url("${dataUri}")`);
		}
		return result;
	}

	/**
	 * Replaces YouTube iframes with a thumbnail image and a link to the video.
	 */
	private replaceYoutubeIframes(html: string, resources: Resource[]): string {
		let result = html;
		
		// Find all YouTube resources
		const youtubeResources = resources.filter(r => 
			r.location.includes('youtube.com') || 
			r.location.includes('youtu.be') || 
			r.location.includes('youtube-nocookie.com') ||
			r.location.includes('saved_resource.html') ||
			/[?&]v=[a-zA-Z0-9_-]{11}/.test(r.location)
		);
		if (youtubeResources.length === 0) return result;

		// Map location to resource for quick lookup
		const youtubeMap = new Map<string, Resource>();
		for (const res of youtubeResources) {
			youtubeMap.set(res.location, res);
		}

		// Regex to find ANY iframe and capture its src (including multiline tags)
		const anyIframeRegex = /<iframe[\s\S]*?src=["']([^"']+)["'][\s\S]*?>[\s\S]*?<\/iframe>/gi;

		result = result.replace(anyIframeRegex, (match, src) => {
			// Unescape &amp; in src just in case it's escaped in the HTML
			const unescapedSrc = src.replace(/&amp;/g, '&');
			
			// Try to find a matching resource by either the exact src or unescaped src
			const resource = youtubeMap.get(src) || youtubeMap.get(unescapedSrc);
			
			if (resource) {
				const dataUri = `data:${resource.mime};base64,${resource.data}`;
				const videoUrl = resource.location;
				
				// Extract video ID for the link (ensure it's a watch link, not embed)
				const videoId = this.extractYoutubeVideoId(videoUrl);
				const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;

				return `<div class="youtube-embed-wrapper">` +
						`<a href="${watchUrl}" target="_blank" class="youtube-embed-replacement">` +
						`<img src="${dataUri}" alt="YouTube Video">` +
						`<div class="youtube-play-button"><div></div></div>` +
						`</a>` +
						`</div>`;
			}
			
			return match; // No match found in collected resources, keep original
		});
		
		return result;
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
	 * Wraps images in <a> tags to allow opening them in a new tab.
	 */
	private wrapImagesInLinks(html: string): string {
		// Use a placeholder strategy to avoid wrapping images already inside <a> tags
		const anchors: string[] = [];
		let tempHtml = html.replace(/<a[\s\S]*?<\/a>/gi, (match) => {
			anchors.push(match);
			return `___HTML_ANCHOR_${anchors.length - 1}___`;
		});

		tempHtml = tempHtml.replace(/<img([^>]+)>/gi, (match, attrs) => {
			// Skip if it's already part of a YouTube replacement
			if (attrs.includes('youtube-embed-replacement')) return match;

			const srcMatch = attrs.match(/src=["'](.*?)["']/i);
			const src = srcMatch ? srcMatch[1] : '';
			
			return `<a href="${src}" target="_blank" class="image-link"><img${attrs}></a>`;
		});

		// Restore anchors
		return tempHtml.replace(/___HTML_ANCHOR_(\d+)___/g, (match, index) => {
			return anchors[parseInt(index)];
		});
	}

	/**
	 * Unescapes HTML entities in the src attribute of elements.
	 */
	private unescapeImageSrc(html: string): string {
		return html.replace(/src=(["'])(.*?)\1/g, (match, quote, srcValue) => {
			// Replace common HTML entities that might break external URLs
			const unescapedSrc = srcValue.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
			return `src=${quote}${unescapedSrc}${quote}`;
		});
	}
}
