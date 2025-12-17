import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"

// Simple script that prints performance metrics to the web console after a node is executed.

app.registerExtension({
	name: "JNodes.Graph.NodePerformance",
	async setup() {

		const featureName = "Graph.NodePerformance.";

		class CustomConfigSetting extends ConfigSetting {
			constructor(settingName, defaultValue) {
				super(featureName + settingName, defaultValue);
			}
		}
		
		let setting_bEnabled = new CustomConfigSetting("bEnabled", true);

		const labelWidget = $el("label", {
			textContent: "Report Node Performance in Web Console:",
		});

		const settingWidget = $el("input", {
			type: "checkbox",
			checked: setting_bEnabled.value,
			onchange: (e) => {
				setting_bEnabled.value = e.target.checked;

				if (e.target.checked) {
					addListeners();
				} else {
					teardown();
				}
			},
		});

		const tooltip =
			"If enabled, a report about node performance (timing, etc.) " +
			"will be printed to the web console.";
		addJNodesSetting(labelWidget, settingWidget, tooltip);

		// --- Timing state ---
		let lastNodeId = null;
		let lastStartTime = 0.0;
		let totalTime = 0.0;

		function NodeTypeFromId( nodeId ) {
			const node = app.graph.getNodeById(nodeId);
			if (!node) {
				console.error(`NodeTypeFromId: Could not get node for id: ${nodeId}.`)
				return "";
			}
			const type = node.type;
			return type;
		}

		function NodeTitleFromId( nodeId ) {
			const node = app.graph.getNodeById(nodeId);
			if (!node) {
				console.error(`NodeTypeFromId: Could not get node for id: ${nodeId}.`)
				return "";
			}
			const title = node.getTitle();
			return title;
		}

		function calculateAndLog(now) {

			// If we already have a previous node, measure how long it took
			if (lastNodeId && lastStartTime > 0.0) {

				const split = lastNodeId.split(":");

				let bIsSubgraphNode = false;

				if (split && split.length > 1) {
					bIsSubgraphNode = true;
				}

				const elapsed = now - lastStartTime;
				totalTime += elapsed;
				const elapsedSeconds = elapsed / 1000.0;

				let idToUse = lastNodeId;

				if (bIsSubgraphNode) {
					idToUse = split[0];
				}

				const nodetitle = NodeTitleFromId(idToUse);
				const nodeType = NodeTypeFromId(idToUse);
				console.info(
					`[NodePerf] ✅ Node ${nodetitle} (${nodeType})(${idToUse}) completed in ${elapsedSeconds.toFixed(2)} s)`
				);
			}
		}

		function addListeners() {

			api.addEventListener("executing", async ({ detail }) => {
					if (!setting_bEnabled.value) return;

					const node = detail;

					const now = performance.now();

					calculateAndLog(now);

					// Start timing the current node
					lastNodeId = node;
					lastStartTime = now;
				});

			api.addEventListener("executed", async ({ detail }) => {
					if (!setting_bEnabled.value) return;

					const now = performance.now();

					calculateAndLog(now);

					const totalSeconds = totalTime / 1000.0;
					console.info(
						`[NodePerf] ✅ Prompt execution completed in ${totalSeconds.toFixed(2)} s)`
					);
			
					clearCachedValues();
				});
		}

		function clearCachedValues() {
			lastNodeId = null;
			lastStartTime = 0.0;
			totalTime = 0.0;
		}

		function teardown() {
			clearCachedValues();
		}

		if (setting_bEnabled.value) {
			addListeners();
		}
	},
});
