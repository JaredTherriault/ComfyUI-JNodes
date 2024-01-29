import { api } from "../../../../scripts/api.js";
import { app } from "../../../../scripts/app.js";
import { $el } from "../../../../scripts/ui.js";

var underButtonContent;


// Mouse tracking

let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener("mousemove", (event) => {
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
});

export function getLastMousePosition() {
	return [lastMouseX, lastMouseY];
}

export function getSuiteName() {
	return "JNodes"
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

export function getUrl(path, baseUrl) {
	if (baseUrl) {
		return new URL(path, baseUrl).toString();
	} else {
		return new URL("../" + path, import.meta.url).toString();
	}
}

export async function loadImage(url) {
	return new Promise((res, rej) => {
		const img = new Image();
		img.onload = res;
		img.onerror = rej;
		img.src = url;
	});
}

// localStorage accessors
export function getValue(name, defaultValue) {
	const val = localStorage.getItem("JNodes.Settings." + name);
	//console.log("localstorage (" + name + " : " + val + ")");
	if (val !== null) {
		try { // Try to parse the value automatically, and if we can't then just return the string
			return JSON.parse(val);
		} catch (error) {
			return val;
		}
	}
	//console.log("return defaultValue");
	return defaultValue;
};

export function setValue(name, val) {
	localStorage.setItem("JNodes.Settings." + name, val);
};

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

export function setSearchTermsOnElement(element, searchTerms) {
	element.searchTerms = searchTerms;
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

export function isEmptyObject(obj) {
  return Object.keys(obj).length === 0;
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

export function checkIfAllImagesAreComplete(newImages) {
	for (const image of newImages) {
		if (!image.complete) {
			return false;
		}
	}
	return true; // Set to true if all images are complete
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

function createExpandableArea() {

	const nameWidget = $el("label", {
		textContent: "JNodes Settings ",
	});

	const toggleButton = document.createElement('button');
	toggleButton.textContent = '►';
	toggleButton.classList.add('toggle-btn');

	underButtonContent = $el('div', {
		style: {
			id: 'under-button-content',
			textAlign: 'center',
			margin: 'auto',
			width: '100%',
			display: 'table',
			visibility: 'collapse'
		}
	});

	// Add click event listener to toggle button
	toggleButton.addEventListener('click', function() {
		const bIsCollapsed = underButtonContent.style.visibility === 'collapse';

		// Toggle content display
		underButtonContent.style.visibility =
			bIsCollapsed ? 'visible' : 'collapse';

		// Toggle button arrow orientation
		toggleButton.textContent = bIsCollapsed ? '▼' : '►';
	});

	app.ui.settings.addSetting({
		id: "JNodes.SettingsContainer",
		name: "JNodes Settings Container",
		type: () => {
			return $el("tr", {
				style: {
					width: "100%",
				}
			}, [
				$el("td", {
					colSpan: '2',
				}, [
					$el("div", {
						style: {
							textAlign: 'center',
							margin: 'auto',
							width: '100%',
						},
					}, [nameWidget, toggleButton]), underButtonContent
				]),
			]);
		},
	});
}

export function addJNodesSetting(nameWidget, settingWidget, tooltip) {
	if (!underButtonContent) {
		createExpandableArea();
	}

	function sortTable() {
		const rows = Array.from(underButtonContent.children);

		// Sort the rows based on the text in the left cell
		rows.sort((a, b) => {
			const textA = a.children[0].textContent.trim().toLowerCase();
			const textB = b.children[0].textContent.trim().toLowerCase();
			return textA.localeCompare(textB);
		});

		underButtonContent.innerHTML = '';

		// Update the table with the sorted rows
		rows.forEach(row => underButtonContent.appendChild(row));
	}

	let title = tooltip ? tooltip.toString() : '';
	nameWidget.title = nameWidget.title ? nameWidget.title : title;
	settingWidget.title = settingWidget.title ? settingWidget.title : title;

	underButtonContent.appendChild(
		$el("tr", [
			$el("td", {
				style: {
					verticalAlign: "middle",
				}
			}, [
				nameWidget ? nameWidget : $el("div")
			]),
			$el("td", {
				style: {
					verticalAlign: "middle",
					textAlign: "left",
				}
			}, [
				settingWidget ? settingWidget : $el("div")
			])
		])
	);

	sortTable();
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
