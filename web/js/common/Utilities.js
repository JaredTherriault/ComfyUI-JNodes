import { $el } from "/scripts/ui.js";
import { api } from "/scripts/api.js";
import { app } from "/scripts/app.js";

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
		return "JNodes";
	}

	getCurrentTimeAsString() {
		function addZero(num) {
			return (num >= 0 && num < 10) ? "0" + num : num;
		}

		const now = new Date();
		const timeAsString = [
			addZero(now.getHours()),
			addZero(now.getMinutes()),
			addZero(now.getSeconds())
		].join(":");

		return timeAsString;
	}

	isHrefVideo(href) {
		if (typeof(href) !== "string") {
			return false;
		}
		return href.includes(".mp4") || href.includes(".webm");
	}

	getDarkColor() {
		return "rgba(0,0,0,0.5)";
	}

	getRandomColor() {
		return '#' + Math.floor(Math.random()*16777215).toString(16);
	}

	createDarkContainer(identifier = "dark-container", padding = "1%") {
		return $el("div", {
			id: identifier,
			style: {
				position: "absolute",
				backgroundColor: utilitiesInstance.getDarkColor(),
				display: "inline-block", // Size to content, "-block" to allow vertical margin and padding
				padding: padding,
			},
		});
	}

	/**
	 * Creates a slider-style toggle
	 * @param {Function} onCallback - function to call when toggled ON
	 * @param {Function} offCallback - function to call when toggled OFF
	 * @param {Object} [options] - optional settings (width, height, colors)
	 * @returns {HTMLElement} - the toggle element
	 */
	createSliderToggle(onCallback, offCallback, options = {}) {
		const width = options.width || 50;
		const height = options.height || 24;
		const onColor = options.onColor || "#4caf50";
		const offColor = options.offColor || "#ccc";
		const knobSize = options.knobSize || height - 6;

		// Container
		const container = document.createElement("div");
		container.style.position = "relative";
		container.style.width = width + "px";
		container.style.height = height + "px";
		container.style.borderRadius = height + "px";
		container.style.backgroundColor = offColor;
		container.style.cursor = "pointer";
		container.style.transition = "background-color 0.4s";

		container.bIsOn = false;

		// Knob
		const knob = document.createElement("div");
		knob.style.position = "absolute";
		knob.style.height = knobSize + "px";
		knob.style.width = knobSize + "px";
		knob.style.left = "3px";
		knob.style.top = "3px";
		knob.style.borderRadius = "50%";
		knob.style.backgroundColor = "#fff";
		knob.style.transition = "transform 0.4s";

		// Toggle handler
		container.addEventListener("click", () => {
			container.bIsOn = !container.bIsOn;
			if (container.bIsOn) {
				knob.style.transform = `translateX(${width - knobSize - 6}px)`;
				container.style.backgroundColor = onColor;
				if (typeof onCallback === "function") onCallback();
			} else {
				knob.style.transform = "translateX(0)";
				container.style.backgroundColor = offColor;
				if (typeof offCallback === "function") offCallback();
			}
		});

		container.appendChild(knob);
		return container;
	}

	addComfyNodeWidget(node, customWidget, name, type, domArgs = {}) {

		if (!node || !customWidget) { return; }

		// Create an outer container element for custom DOM widget
		var element = document.createElement("div");

		// Create a LiteGraph DOM widget that wraps our root DOM element
		var mainWidget = node.addDOMWidget(name, type, element, domArgs);

		// Create parent container for our custom DOM element
		mainWidget.parentEl = document.createElement("div");

		// Manually attach the widget’s parent container inside our root element
		element.appendChild(mainWidget.parentEl);

		// Add list widget to custom DOM's container
		mainWidget.parentEl.appendChild(customWidget);

		return mainWidget;
	}

	getTimestamp(format = 'full') {
		const now = new Date();

		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const ms = String(now.getMilliseconds()).padStart(3, '0');

		switch(format) {
			case 'date':      // Only YYYY-MM-DD
				return `${year}-${month}-${day}`;
			case 'time':      // Only HH-MM-SS-mmm
				return `${hours}-${minutes}-${seconds}-${ms}`;
			case 'datetime':  // YYYY-MM-DDTHH-MM-SS
				return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
			case 'full':      // YYYY-MM-DDTHH-MM-SS-mmm
			default:
				return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${ms}`;
		}
	}

	isLightgraphNodeOnscreen(node) {
		if (!node || !node.pos) return false;

		const canvas = app.canvas;
		const ds = canvas.ds;
		const bcr = canvas.canvas.getBoundingClientRect();

		const size = node.computeSize ? node.computeSize() : node.size;
		const titleHeight = LiteGraph.NODE_TITLE_HEIGHT || 20;

		// IMPORTANT: node.pos is center-X (in many LiteGraph forks)
		const realLeft   = node.pos[0] - size[0] / 2;
		const realTop    = node.pos[1] - titleHeight;
		const realRight  = realLeft + size[0];
		const realBottom = realTop + size[1];

		// Graph → viewport conversion
		const toScreenX = x => (x + ds.offset[0]) * ds.scale + bcr.left;
		const toScreenY = y => (y + ds.offset[1]) * ds.scale + bcr.top;

		const sx1 = toScreenX(realLeft);
		const sy1 = toScreenY(realTop);
		const sx2 = toScreenX(realRight);
		const sy2 = toScreenY(realBottom);

		// AABB intersection: returns true if ANY PART of the node is visible
		return !(
			sx2 < bcr.left ||    // completely left of view
			sx1 > bcr.right ||   // completely right of view
			sy2 < bcr.top ||     // completely above view
			sy1 > bcr.bottom     // completely below view
		);
	}

	createLongPressableButton(buttonParams, clickFunction, longPressFunction, classNames = [], longPressDurationMs = 500) {

		let timer;
		let bLongPressTriggered = false;

		const button = $el("button", buttonParams);

		for (const className of classNames) {
			button.classList.add(className);
		}

		const startTimer = () => {
			bLongPressTriggered = false; // Reset the flag
			timer = setTimeout(() => {
				longPressFunction();
				bLongPressTriggered = true; // Set the flag when long press is triggered
			}, longPressDurationMs);
		};

		const clearTimer = () => {
			clearTimeout(timer);
			timer = 0;
		};

		const inputRelease = () => {
			if (timer) {
				clearTimer();
				if (!bLongPressTriggered) {
					clickFunction();
				}
			}
		}

		button.addEventListener("pointerdown", startTimer);
		button.addEventListener("pointerup", inputRelease);
		button.addEventListener("pointerleave", clearTimer);
		button.addEventListener('touchstart', startTimer);
		button.addEventListener('touchend', inputRelease);
		button.addEventListener('touchcancel', clearTimer);

		return button;
	}

	hasAncestor(element, ancestor) {
		let currentElement = element.parentNode;
	
		while (currentElement) {
			if (currentElement == ancestor) {
				return true; 
			}
			currentElement = currentElement.parentNode;
		}
		return false; // No matching ancestor was found
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

	pasteToTextArea(newText, textarea) {

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
			textarea.setRangeText(newText, textarea.selectionStart, textarea.selectionEnd, "end");
		}
	}

	joinPaths(paths) {
		if (paths.length == 0) {
			return "";
		}

		const bStartWithSlash = paths[0].startsWith("/");

		let returnValue = paths
			.map(path => path.replace(/(^\/+|\/+$)/g, '')) // Remove leading and trailing slashes
			.filter(Boolean) // Remove empty strings
			.join('/'); // Join with single slashes

		if (bStartWithSlash) {
			returnValue = "/" + returnValue;
		}

		return returnValue;
	}

	getRandomInt(min, max) {
		// Ensure that min and max are integers
		min = Math.ceil(min);
		max = Math.floor(max);
		
		// Generate a random number between min (inclusive) and max (inclusive)
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	convertToTitleCase(input) {
		return input
			.replace(/([A-Z])/g, ' $1') // Add space before each uppercase letter
			.replace(/^./, str => str.toUpperCase()) // Capitalize the first letter
			.trim(); // Remove leading/trailing spaces
	}

	stringifyDisplayData(inDisplayData) {
		const Stringifier = (key, value) => {
			// Check if the key is "FileDimensions"
			if (key === "FileDimensions") {
				// Serialize the value of "FileDimensions" as a single line string
				return JSON.stringify(value);
			}

			if (key === "FileSize") {
				// Convert 1000000 to "1 MiB" for example
				return this.formatBytesToString(value);
			}

			if (typeof value == "number") {
				return this.toFixedWithoutTrailingZeroesAndDecimal(value, 3);
			}
			// Return the original value for other keys
			return value;
		};

		inDisplayData = this.sortJsonObjectByKeys(inDisplayData);
		return JSON.stringify(inDisplayData, Stringifier, "\t"); // Pretty formatting
	}

	removeCurlyBracesFromJsonString(jsonString) {
		return jsonString.substring(1, jsonString.length - 1);
	}

	unindentJsonString(jsonString) {
		const lines = jsonString.split("\n")
		const unindentedLines = lines.map(line => {
			// Use a regular expression to match the first tab or leading whitespace
			const unindentedLine = line.replace(/^( {4}|\t)/, '');
			return unindentedLine;
		});

		return unindentedLines.join("\n").trim();
	}

	unescapeString(str) {
		return str.replace(/\\n/g, '\n')
				.replace(/\\t/g, '\t')
				.replace(/\\r/g, '\r');
	}

	sanitizeMetadataForJson(metadata) {
		metadata = metadata.replace(/NaN/g, "0");

		return metadata;
	}

	sanitizeHTML(input) {
		// Tags that can be rendered by html viewer, others are removed
		const allowedTags = new Set(['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'br', 'span']);
		const div = document.createElement('div');
		div.innerHTML = input;
	
		function sanitizeNode(node) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				if (!allowedTags.has(node.tagName.toLowerCase())) {
					// Replace with text content or strip entirely
					const textNode = document.createTextNode(node.textContent);
					node.parentNode.replaceChild(textNode, node);
				} else {
					// Optional: strip attributes except style
					[...node.attributes].forEach(attr => {
						if (attr.name !== 'style') node.removeAttribute(attr.name);
					});
					// Recursively sanitize children
					[...node.childNodes].forEach(sanitizeNode);
				}
			} else if (node.nodeType === Node.COMMENT_NODE) {
				node.remove(); // remove comments
			}
		}
	
		[...div.childNodes].forEach(sanitizeNode);
		return div.innerHTML;
	}
	
	decodeUnicodeForeignLanguageText(str) {
		return String(str).replace(/\\u[\dA-Fa-f]{4}/g, match =>
			String.fromCharCode(parseInt(match.replace("\\u", ""), 16))
		);
	}

	parseRegexFromInputWidget(str) {
		try {
			const match = str.match(/^\/(.+)\/([gimsuy]*)$/);
			if (match) {
				const [, pattern, flags] = match;
				return new RegExp(pattern, flags);
			} else {
				// fallback: treat the whole string as pattern, no flags
				return new RegExp(str);
			}
		} catch (e) {
			console.warn("Invalid regex pattern:", str, e);
			return null;
		}
	}

	formatBytesToString(bytes, decimalPlaces = 3) {
		if (bytes === 0) return "0";
		const k = 1024;
		const dm = decimalPlaces < 0 ? 0 : decimalPlaces;
		const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		const num = bytes / Math.pow(k, i);

		let formattedNumber = new Intl.NumberFormat("en-US", {
			minimumFractionDigits: dm,
			maximumFractionDigits: dm
		}).format(num);

		return `${formattedNumber.replace(/\.?0+$/, '')} ${sizes[i]}`;
	}

	toFixedWithoutTrailingZeroesAndDecimal(value, decimalPlaces = 2) {

		// Remove trailing zeros and possibly the decimal point
		return value.toFixed(decimalPlaces).replace(/\.?0+$/, '');
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

	isInvalidObject(obj) {
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
		textArea.value = text.replace(/\\n/g, "\n") // Ensure newlines are proper
		.split("\n") // Split into lines
		.map(line => line.trim()) // Trim each line
		.join("\n") // Join them back with newlines
		.replace(/\n{3,}/g, "\n\n"); // Ensure no more than two newlines in a row

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

	simulateDrag(element, startX, startY, endX, endY) {
		// Dispatch mousedown event at the starting position
		let mousedownEvent = new MouseEvent("pointerdown", {
			bubbles: true,
			cancelable: true,
			clientX: startX,
			clientY: startY
		});
		element.dispatchEvent(mousedownEvent);
	
		// Dispatch mousemove event to simulate dragging
		let mousemoveEvent = new MouseEvent("pointermove", {
			bubbles: true,
			cancelable: true,
			clientX: endX,
			clientY: endY
		});
		document.dispatchEvent(mousemoveEvent);
	
		// Dispatch mouseup event to release the drag
		let mouseupEvent = new MouseEvent("pointerup", {
			bubbles: true,
			cancelable: true
		});
		document.dispatchEvent(mouseupEvent);
	}

	jsonStringifyWithoutCircularErrors(object) {

		function removeCircularReferences() {
			const seen = new WeakSet();
			return function (key, value) {
				if (typeof value === 'object' && value !== null) {
					if (seen.has(value)) {
						return; // Circular reference found, don't include it in the JSON
					}
					seen.add(value);
				}
				return value;
			};
		}
		return JSON.stringify(object, removeCircularReferences());
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

	sortJsonObjectByKeys(JsonObject) {
		// Convert JSON object to array of key-value pairs
		const Entries = Object.entries(JsonObject);

		// Sort the array of key-value pairs by keys (property names)
		Entries.sort((a, b) => a[0].localeCompare(b[0])); // Sort alphabetically by keys (case-sensitive)

		// Reconstruct the sorted object from the sorted array of key-value pairs
		const SortedObject = Object.fromEntries(Entries);

		return SortedObject;
	}

	async tryFreeMemory(bShowError = false, bUnloadModels = true, bFreeMemory = true) {
		const response = await api.fetchApi(`/free`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: `{"unload_models": ${bUnloadModels}, "free_memory": ${bFreeMemory}}`
						});
	
		if(bShowError && response.status != 200) {
			show_message(`Unable to free memory using "/free" api call! Status: ${response.status}`)
		}
	}

	getKeyList() {
		return [
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"Backquote",
			"Backslash",
			"Backspace",
			"BracketLeft",
			"BracketRight",
			"Comma",
			"Digit0",
			"Digit1",
			"Digit2",
			"Digit3",
			"Digit4",
			"Digit5",
			"Digit6",
			"Digit7",
			"Digit8",
			"Digit9",
			"Enter",
			"Equal",
			"Escape",
			"F1",
			"F10",
			"F11",
			"F12",
			"F13",
			"F13",
			"F14",
			"F15",
			"F16",
			"F17",
			"F18",
			"F19",
			"F2",
			"F20",
			"F21",
			"F22",
			"F23",
			"F24",
			"F25",
			"F26",
			"F27",
			"F28",
			"F29",
			"F3",
			"F30",
			"F31",
			"F32",
			"F4",
			"F5",
			"F6",
			"F7",
			"F8",
			"F9",
			"KeyA",
			"KeyB",
			"KeyC",
			"KeyD",
			"KeyE",
			"KeyF",
			"KeyG",
			"KeyH",
			"KeyI",
			"KeyJ",
			"KeyK",
			"KeyL",
			"KeyM",
			"KeyN",
			"KeyO",
			"KeyP",
			"KeyQ",
			"KeyR",
			"KeyS",
			"KeyT",
			"KeyU",
			"KeyV",
			"KeyW",
			"KeyX",
			"KeyY",
			"KeyZ",
			"Minus",
			"Numpad0",
			"Numpad1",
			"Numpad2",
			"Numpad3",
			"Numpad4",
			"Numpad5",
			"Numpad6",
			"Numpad7",
			"Numpad8",
			"Numpad9",
			"NumpadAdd",
			"NumpadComma",
			"NumpadDecimal",
			"NumpadDivide",
			"NumpadMultiply",
			"NumpadSubtract",
			"Period",
			"Quote",
			"Semicolon",
			"Slash",
			"Space"
		];
	}
}

export const utilitiesInstance = new JNodesUtilities();