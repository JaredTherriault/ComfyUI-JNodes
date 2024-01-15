import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { getValue, setValue, addJNodesSetting } from "./common/utils.js"

// localStorage accessors
const getVal = (n, d) => {
	return getValue("Customization." + n, d);
};

const saveVal = (n, v) => {
	setValue("Customization." + n, v);
};

function setTextAreaFontSize(textarea, size) {
	textarea.style.fontSize = size.toString() + "%";
}

function setTextAreaFontFamily(textarea, fontFamily) {
	textarea.style.fontFamily = fontFamily;
}

function setFontOnGivenTextArea(textarea) {
	setTextAreaFontSize(textarea, getVal("MultilineText.Font.Size", 12));
	setTextAreaFontFamily(textarea, getVal("MultilineText.Font.Family", 'monospace'));
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
						saveVal("MultilineText.Font.Family", e.target.value);
						setFontOnAllTextAreas();
					},
				},
				supportedTypefaces.map((m) =>
					$el("option", {
						value: m,
						textContent: m,
						selected: getVal("MultilineText.Font.Family", 'monospace') === m,
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
				value: getVal("MultilineText.Font.Size", 80),
				oninput: (e) => {
					let value = parseFloat(e.target.value);
					if (value <= 1.0) { value = 1.0; }
					saveVal("MultilineText.Font.Size", value);
					setFontOnAllTextAreas();
				},
			});

			const tooltip =
				"The font size (expressed as a percentage) to use for multiline text boxes";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}
	}
});