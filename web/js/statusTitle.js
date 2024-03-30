import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"

// Simple script that adds the current queue size and a percentage complete of the current job to the window title

// Thank you to pythongsssss and Kijai on discord for lighting the way toward this functionality!

const originalTitle = document.title;

app.registerExtension({
	name: "JNodes.Status.Title",
	async setup() {

		const featureName = "StatusIndicators.Title.";

		class CustomConfigSetting extends ConfigSetting {
			constructor(settingName, defaultValue) {
				super(featureName + settingName, defaultValue);
			}
		}
		
		let setting_bEnabled = new CustomConfigSetting("bEnabled", true);

		const labelWidget = $el("label", {
			textContent: "Show Progress in Title:",
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
			"Whether to show the percentage complete (%) of the current node " +
			"if it reports progress (such as KSampler)";
		addJNodesSetting(labelWidget, settingWidget, tooltip);

		function addListeners() {
			api.addEventListener("status", (e) => {
				const bIsEnabled = setting_bEnabled.value;
				if (bIsEnabled) {
					let title = originalTitle;
					let queueRemaining = e?.detail && e?.detail.exec_info.queue_remaining;

					if (queueRemaining) {
						title = `(${queueRemaining}) ${title}`;
					}

					document.title = title;
				}
			});

			api.addEventListener("progress", (e) => {
				const bIsEnabled = setting_bEnabled.value;
				if (bIsEnabled) {
					if (!e.detail) { return; }
					const { value, max } = e?.detail;
					const progress = Math.floor((value / max) * 100);
					let title = document.title;

					if (!isNaN(progress)) {
						title = `${String(progress)}% ${title.replace(/^\d+%\s/, '')}`;
					}

					document.title = title;
				}
			});
		}

		function teardown() {
			document.title = originalTitle;
		}

		if (setting_bEnabled.value) {
			addListeners();
		}
	},
});
