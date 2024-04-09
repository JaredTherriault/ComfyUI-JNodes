import { api } from "/scripts/api.js"
import { app } from "/scripts/app.js";
import { ComfyWidgets } from '/scripts/widgets.js'

// Node that allows you to tunnel connections for cleaner graphs

app.registerExtension({
	name: "JNodes.SyncedStringLiteral",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "JNodes_SyncedStringLiteral") {

			async function saveText(path, text) {
				// Save backup
				{
					// Load the previous file (because I don't want to write a new api hook to copy)
					const resp = await api.fetchApi(
						'/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }) });
					const asJson = await resp?.json();

					// Try to save a backup as .txt.bak but don't worry about verifying it
					if (asJson?.text) {
						const resp = await api.fetchApi(
							'/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path + ".bak", "text": asJson.text }) });
					}
				}

				// Then save the new text
				const resp = await api.fetchApi(
					'/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path, "text": text }) });
				const asJson = await resp?.json();
				return asJson?.success;
			}

			async function loadText(path, textWidget, bUserRequested) {
				const resp = await api.fetchApi(
					'/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }) });
				const asJson = await resp?.json();

				if (asJson?.success && textWidget?.element) {

					// Cache scroll position
					const scrollPosition = textWidget.element.scrollTop;

					// Only support undo when the user clicks the button manually, not during auto-load
					if (bUserRequested) {

						// Set the selection range to cover the entire content of the textarea
						textWidget.element.setSelectionRange(0, textWidget.element.textLength);

						pasteToTextArea(asJson.text, textWidget.element, textWidget.element.selectionStart, textWidget.element.selectionEnd);

					} else {
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
					if (loadText(this.pathWidget.value, this.textWidget, true)) {
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
				loadText(this.pathWidget?.value, this.textWidget, false);
			};

			nodeType.prototype.onSerialize = function (o) {
				if (this.serializeToggleWidget && this.serializeToggleWidget.value == false) {
					o.widgets_values[0] = ''; // Remove string since it should be coming from the synced txt
				}
			};
		}
	}
});