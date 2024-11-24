import { api } from "/scripts/api.js"
import { app } from "/scripts/app.js";
import { utilitiesInstance } from "../common/Utilities.js";

app.registerExtension({
	name: "JNodes.SubdirectorySelector",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {

		const nodePrototype = nodeType.prototype;

		if (nodeData.name === "JNodes_SubdirectorySelector") {

			// Create Widgets when node is created
			const onNodeCreated = nodePrototype.onNodeCreated;
			nodePrototype.onNodeCreated = function () {

				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

				const node = this;

				this.subdirectoryWidgets = [];

				const init = () => {

					this.starting_path_widget = this.widgets[0];
					this.output_path_widget = this.widgets[1];

					// Set to read-only
					this.output_path_widget.inputEl.readOnly = true;

					const oldSize = this.size;
					this.refresh_button = this.addWidget(
						"button",
						"refresh",
						null,
						() => {
							this.rebuildWidgets();
						}
					);
					const newSize = this.size;
					this.setSize(new Float32Array([oldSize[0], newSize[1]]));
				};

				init();

				this.fetchSubdirectories = async function (fromPath) {

					const response = await api.fetchApi(`/jnodes_list_immediate_subdirectories?root_directory=${fromPath}`, { method: "GET", cache: "no-store" });

					try {
						// Decode into a string
						const decodedString = await utilitiesInstance.decodeReadableStream(response.body);

						const asJson = JSON.parse(decodedString);

						if (asJson?.success && asJson?.payload) {
							return asJson.payload;
						}

					} catch (e) {
						console.error(`Could not get list of subdirectories from "${fromPath}": ${e}`)
					}

					return [];
				};

				this.addSubdirectoryWidget = function (subdirectories) {

					let newValues = ["none"];
					newValues.push(...subdirectories);

					const oldSize = this.size;
					const newWidget = this.addWidget(
						"combo",
						`subd_${this.subdirectoryWidgets.length}`,
						"none",
						(value, graphCanvas, affectedNode, pos, event) => {

							if (value !== "none") {
								node.rebuildWidgets();
							}
						},
						{ values: newValues }
					);
					const newSize = this.size;
					this.setSize(new Float32Array([oldSize[0], newSize[1]]));

					newWidget.index = this.subdirectoryWidgets.length;

					this.subdirectoryWidgets.push(newWidget);

					return newWidget;
				};

				this.getSubdirectoryStack = function () {

					let stack = [];
					for (const widget of this.subdirectoryWidgets) {
						if (widget) {

							if (widget.value == "none") {
								break;
							}

							stack.push(widget.value);
						}
					}

					return stack;
				};

				this.clearSubdirectoryWidgets = function () {

					const oldSize = this.size;
					for (let widgetIndex = this.subdirectoryWidgets.length - 1; widgetIndex >= 0; widgetIndex--) {
						const index = this.widgets.indexOf(this.subdirectoryWidgets[widgetIndex]);
						if (index > -1) {
							this.widgets.splice(index, 1);
						}
					}
					const newSize = this.size;
					this.setSize(new Float32Array([oldSize[0], newSize[1]]));

					this.subdirectoryWidgets = [];
				}

				this.buildWidgets = async function (stack) {

					const createNextWidget = async (value, stack) => {
						const subdirectories = await this.fetchSubdirectories(value);

						if (subdirectories.length > 0) {

							const newWidget = this.addSubdirectoryWidget(subdirectories);

							if (stack.length > 0) {
								const lastWidgetValue = stack[0];

								if (subdirectories.indexOf(lastWidgetValue) > -1) {
									newWidget.value = lastWidgetValue;
									stack.splice(0, 1); // Remove from top of stack

									stack = createNextWidget(`${value}/${lastWidgetValue}`, stack);
								} else { // In this case, the previous value isn't in the current subd's so the rest of the stack is invalid
									stack = [];
								}
							}
						} else { // In this case, the rest of the stack is invalid
							stack = [];
						}

						return stack;
					}

					const value = this.starting_path_widget.value;

					if (value !== '') {

						await createNextWidget(value, stack);

						let newStack = this.getSubdirectoryStack();
						newStack.unshift(value);

						const newWidgetValue = utilitiesInstance.joinPaths(newStack);
						this.output_path_widget.value = newWidgetValue;
						this.setOutputData(0, newWidgetValue);
					}
				}

				this.rebuildWidgets = function() {
					
					let stack = this.getSubdirectoryStack();

					this.clearSubdirectoryWidgets();

					this.buildWidgets(stack);
				}

				this.clone = function () {
					const cloned = nodePrototype.clone.apply(this);
					for (let inputIndex = cloned.inputs.length - 1; inputIndex >= 0; inputIndex--) {
						cloned.removeInput(inputIndex);
					} 
					return cloned;
				};

				this.onConfigure = function () {

					const stackSource = this.output_path_widget.value.replace(this.starting_path_widget.value, "");

					const stack = stackSource.split("/").filter(Boolean); // Remove empty strings

					this.buildWidgets(stack);
				}

			}
		}
	},
});