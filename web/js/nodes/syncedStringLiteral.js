import { api } from "/scripts/api.js"
import { app } from "/scripts/app.js";
import { ComfyWidgets } from '/scripts/widgets.js'

// Node that allows you to tunnel connections for cleaner graphs

app.registerExtension({
	name: "JNodes.SyncedStringLiteral",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "JNodes_SyncedStringLiteral") {

			async function saveText(path, text) {
				const resp = await api.fetchApi(
					'/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path, "text": text }) });
				const asJson = await resp.json();
				return asJson?.success;
			}

			async function loadText(path, textWidget) {
				const resp = await api.fetchApi(
					'/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }) });
				const asJson = await resp.json();

				if (asJson?.success && textWidget?.element) {

					// Cache scroll position
					const scrollPosition = textWidget.element.scrollTop;

					// Set the selection range to cover the entire content of the textarea
					textWidget.element.setSelectionRange(0, textWidget.element.textLength);

					// Focus the textarea to make sure execCommand is working with the right selection
					textWidget.element.focus();

					// Using execCommand to support undo, but since it's officially 
					// 'deprecated' we need a backup solution, but it won't support undo :(
					let pasted = true;
					try {
						if (!document.execCommand("insertText", false, asJson.text)) {
							pasted = false;
						}
					} catch (e) {
						console.error("Error caught during execCommand:", e);
						pasted = false;
					}

					if (!pasted) {
						console.error(
							"execCommand unsuccessful; not supported. Setting text manually, no undo support.");
						textWidget.value = asJson.text;
					}

					// Restore scroll position, as it can change
					textWidget.element.scrollTop = scrollPosition;
				}

				return asJson?.success;
			}

			// Create Widgets when node is created
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

				this.textWidget = this.widgets[0];
				this.pathWidget = this.widgets[1];
				this.serializeToggleWidget = this.widgets[2];

				this.saveButton = this.addWidget("button", "save", null, () => {
					if (saveText(this.pathWidget.value, this.textWidget.value)) {
						this.saveButton.name = "saved!";
					}
				});

				this.loadButton = this.addWidget("button", "load", null, () => {
					if (loadText(this.pathWidget.value, this.textWidget)) {
						this.loadButton.name = "loaded!";
						this.justLoaded = true;
					}
				});

				this.textWidget.callback = () => {
					// When the textarea content changes, we want to update the save and load buttons
					// as a way to 'dirty' the widget so the user knows that changes have been made
					// since the last save or load. The 'justLoaded' bool only acts
					// as a gate to eat the first change that may be caused by the load
					// loadText > set textWidget.value > callback called > justLoaded gate

					this.saveButton.name = "save";

					if (this.justLoaded) {
						this.justLoaded = false;
					} else {
						this.loadButton.name = "load";
					}
				};

			};

			// Called after initial deserialization
			nodeType.prototype.onConfigure = function () {
				loadText(this.pathWidget?.value, this.textWidget);
			};

			nodeType.prototype.onSerialize = function (o) {
				if (this.serializeToggleWidget && this.serializeToggleWidget.value == false) {
					o.widgets_values[0] = ''; // Remove string since it should be coming from the synced txt
				}
			};
		}
	}
});