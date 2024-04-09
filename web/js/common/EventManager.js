import { app } from "../../../../scripts/app.js";

import { pasteToTextArea } from "./Utilities.js";

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

					pasteToTextArea(itemString.split("=")[1], event.target, event.target.selectionStart, event.target.selectionEnd);
				}
			})
		}
	}
});