import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"

class CustomizationConfigSetting extends ConfigSetting {
	constructor(settingName, defaultValue) {
        super("Customization." + settingName, defaultValue);
    }
}

export let setting_FontSize = new CustomizationConfigSetting("MultilineText.Font.Size", 80);
export let setting_FontFamily = new CustomizationConfigSetting("MultilineText.Font.Family", 'monospace');

function setTextAreaFontSize(textarea, size) {
	textarea.style.fontSize = size.toString() + "%";
}

function setTextAreaFontFamily(textarea, fontFamily) {
	textarea.style.fontFamily = fontFamily;
}

function setFontOnGivenTextArea(textarea) {
	setTextAreaFontSize(textarea,setting_FontSize.value);
	setTextAreaFontFamily(textarea, setting_FontFamily.value);
}

function setFontOnAllTextAreas() {
	const textareas = document.querySelectorAll('textarea');

	for (const textarea of textareas) {
		setFontOnGivenTextArea(textarea);
	}
}

app.registerExtension({
	name: "JNodes.Customization.MultilineText.Font",
	async loadedGraphNode(node) {

		for (const wid in node.widgets) {
			if (node.widgets[wid]?.element?.type == 'textarea') {
				setFontOnGivenTextArea(node.widgets[wid]?.element);
			}
		}
	},
	async setup() {

		// Font Family Setting
		{
			const supportedTypefaces =
				[
					'monospace', 'Arial, sans-serif', 'Lora',
				];

			const labelWidget = $el("label", {
				textContent: "Multiline Text Font Family:",
			});

			const settingWidget = $el(
				"select",
				{
					oninput: (e) => {
						setting_FontFamily.value = e.target.value;
						setFontOnAllTextAreas();
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
				"The font typeface to use for multiline text boxes";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		// Font Size Setting
		{
			const labelWidget = $el("label", {
				textContent: "Multiline Text Font Size (%):",
			});

			const settingWidget = $el("input", {
				type: "number",
				min: "1",
				value: setting_FontSize.value,
				oninput: (e) => {
					let value = parseFloat(e.target.value);
					if (value <= 1.0) { value = 1.0; }
					setting_FontSize.value = value;
					setFontOnAllTextAreas();
				},
			});

			const tooltip =
				"The font size (expressed as a percentage) to use for multiline text boxes";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}
	}
});