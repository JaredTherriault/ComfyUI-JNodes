import { api } from "../../../../scripts/api.js";
import { app } from "../../../../scripts/app.js";
import { $el } from "../../../../scripts/ui.js";

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

document.addEventListener("drop", (event) => {

	if (event.target.data == app.canvas) {
		for (const item of event.dataTransfer.items) {

			if (item.type != 'text/plain') { continue; }

			item.getAsString(function (itemString) {
				if (itemString && itemString.includes("loras=")) {
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
	}
});