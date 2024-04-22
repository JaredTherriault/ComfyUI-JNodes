import { app } from '/scripts/app.js'

const get_metadata_node_helpers = {
	name: 'JNodes.get_metadata_node_helpers',
	async beforeRegisterNodeDef(nodeType, nodeData, app) {

		if (nodeData.name == "JNodes_AddOrSetMetaDataKey") {

			nodeType.prototype.onAdded = function() {
				if (this.widgets) {
					const pos = this.widgets.findIndex((w) => w.name === 'key')
					if (pos !== -1) { // Setup auto-title based on param_name
						const node = this;
						const widget = this.widgets[pos];
						widget.callback = function() {
							node.title = "Add " + widget.value;
						}
					}
				}
			}
		}
		else if (nodeData.name == "JNodes_RemoveMetaDataKey") {

			nodeType.prototype.onAdded = function() {
				if (this.widgets) {
					const pos = this.widgets.findIndex((w) => w.name === 'key')
					if (pos !== -1) { // Setup auto-title based on param_name
						const node = this;
						const widget = this.widgets[pos];
						widget.callback = function() {
							node.title = "Remove " + widget.value;
						}
					}
				}
			}
		}
	}
}

app.registerExtension(get_metadata_node_helpers)