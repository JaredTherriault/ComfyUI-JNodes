import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"

class CustomizationConfigSetting extends ConfigSetting {
	constructor(settingName, defaultValue) {
        super("Customization." + settingName, defaultValue);
    }
}

export let setting_bEnabled = new CustomizationConfigSetting("MultilineText.Font.Enabled", false);
export let setting_FontSize = new CustomizationConfigSetting("MultilineText.Font.Size", 80);
export let setting_FontFamily = new CustomizationConfigSetting("MultilineText.Font.Family", 'monospace');

function setFontSize(text, size) {
	text.style.fontSize = size.toString() + "%";
}

function setFontFamily(text, fontFamily) {
	text.style.fontFamily = fontFamily;
}

function setFontOnGivenElement(el, bForced = false) {
    if (!el || !(el instanceof Element)) return;

    if (!bForced && el.dataset?.jnodesFontApplied) return;
    el.dataset.jnodesFontApplied = "true";

    setFontSize(el, setting_FontSize.value);
    setFontFamily(el, setting_FontFamily.value);
}

function setFontOnAllTexts(bForced = false) {
	loopOverCollection(document.children, bForced);
}

function loopOverCollection(collection, bForced = false) {

	if (!collection) { return; }

	for (const node of collection) {

		// Direct textarea
		if (node.tagName === "TEXTAREA" ||
			(node.tagName === "INPUT" && node.type === "text")) {
			setFontOnGivenElement(node, bForced);
		}

		// Any text inside newly added subtree
		const elements = node.querySelectorAll?.(
			'textarea, input[type="text"]'
		);
		if (elements?.length) {
			for (const element of elements) {
				setFontOnGivenElement(element, bForced);
			}
		}

		loopOverCollection(node.children, bForced);
	}
}

app.registerExtension({
	name: "JNodes.Customization.MultilineText.Font",
	async loadedGraphNode(node) {

		if (!setting_bEnabled.value) { return; }

		for (const wid in node.widgets) {
			const element = node.widgets[wid]?.element;

			if (!element) { continue; }

			if (element.tagName === "TEXTAREA" ||
				(element.tagName === "INPUT" && element.type === "text")) {
				setFontOnGivenElement(node);
			}
		}
	},
	async setup() {

		// Font Control Enabled
		{
			const labelWidget = $el("label", {
				textContent: "Text Font Control Enabled (requires page reload):",
			});

			const settingWidget = $el(
				"input",
				{
					type: "checkbox",
					checked: setting_bEnabled.value,
					oninput: (e) => {
						setting_bEnabled.value = e.target.checked;
					},
				},
			);

			const tooltip =
				"Whether to affect font typeface and size used in text boxes. " + 
				"Requires page reload.";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		// Font Family Setting
		{
			const supportedTypefaces =
				[
					'monospace', 'Arial, sans-serif', 'Lora',
				];

			const labelWidget = $el("label", {
				textContent: "Text Font Family:",
			});

			const settingWidget = $el(
				"select",
				{
					oninput: (e) => {
						setting_FontFamily.value = e.target.value;
						setFontOnAllTexts(true /* bForced */);
					},
				},
				supportedTypefaces.map((m) =>
					$el("option", {
						value: m,
						textContent: m,
						selected: setting_FontFamily.value === m,
					})
				)
			);

			const tooltip =
				"The font typeface to use for text boxes";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		// Font Size Setting
		{
			const labelWidget = $el("label", {
				textContent: "Text Font Size (%):",
			});

			const settingWidget = $el("input", {
				type: "number",
				min: "1",
				value: setting_FontSize.value,
				oninput: (e) => {
					let value = e.target.valueAsNumber;
					if (value <= 1.0) { value = 1.0; }
					setting_FontSize.value = value;
					setFontOnAllTexts(true /* bForced */);
				},
			});

			const tooltip =
				"The font size (expressed as a percentage) to use for text boxes";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		function observeNewTextAreas() {

			const observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {

					loopOverCollection(mutation.addedNodes);
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		}

		if (!setting_bEnabled.value) { return; }

		observeNewTextAreas();
	}
});