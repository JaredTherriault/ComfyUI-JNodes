import { api } from "/scripts/api.js"
import { app } from "/scripts/app.js";
import { utilitiesInstance } from "../common/Utilities.js"

// Node that allows you to tunnel connections for cleaner graphs

app.registerExtension({
	name: "JNodes.SyncedStringLiteral",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "JNodes_SyncedStringLiteral") {

			const node = nodeType.prototype;

			async function saveText(path, text) {
				// Save backup
				{
					// Load the previous file (because I don't want to write a new api hook to copy)
					const resp = await api.fetchApi(
						'/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }), cache: "no-store" });
					const asJson = await resp?.json();

					// Try to save a backup as .txt.bak but don't worry about verifying it
					if (asJson?.payload) {
						const resp = await api.fetchApi(
							'/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path + ".bak", "text": asJson.payload }), cache: "no-store" });
					}
				}

				// Then save the new text
				const resp = await api.fetchApi(
					'/jnodes_save_text', { method: "POST", body: JSON.stringify({ "path": path, "text": text }), cache: "no-store" });
				const asJson = await resp?.json();
				return asJson?.success;
			}

			async function loadText(path, textWidget, bUserRequested) {
				const resp = await api.fetchApi(
					'/jnodes_load_text', { method: "POST", body: JSON.stringify({ "path": path }), cache: "no-store" });
				const asJson = await resp?.json();

				if (asJson?.success && textWidget?.element) {
					node.bIsCurrentlyAttemptingLoad = true;

					// Cache scroll position
					const scrollPosition = textWidget.element.scrollTop;

					// Only support undo when the user clicks the button manually, not during auto-load
					if (bUserRequested) {

						// Set the selection range to cover the entire content of the textarea
						textWidget.element.setSelectionRange(0, textWidget.element.textLength);

						utilitiesInstance.pasteToTextArea(asJson.payload, textWidget.element, textWidget.element.selectionStart, textWidget.element.selectionEnd);

					} else {
						textWidget.value = asJson.payload;
					}

					// Restore scroll position, as it can change
					requestAnimationFrame(() => { // Ensure the view is updated
						textWidget.element.scrollTop = scrollPosition;
					});

					node.bIsCurrentlyAttemptingLoad = false;
				}

				return asJson?.success;
			}

			// Create Widgets when node is created
			const onNodeCreated = node.onNodeCreated;
			node.onNodeCreated = function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

				this.textWidget = this.widgets[0];
				this.pathWidget = this.widgets[1];
				this.serializeToggleWidget = this.widgets[2];

				this.saveButton = this.addWidget("button", "save", null, () => {
					if (saveText(this.pathWidget.value, this.textWidget.value)) {
						this.saveButton.name = `save (last saved at ${utilitiesInstance.getCurrentTimeAsString()})`;
					}
				});

				this.loadButton = this.addWidget("button", "load", null, () => {
					if (loadText(this.pathWidget.value, this.textWidget, true)) {
						this.bWasJustLoaded = true;
						this.loadButton.name = `load (last loaded at ${utilitiesInstance.getCurrentTimeAsString()})`;

						// Clear the "dirty" state
						if (this.saveButton.name.includes("*")) {
							this.saveButton.name = this.saveButton.name.replace("*", "");
						}
					}
				});

				this.textWidget.element.addEventListener("input", async () => {
					// When the textarea content changes, we want to update the save and load buttons
					// as a way to 'dirty' the widget so the user knows that changes have been made
					// since the last save or load. The 'justLoaded' bool only acts
					// as a gate to eat the first change that may be caused by the load
					// loadText > set textWidget.value > callback called > justLoaded gate

					if (this.justLoaded) {

						this.bWasJustLoaded = false;
					} else {

						if (!this.bIsCurrentlyAttemptingLoad && !this.saveButton.name.includes("*")) {
							this.saveButton.name = this.saveButton.name + "*";
						}
					}
				});

			};

			// Called after initial deserialization
			node.onConfigure = function () {
				loadText(this.pathWidget?.value, this.textWidget, false);
			};

			node.onSerialize = function (o) {
				if (this.serializeToggleWidget && this.serializeToggleWidget.value == false) {
					o.widgets_values[0] = ''; // Remove string since it should be coming from the synced txt
				}
			};
		}
	}
});