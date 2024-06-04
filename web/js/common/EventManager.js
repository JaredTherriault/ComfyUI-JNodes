import { app } from "../../../../scripts/app.js";
import { utilitiesInstance } from "./Utilities.js";

import { setting_VideoPlaybackOptions } from "../common/SettingsManager.js";
import * as VideoControl from './VideoControl.js';

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

export function isPointerDown() {
	return app?.canvas?.pointer_is_down;
}

export function getElementUnderPointer() {
	const mousePos = getLastMousePosition();
	return document.elementFromPoint(mousePos[0], mousePos[1]);
}

// Keyboard events

function isElementAppropriateForVideoEvent(elementUnderPointer) {
	return elementUnderPointer && VideoControl.isElementVideo(elementUnderPointer);
}

// Keyboard events
document.addEventListener("keydown", async (event) => {

	// Video shortcuts
	// note that elementUnderPointer will always be the video element itself, not the container

	if (event.key == "l") { // Seek forward
		const delta = 1;
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.seekVideo(elementUnderPointer, delta);
		}
	} else if (event.key == "j") { // See backward
		const delta = -1;
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.seekVideo(elementUnderPointer, delta);
		}
	} else if (event.key == "k") { // Pause/play
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			await VideoControl.toggleVideoPlayback(elementUnderPointer);
		}
	} else if (event.key == "m") { // Toggle mute
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.toggleVideoMute(elementUnderPointer);
		}
	} else if (event.key == 'f') { // Toggle fullscreen
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.toggleVideoFullscreen(elementUnderPointer);
		}
	} else if (event.key == ',') { // Decrease playback rate
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.setVideoPlaybackRate(elementUnderPointer, elementUnderPointer.playbackRate - 0.05);
		}
	} else if (event.key == '.') { // Increase playback rate
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.setVideoPlaybackRate(elementUnderPointer, elementUnderPointer.playbackRate + 0.05);
		}
	}
});

// Scroll wheel

document.addEventListener('wheel', (event) => {

	if (setting_VideoPlaybackOptions.value.useWheelSeek) {
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.onScrollVideo(elementUnderPointer, event, setting_VideoPlaybackOptions.value.invertWheelSeek);
		}
	}
});

document.addEventListener("drop", (event) => {

	if (event.target.data == app.canvas) { // Drop in lora node onto canvas
		for (const item of event.dataTransfer.items) {

			if (item.type != 'text/plain') { continue; }

			item.getAsString(function (itemString) {
				if (itemString && itemString.includes("loraNodeName=")) {
					function addNode(name, coordinates, options) {
						options = { select: true, shiftY: 0, ...(options || {}) };
						const node = LiteGraph.createNode(name);
						app.graph.add(node);
						node.pos = [
							coordinates[0] - node.size[0] / 2, coordinates[1] + options.shiftY,
						];
						if (options.select) {
							app.canvas.selectNode(node, false);
						}
						return node;
					}

					event.preventDefault();
					event.stopPropagation();

					let node = addNode("LoraLoader", [event.canvasX, event.canvasY]);
					for (let widget of node.widgets) {
						if (widget.name == "lora_name") {
							widget.value = itemString.split("=")[1];
						}
					}
				}
			});
		}
	} else if (event.target.tagName.toLowerCase() === 'textarea') { // Drop a1111 lora text or embedding text onto textarea
		for (const item of event.dataTransfer.items) {
			item.getAsString(function (itemString) {
				if (itemString && itemString.includes("modelInsertText=")) {
					event.preventDefault();
					event.stopPropagation();

					utilitiesInstance.pasteToTextArea(itemString.split("=")[1], event.target, event.target.selectionStart, event.target.selectionEnd);
				}
			})
		}
	}
});