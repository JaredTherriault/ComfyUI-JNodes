import { app } from "../../../../scripts/app.js";
import { $el } from "../../../../scripts/ui.js";

export function isElementVisible(element) {
	var rect = element.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

export function getSuiteName() {
	return "JNodes"
}

export function getDarkColor() {
	return 'rgba(0,0,0,0.5)';
}

export function createDarkContainer(identifier, paddingOverride) {
	return $el("div", {
		id: identifier,
		style: {
			position: 'absolute',
			backgroundColor: getDarkColor(),
			display: 'inline-block', // Size to content, '-block' to allow vertical margin and padding
			padding: paddingOverride ? paddingOverride : '1%',
		},
	});
}

export const setElementVisibility = (element, bNewVisible) => {
	if (!element) { return; }
	element.style.display = bNewVisible ? "unset" : "none";
}

export class VideoOptions { autoplay = false; loop = true; controls = false; muted = true; };

export function getVideoElements(parentElement) {
	return parentElement ? parentElement.querySelectorAll("video") : [];
}

export function getImgElements(parentElement) {
	return parentElement ? parentElement.querySelectorAll("img") : [];
}

export function getVisualElements(parentElement) {
	return parentElement ? parentElement.querySelectorAll("video, img") : [];
}

export function getMaxZIndex(element) {
	let maxZIndex = element.style.zIndex;
	let parent = element.parentElement;
	while (parent) {
		maxZIndex = Math.max(maxZIndex, parent.style.zIndex);
		parent = parent.parentElement;
	}

	return maxZIndex;
}

export async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

export function isValid(obj) {
	return !obj || Object.keys(obj).length === 0;
}

export function addStylesheet(url) {
	if (url.endsWith(".js")) {
		url = url.substr(0, url.length - 2) + "css";
	}
	$el("link", {
		parent: document.head,
		rel: "stylesheet",
		type: "text/css",
		href: url.startsWith("http") ? url : getUrl(url),
	});
}

export function copyToClipboard(text) {
	const textArea = document.createElement("textarea");
	textArea.value = text;

	// Make the textarea hidden
	textArea.style.position = "fixed";
	textArea.style.top = 0;
	textArea.style.left = 0;
	textArea.style.opacity = 0;

	document.body.appendChild(textArea);

	textArea.select();
	document.execCommand("copy");

	document.body.removeChild(textArea);
}

export function checkIfAllImagesAreComplete(images) {
	for (const image of images) {
		if (!image.complete) {
			return false;
		}
	}
	return true; // Set to true if all images are complete
}

export async function waitForImageCompletion(newImages) {

	function removeCompleteImages(newImages) {
		return newImages.filter(image => !image.complete);
	}

	let images = removeCompleteImages(newImages);
	let bAreAllImagesComplete = false;
	while (!bAreAllImagesComplete) {
		bAreAllImagesComplete = checkIfAllImagesAreComplete(images);
		images = removeCompleteImages(images);
		if (!bAreAllImagesComplete) {
			await sleep(1); // Introduce a 1ms delay using asynchronous sleep
		}
	}
}

export async function decodeReadableStream(readableStream) {
	const reader = readableStream.getReader();
	const chunks = [];

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		chunks.push(value);
	}

	// Assuming the stream is text data
	const concatenatedChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
	let offset = 0;

	for (const chunk of chunks) {
		concatenatedChunks.set(chunk, offset);
		offset += chunk.length;
	}

	const text = new TextDecoder().decode(concatenatedChunks);
	return text;
}

export function getCurrentSecondsFromEpoch() {
	// Get the current date/time
	const currentDate = new Date();

	// Get the number of milliseconds since the epoch (January 1, 1970)
	const millisecondsSinceEpoch = currentDate.getTime();

	// Convert milliseconds to seconds
	const secondsSinceEpoch = Math.floor(millisecondsSinceEpoch / 1000);

	return secondsSinceEpoch;
}

export function getKeyList() {
	return [
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'ArrowUp',
		'Backquote',
		'Backslash',
		'Backspace',
		'BracketLeft',
		'BracketRight',
		'Comma',
		'Digit0',
		'Digit1',
		'Digit2',
		'Digit3',
		'Digit4',
		'Digit5',
		'Digit6',
		'Digit7',
		'Digit8',
		'Digit9',
		'Enter',
		'Equal',
		'Escape',
		'F1',
		'F10',
		'F11',
		'F12',
		'F13',
		'F13',
		'F14',
		'F15',
		'F16',
		'F17',
		'F18',
		'F19',
		'F2',
		'F20',
		'F21',
		'F22',
		'F23',
		'F24',
		'F25',
		'F26',
		'F27',
		'F28',
		'F29',
		'F3',
		'F30',
		'F31',
		'F32',
		'F4',
		'F5',
		'F6',
		'F7',
		'F8',
		'F9',
		'KeyA',
		'KeyB',
		'KeyC',
		'KeyD',
		'KeyE',
		'KeyF',
		'KeyG',
		'KeyH',
		'KeyI',
		'KeyJ',
		'KeyK',
		'KeyL',
		'KeyM',
		'KeyN',
		'KeyO',
		'KeyP',
		'KeyQ',
		'KeyR',
		'KeyS',
		'KeyT',
		'KeyU',
		'KeyV',
		'KeyW',
		'KeyX',
		'KeyY',
		'KeyZ',
		'Minus',
		'Numpad0',
		'Numpad1',
		'Numpad2',
		'Numpad3',
		'Numpad4',
		'Numpad5',
		'Numpad6',
		'Numpad7',
		'Numpad8',
		'Numpad9',
		'NumpadAdd',
		'NumpadComma',
		'NumpadDecimal',
		'NumpadDivide',
		'NumpadMultiply',
		'NumpadSubtract',
		'Period',
		'Quote',
		'Semicolon',
		'Slash',
		'Space'
	];
}
