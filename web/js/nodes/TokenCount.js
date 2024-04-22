import { app } from "/scripts/app.js";
import { ComfyWidgets } from "/scripts/widgets.js";

// Displays input text on a node

app.registerExtension({
	name: "JNodes_TokenCounter",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "JNodes_TokenCounter") {
			function populate(text) {
				// Find and update existing widget, if it exists
				if (this.showValueWidget) {
					this.showValueWidget.value = text;
				}
			}

			// Create Widget when node is created
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function() {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
				this.showValueWidget = ComfyWidgets["STRING"](this, "token count", ["STRING", { multiline: true }], app).widget;
				this.showValueWidget.inputEl.readOnly = true;
				this.showValueWidget.inputEl.style.opacity = 0.6;

				requestAnimationFrame(() => {
					const sz = this.computeSize();
					if (sz[0] < this.size[0]) {
						sz[0] = this.size[0];
					}
					if (sz[1] < this.size[1]) {
						sz[1] = this.size[1];
					}
					this.onResize?.(sz);
					app.graph.setDirtyCanvas(true, false);
				});
			};

			// When the node is executed we will be sent the input text, display this in the widget
			const onExecuted = nodeType.prototype.onExecuted;
			nodeType.prototype.onExecuted = function(message) {
				onExecuted?.apply(this, arguments);
				populate.call(this, message.text);
			};
		}
	},
});
