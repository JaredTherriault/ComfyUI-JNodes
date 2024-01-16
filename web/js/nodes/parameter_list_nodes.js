import { app } from '/scripts/app.js'

const get_param_node_helpers = {
	name: 'JNodes.get_param_node_helpers',
	async beforeRegisterNodeDef(nodeType, nodeData, app) {

		if (nodeData.name == "JNodes_GetParameterGlobal" || nodeData.name == "JNodes_GetParameterFromList") {

			nodeType.prototype.onAdded = function() {
				if (this.widgets) {
					const pos = this.widgets.findIndex((w) => w.name === 'parameter_name')
					if (pos !== -1) { // Setup auto-title based on param_name
						const node = this;
						const widget = this.widgets[pos];
						widget.callback = function() {
							node.title = "Get " + widget.value;
						}
					}
				}
			}
		}
	}
}

app.registerExtension(get_param_node_helpers)