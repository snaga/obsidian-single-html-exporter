import { describe, it, expect } from 'vitest';
import { HtmlPacker } from '../src/exporter/packer';
import { Resource } from '../src/exporter/resources';

describe('HtmlPacker', () => {
	const packer = new HtmlPacker();

	it('should pack HTML, CSS, and resources into a single self-contained HTML string', () => {
		const html = '<h1>Hello</h1><img src="image.png">';
		const css = 'h1 { color: red; }';
		const resources: Resource[] = [
			{
				cid: 'image.png.123@obsidian.html',
				data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BfAQJAAgt7fS4AAAAASUVORK5CYII=', // 1x1 transparent PNG
				mime: 'image/png',
				location: 'image.png'
			}
		];

		const result = packer.pack(html, css, resources, 'theme-dark', 'Test Title', true, false);

		// 1. Check for basic HTML structure
		expect(result).toContain('<!DOCTYPE html>');
		expect(result).toContain('<title>Test Title</title>');
		// Should include 'print' class automatically for Obsidian print style compatibility
		expect(result).toContain('<body class="theme-dark print">');
		
		// 2. Check for injected CSS
		expect(result).toContain('<style>');
		expect(result).toContain('h1 { color: red; }');
		expect(result).toContain('/* Override Obsidian\'s default app layout');

		// Check for Print Styles (Nuclear Reset)
		expect(result).toContain('@media print');
		expect(result).toContain('print-color-adjust: exact');
		expect(result).toContain('.markdown-rendered {');
		expect(result).toContain('display: block !important');

		// 3. Check for title H1 (since includeTitle is true)
		expect(result).toContain('<h1>Test Title</h1>');

		// 4. Check for resource as Data URI
		const expectedDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BfAQJAAgt7fS4AAAAASUVORK5CYII=';
		expect(result).toContain(`src="${expectedDataUri}"`);
	});

	it('should correctly replace resource links in HTML with Data URIs', () => {
		const html = '<div><img src="test.png"><img src=\'other.jpg\'></div>';
		const resources: Resource[] = [
			{ cid: 'cid1', data: 'data1', mime: 'image/png', location: 'test.png' },
			{ cid: 'cid2', data: 'data2', mime: 'image/jpeg', location: 'other.jpg' }
		];
		
		const processedHtml = (packer as any).replaceResourceLinks(html, resources);
		
		expect(processedHtml).toContain('src="data:image/png;base64,data1"');
		expect(processedHtml).toContain("src='data:image/jpeg;base64,data2'");
	});

	it('should replace both src and href in replaceResourceLinks', () => {
		const html = '<div><a href="test.png"><img src="test.png"></a></div>';
		const resources: Resource[] = [
			{ cid: 'cid1', data: 'data1', mime: 'image/png', location: 'test.png' }
		];
		
		const processedHtml = (packer as any).replaceResourceLinks(html, resources);
		
		expect(processedHtml).toContain('href="data:image/png;base64,data1"');
		expect(processedHtml).toContain('src="data:image/png;base64,data1"');
	});

	it('should replace YouTube iframes with thumbnail links and play button', () => {
		const youtubeUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
		const html = `<div><iframe src="${youtubeUrl}"></iframe></div>`;
		const resources: Resource[] = [
			{
				cid: 'youtube_dQw4w9WgXcQ.jpg',
				data: 'thumbnail_data',
				mime: 'image/jpeg',
				location: youtubeUrl
			}
		];

		const result = (packer as any).replaceYoutubeIframes(html, resources);

		expect(result).toContain('class="youtube-embed-replacement"');
		expect(result).toContain('class="youtube-play-button"');
		expect(result).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
		expect(result).toContain('src="data:image/jpeg;base64,thumbnail_data"');
		expect(result).not.toContain('<iframe');
	});

	it('should handle saved_resource.html and other wrappers with v= parameter', () => {
		const wrapperUrl = './test_files/saved_resource.html?v=dQw4w9WgXcQ';
		const html = `<div><iframe src="${wrapperUrl}"></iframe></div>`;
		const resources: Resource[] = [
			{
				cid: 'youtube_dQw4w9WgXcQ.jpg',
				data: 'thumbnail_data',
				mime: 'image/jpeg',
				location: wrapperUrl
			}
		];

		const result = (packer as any).replaceYoutubeIframes(html, resources);

		expect(result).toContain('class="youtube-embed-replacement"');
		expect(result).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
		expect(result).toContain('src="data:image/jpeg;base64,thumbnail_data"');
	});

	it('should extract YouTube video ID correctly from various formats', () => {
		const urls = [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://youtu.be/dQw4w9WgXcQ',
			'https://www.youtube.com/embed/dQw4w9WgXcQ',
			'https://www.youtube.com/v/dQw4w9WgXcQ',
			'./saved_resource.html?v=dQw4w9WgXcQ',
			'custom_wrapper?v=dQw4w9WgXcQ&other=param'
		];

		urls.forEach(url => {
			expect((packer as any).extractYoutubeVideoId(url)).toBe('dQw4w9WgXcQ');
		});
	});

	it('should wrap images in link structure when enableImageZoom is true', () => {
		const html = '<div><img src="test.png"></div>';
		const result = (packer as any).wrapImagesInLinks(html);
		
		expect(result).toContain('class="image-link"');
		expect(result).toContain('target="_blank"');
		expect(result).toContain('href="test.png"');
		expect(result).toContain('<img src="test.png">');
	});

	it('should NOT wrap images in links when enableImageZoom is false', () => {
		const html = '<div><img src="test.png"></div>';
		const resources: Resource[] = [{ cid: 'test.png', data: '...', mime: 'image/png', location: 'test.png' }];
		const result = packer.pack(html, '', resources, '', 'Title', false, false);
		
		expect(result).not.toContain('class="image-link"');
		expect(result).toContain('<img src="data:image/png;base64,...">');
	});

	describe('Image Zoom Link', () => {
		it('should include image-link class and structure when enableImageZoom is true', () => {
			const html = '<div><img src="image.png"></div>';
			const resources: Resource[] = [
				{
					cid: 'image.png.123@obsidian.html',
					data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BfAQJAAgt7fS4AAAAASUVORK5CYII=',
					mime: 'image/png',
					location: 'image.png'
				}
			];

			const result = packer.pack(html, '', resources, '', 'Title', false, true);

			// Check for structure
			expect(result).toContain('class="image-link"');
			expect(result).toContain('target="_blank"');
			
			// Check for resource links (both in anchor and in img)
			const expectedDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BfAQJAAgt7fS4AAAAASUVORK5CYII=';
			expect(result).toContain(`href="${expectedDataUri}"`);
			expect(result).toContain(`src="${expectedDataUri}"`);
		});
	});
});
