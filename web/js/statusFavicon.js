import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { getValue, setValue, addJNodesSetting } from "./common/utils.js"

// Simple script that adds a custom favicon bason on whether the queue is running

// Thank you to pythongsssss 

export function setCustomFavicon(detail) {
	let favicon = "favicon";
	let queueRemaining = detail && detail.exec_info.queue_remaining;

	if (queueRemaining) {
		favicon += "-active";
	}

	let link = document.querySelector("link[rel~='icon']");
	if (!link) {
		link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
	}

	link.href = new URL(`assets/${favicon}.ico`, import.meta.url);
	//console.log(link.href);

	// Force refresh favicon
	document.title = document.title;
}

app.registerExtension({
	name: "JNodes.Status.Favicon",
	async setup() {

		const featureName = "StatusIndicators.CustomFavicon.";

		// localStorage accessors
		const getVal = (n, d) => {
			return getValue(featureName + n, d);
		};

		const saveVal = (n, v) => {
			setValue(featureName + n, v);
		};

		const labelWidget = $el("label", {
			textContent: "Use Custom Favicon (requires page reload):",
		});

		const settingWidget = $el("input", {
			type: "checkbox",
			checked: getVal("Enabled", false),
			onchange: (e) => {
				saveVal("Enabled", e.target.checked);
			},
		});

		const tooltip =
			"Whether to use custom icons. " +
			"Custom icons should be placed in 'custom_nodes\ComfyUI-JNodes\web\js\assets'. " +
			"Use 'favicon.ico' for when the wokflow is not running, " +
			"'favicon-active.ico' when it is runnning";
		addJNodesSetting(labelWidget, settingWidget, tooltip);

		if (getVal("Enabled", false)) {
			api.addEventListener("status", ({ detail }) => {
				// Set favicon on status change
				setCustomFavicon(detail);
			});

			// Set favicon on browser load
			setCustomFavicon();
		}
	},
});
