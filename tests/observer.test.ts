import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RenderingObserver } from "../src/exporter/observer";

describe("RenderingObserver", () => {
	let observer: RenderingObserver;
	let container: HTMLElement;

	beforeEach(() => {
		observer = new RenderingObserver();
		container = document.createElement("div");
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("should resolve immediately if no mermaid diagrams are present", async () => {
		const promise = observer.waitForRendering(container, 1000);
		
		// Advance past initial delay
		vi.advanceTimersByTime(50);
		
		await expect(promise).resolves.toBeUndefined();
	});

	it("should resolve immediately if all mermaid diagrams are already processed", async () => {
		const mermaid = document.createElement("div");
		mermaid.classList.add("mermaid");
		mermaid.setAttribute("data-processed", "true");
		mermaid.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		container.appendChild(mermaid);

		const promise = observer.waitForRendering(container, 1000);
		
		// Advance past initial delay
		vi.advanceTimersByTime(50);

		await expect(promise).resolves.toBeUndefined();
	});

	it("should NOT resolve if data-processed is present but svg is missing", async () => {
		const mermaid = document.createElement("div");
		mermaid.classList.add("mermaid");
		mermaid.setAttribute("data-processed", "true");
		// No svg child
		container.appendChild(mermaid);

		// Mock MutationObserver
		let mutationCallback: any;
		const observeMock = vi.fn();
		const disconnectMock = vi.fn();
		
		const MutationObserverMock = vi.fn().mockImplementation(function (callback) {
			mutationCallback = callback;
			return {
				observe: observeMock,
				disconnect: disconnectMock,
			};
		});
		vi.stubGlobal("MutationObserver", MutationObserverMock);

		const promise = observer.waitForRendering(container, 1000);

		// Advance past initial delay
		vi.advanceTimersByTime(50);
		// Flush microtasks to allow the code after await to run
		await Promise.resolve();

		expect(MutationObserverMock).toHaveBeenCalled();
		
		// Now add the svg
		mermaid.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		mutationCallback([], {} as any);

		await expect(promise).resolves.toBeUndefined();
		expect(disconnectMock).toHaveBeenCalled();
	});

	it("should wait for MutationObserver if mermaid diagrams are not processed", async () => {
		const mermaid = document.createElement("div");
		mermaid.classList.add("mermaid");
		container.appendChild(mermaid);

		// Mock MutationObserver
		let mutationCallback: any;
		const observeMock = vi.fn();
		const disconnectMock = vi.fn();
		
		const MutationObserverMock = vi.fn().mockImplementation(function (callback) {
			mutationCallback = callback;
			return {
				observe: observeMock,
				disconnect: disconnectMock,
			};
		});
		vi.stubGlobal("MutationObserver", MutationObserverMock);

		const promise = observer.waitForRendering(container, 1000);

		// Advance past initial delay
		vi.advanceTimersByTime(50);
		await Promise.resolve();

		expect(MutationObserverMock).toHaveBeenCalled();
		expect(observeMock).toHaveBeenCalledWith(container, expect.any(Object));

		// Simulate mermaid processing
		mermaid.setAttribute("data-processed", "true");
		mermaid.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		
		// Trigger mutation callback
		mutationCallback([], {} as any);

		await expect(promise).resolves.toBeUndefined();
		expect(disconnectMock).toHaveBeenCalled();
	});

	it("should resolve on timeout", async () => {
		const mermaid = document.createElement("div");
		mermaid.classList.add("mermaid");
		container.appendChild(mermaid);

		const promise = observer.waitForRendering(container, 1000);

		// Advance past initial delay
		vi.advanceTimersByTime(50);
		await Promise.resolve();

		// Fast-forward time for the timeout
		vi.advanceTimersByTime(1000);

		await expect(promise).resolves.toBeUndefined();
	});

	it("should wait until ALL mermaid diagrams are processed", async () => {
		const mermaid1 = document.createElement("div");
		mermaid1.classList.add("mermaid");
		container.appendChild(mermaid1);

		const mermaid2 = document.createElement("div");
		mermaid2.classList.add("mermaid");
		container.appendChild(mermaid2);

		// Mock MutationObserver
		let mutationCallback: any;
		const observeMock = vi.fn();
		const disconnectMock = vi.fn();
		
		const MutationObserverMock = vi.fn().mockImplementation(function (callback) {
			mutationCallback = callback;
			return {
				observe: observeMock,
				disconnect: disconnectMock,
			};
		});
		vi.stubGlobal("MutationObserver", MutationObserverMock);

		const promise = observer.waitForRendering(container, 1000);

		// Advance past initial delay
		vi.advanceTimersByTime(50);
		await Promise.resolve();

		// Process only one
		mermaid1.setAttribute("data-processed", "true");
		mermaid1.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		mutationCallback([], {} as any);

		// Should not have resolved yet
		expect(disconnectMock).not.toHaveBeenCalled();

		// Process the second one
		mermaid2.setAttribute("data-processed", "true");
		mermaid2.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		mutationCallback([], {} as any);

		await expect(promise).resolves.toBeUndefined();
		expect(disconnectMock).toHaveBeenCalled();
	});

	it("should wait for unrendered mermaid blocks", async () => {
		const pre = document.createElement("pre");
		pre.classList.add("language-mermaid");
		container.appendChild(pre);

		// Mock MutationObserver
		let mutationCallback: any;
		const MutationObserverMock = vi.fn().mockImplementation(function (callback) {
			mutationCallback = callback;
			return {
				observe: vi.fn(),
				disconnect: vi.fn(),
			};
		});
		vi.stubGlobal("MutationObserver", MutationObserverMock);

		const promise = observer.waitForRendering(container, 1000);

		// Advance past initial delay
		vi.advanceTimersByTime(50);
		await Promise.resolve();

		expect(MutationObserverMock).toHaveBeenCalled();

		// Simulate conversion to processed mermaid
		const mermaid = document.createElement("div");
		mermaid.classList.add("mermaid");
		mermaid.setAttribute("data-processed", "true");
		mermaid.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
		pre.appendChild(mermaid);
		
		mutationCallback([], {} as any);

		await expect(promise).resolves.toBeUndefined();
	});
});
