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

export function simulateMouseClickAtPoint(x, y) {
	// Create the synthetic mouse event
	const event = new MouseEvent('mousedown', {
		view: window,
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y
	});

	document.dispatchEvent(event);
}

// Keyboard events

function isElementAppropriateForVideoEvent(elementUnderPointer) {
	return elementUnderPointer && 
		VideoControl.isElementVideo(elementUnderPointer) && 
		!elementUnderPointer.hasAttribute("NoVideoControl");
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
	} else if (event.key == 's') { // Toggle fullscreen
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

	if (setting_VideoPlaybackOptions.value.useWheelSeek ||
		(!setting_VideoPlaybackOptions.value.useWheelSeek && event.altKey)
	) {
		const elementUnderPointer = getElementUnderPointer();

		if (isElementAppropriateForVideoEvent(elementUnderPointer)) {
			event.preventDefault();

			VideoControl.onScrollVideo(elementUnderPointer, event, setting_VideoPlaybackOptions.value.invertWheelSeek);
		}
	}
});

document.addEventListener("drop", (event) => {

	const afterGetDropData = (key, callback) => {

		if (!callback) { return; }

		for (const item of event.dataTransfer.items) {

			if (item.type != 'text/plain') { continue; }

			item.getAsString((itemString) => {

				try {
					const asJson = JSON.parse(itemString);

					if (asJson && asJson[key]) {
						callback(asJson[key]);
					} else {
						console.log(`JNodes: Unable to parse ${key} from JSON from payload: ${itemString}`)
					}
				} catch {
					console.log(`JNodes: Unable to parse JSON from payload: ${itemString}`)
				}
			});
		}
	};

	const updateLoraNode = function(node, modelName, strengthModel, strengthClip) {
		for (let widget of node.widgets) {
			if (widget.name == "lora_name") {
				widget.value = modelName;
			}
			if (widget.name == "strength_model") {
				widget.value = strengthModel;
			}
			if (widget.name == "strength_clip") {
				widget.value = strengthClip;
			}
		}
	};

	if (event.target.data == app.canvas) {

		// Drop lora node data onto existing node to replace
		const graph = event.target.data.graph;

		if (graph) {

			const pos = app.clientPosToCanvasPos([event.clientX, event.clientY]);
			const hoveredNode = graph.getNodeOnPos(
				pos[0],
				pos[1]
			);
			
			if (hoveredNode && hoveredNode.type == "LoraLoader") {
				afterGetDropData("modelInfo", (asJson) => {

					event.preventDefault();
					event.stopPropagation();

					updateLoraNode(hoveredNode, asJson.modelName, asJson.strengthModel, asJson.strengthClip);
				});
				return;
			}
		}
 
		// Or drop in lora node data onto canvas to place
		afterGetDropData("modelInfo", (payload) => {

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
			};

			event.preventDefault();
			event.stopPropagation();

			let node = addNode("LoraLoader", [event.canvasX, event.canvasY]);
			updateLoraNode(node, payload.modelName, payload.strengthModel, payload.strengthClip);
		});

	} else if (event.target.tagName.toLowerCase() === 'textarea') { // Drop a1111 lora text or embedding text onto textarea
		afterGetDropData("modelInsertText", (payload) => {

			event.preventDefault();
			event.stopPropagation();

			utilitiesInstance.pasteToTextArea(payload, event.target, event.target.selectionStart, event.target.selectionEnd);
		});
	}
});