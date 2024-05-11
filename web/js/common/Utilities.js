import { $el } from "../../../../scripts/ui.js";

class JNodesUtilities {

	isElementInViewport(element) {
		var rect = element.getBoundingClientRect();
		return (
			rect.top >= 0 &&
			rect.left >= 0 &&
			rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
			rect.right <= (window.innerWidth || document.documentElement.clientWidth)
		);
	}

	getSuiteName() {
		return "JNodes"
	}

	getDarkColor() {
		return 'rgba(0,0,0,0.5)';
	}

	createDarkContainer(identifier, paddingOverride) {
		return $el("div", {
			id: identifier,
			style: {
				position: 'absolute',
				backgroundColor: utilitiesInstance.getDarkColor(),
				display: 'inline-block', // Size to content, '-block' to allow vertical margin and padding
				padding: paddingOverride ? paddingOverride : '1%',
			},
		});
	}

	setElementVisible(element, bNewVisible, customVisibleType = "unset") {
		if (!element) { return; }
		element.style.display = bNewVisible ? customVisibleType : "none";
	}

	getVideoElements(parentElement) {
		return parentElement ? parentElement.querySelectorAll("video") : [];
	}

	getImgElements(parentElement) {
		return parentElement ? parentElement.querySelectorAll("img") : [];
	}

	getVisualElements(parentElement) {
		return parentElement ? parentElement.querySelectorAll("video, img") : [];
	}

	pasteToTextArea(newText, textarea, selectionStart, selectionEnd) {

		// Focus the textarea to make sure execCommand is working with the right selection
		textarea.focus();

		let pasted = true;
		try {
			if (!document.execCommand("insertText", false, newText)) {
				pasted = false;
			}
		} catch (e) {
			console.error("Error caught during execCommand:", e);
			pasted = false;
		}

		if (!pasted) {
			console.error(
				"execCommand unsuccessful; not supported. Adding text manually, no undo support.");
			textarea.setRangeText(newText, selectionStart, selectionEnd, 'end');
		}
	}

	getMaxZIndex(element) {
		let maxZIndex = element.style.zIndex;
		let parent = element.parentElement;
		while (parent) {
			maxZIndex = Math.max(maxZIndex, parent.style.zIndex);
			parent = parent.parentElement;
		}

		return maxZIndex;
	}

	async asyncWait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}

	isValid(obj) {
		return !obj || Object.keys(obj).length === 0;
	}

	addStylesheet(url) {
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

	copyToClipboard(text) {
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

	checkIfAllImagesAreComplete(images) {
		for (const image of images) {
			if (!image.complete) {
				return false;
			}
		}
		return true; // Set to true if all images are complete
	}

	async waitForImageCompletion(newImages) {

		function removeCompleteImages(newImages) {
			return newImages.filter(image => !image.complete);
		}

		let images = removeCompleteImages(newImages);
		let bAreAllImagesComplete = false;
		while (!bAreAllImagesComplete) {
			bAreAllImagesComplete = this.checkIfAllImagesAreComplete(images);
			images = removeCompleteImages(images);
			if (!bAreAllImagesComplete) {
				await utilitiesInstance.asyncWait(1); // Introduce a 1ms delay using asynchronous sleep
			}
		}
	}

	async decodeReadableStream(readableStream) {
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

	getCurrentSecondsFromEpoch() {
		// Get the current date/time
		const currentDate = new Date();

		// Get the number of milliseconds since the epoch (January 1, 1970)
		const millisecondsSinceEpoch = currentDate.getTime();

		// Convert milliseconds to seconds
		const secondsSinceEpoch = Math.floor(millisecondsSinceEpoch / 1000);

		return secondsSinceEpoch;
	}

	// Function to load a file from a URL using fetch
	async loadFileFromURL(url) {
		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}

			const fileData = await response.blob(); // Get the response as a Blob

			// Now you can use the `fileData` Blob for further processing (e.g., displaying or downloading)
			console.log("File loaded successfully:", fileData);

			return fileData; // Return the loaded file data (Blob)
		} catch (error) {
			console.error("Error loading file:", error);
			throw error; // Rethrow the error for handling at the caller level
		}
	}

	SortJsonObjectByKeys(JsonObject) {
		// Convert JSON object to array of key-value pairs
		const Entries = Object.entries(JsonObject);

		// Sort the array of key-value pairs by keys (property names)
		Entries.sort((a, b) => a[0].localeCompare(b[0])); // Sort alphabetically by keys (case-sensitive)

		// Reconstruct the sorted object from the sorted array of key-value pairs
		const SortedObject = Object.fromEntries(Entries);

		return SortedObject;
	}

	getKeyList() {
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
}

export const utilitiesInstance = new JNodesUtilities();