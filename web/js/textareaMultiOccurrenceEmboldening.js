// //May revisit this later, it just doesn't work as fast or as well as I want yet

// import { app } from "../../../scripts/app.js";
// import { $el } from "../../../scripts/ui.js";
// import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"

// class CustomConfigSetting extends ConfigSetting {
//     constructor(settingName, defaultValue) {
//         super("Customization.MultilineText.MultiOccurrenceEmboldening." + settingName, defaultValue);
//     }
// }

// let setting_bEnabled = new CustomConfigSetting("bEnabled", false);

// function makeMultiOccurrenceTextBold(textarea) {
// 	// Define a regex pattern (you can customize this pattern)
// 	const regexPattern = /\b\w{3,}\b/g;

// 	// Use a Map to count occurrences of matched words across all textareas
// 	const wordCountMap = new Map();

// 	// Iterate over all textareas
// 	const textareas = document.querySelectorAll('textarea');
// 	textareas.forEach(textarea => {
// 		const content = textarea.value;
// 		let match;
// 		while ((match = regexPattern.exec(content)) !== null) {
// 			const word = match[0];
// 			wordCountMap.set(word, (wordCountMap.get(word) || 0) + 1);
// 		}
// 	});

// 	// Iterate over the occurrences and make text bold if count is more than one
// 	textareas.forEach(textarea => {
// 		const content = textarea.value;
// 		for (const [word, count] of wordCountMap.entries()) {
// 			if (count > 1) {
// 				const boldWord = `<b>${word}</b>`;
// 				textarea.innerHTML = content.replace(new RegExp(`\\b${word}\\b`, 'g'), boldWord);
// 			}
// 		}
// 	});
// }

// app.registerExtension({
// 	name: "JNodes.Customization.MultilineText.MultiOccurrenceEmboldening",
// 	async loadedGraphNode(node) { // After node has been created including custom widgets

// 		console.log("MultiOccurrenceEmboldening");

// 		let bShouldSetFont = false;

// 		for (const wid in node.widgets) {
// 			if (node.widgets[wid]?.element?.type == 'textarea') {
// 				bShouldSetFont = true;
// 				const contenteditableDiv = document.createElement('div');
// 				contenteditableDiv.contentEditable = true;
// 				contenteditableDiv.classList.add('styled-textarea');
// 				contenteditableDiv.innerHTML = node.widgets[wid]?.element.value;

// 				// Replace the textarea with the contenteditable div
// 				node.widgets[wid]?.element.parentNode.replaceChild(contenteditableDiv, node.widgets[wid]?.element);
// 			}
// 		}

// 		if (bShouldSetFont && setting_bEnabled.value) {
// 			makeMultiOccurrenceTextBold();
// 		}
// 	},
// 	async setup() {

// 		{
// 			const labelWidget = $el("label", {
// 				textContent: "Multiline Multi-Occurrence Emboldening:",
// 			});

// 			const settingWidget = $el("input", {
// 				type: "checkbox",
// 				checked: setting_bEnabled.value,
// 				onchange: (e) => {
// 					setting_bEnabled.value = e.target.checked;
// 					if (setting_bEnabled.value) {
// 						makeMultiOccurrenceTextBold();
// 					}
// 				},
// 			});

// 			const tooltip =
// 				"Whether or not to embolden text with multiple occurrences in multiline textareas";
// 			addJNodesSetting(labelWidget, settingWidget, tooltip);
// 		}
// 	}
// });