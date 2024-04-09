import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { ConfigSetting, addJNodesSetting } from "./common/SettingsManager.js"
import { clamp, getKeyList, pasteToTextArea } from "./common/Utilities.js"

function getModifierKeyCombos() {
	return [
		'ctrl/meta + shift +',
		'ctrl/meta + alt +',
	];
}

class CustomConfigSetting extends ConfigSetting {
	constructor(settingName, defaultValue) {
		super("MultilineText.BatchComment." + settingName, defaultValue);
	}
}

let setting_ModifierKeyCombo = new CustomConfigSetting("ModifierKeyCombo", getModifierKeyCombos()[0]);
let setting_KeyCode = new CustomConfigSetting("KeyCode", 'Slash');
let setting_Token = new CustomConfigSetting("Token", '#');

function getLineStartIndex(textarea, cursorPosition) {
	const text = textarea.value;

	// Iterate backward from the cursor position to find the beginning of the line
	let startIndex = cursorPosition;
	while (startIndex > 0 && text[startIndex - 1] !== '\n') {
		startIndex--;
	}

	return startIndex;
}

function getLineEndIndex(textarea, cursorPosition) {
	const text = textarea.value;

	// Iterate backward from the cursor position to find the beginning of the line
	let endIndex = cursorPosition;
	while (endIndex < text.length && text[endIndex] !== '\n') {
		endIndex++;
	}

	return endIndex;
}

// Insert Text Or Remove Existing Text 
// At the Beginning Of Each Line In Selected Text In Text Area
function toggleTextAtTheBeginningOfEachSelectedLine(text, textarea) {

	if (textarea.readOnly) {
		return;
	}

	if (textarea.tagName === 'TEXTAREA' || (textarea.tagName === 'INPUT' && textarea.type === 'text')) {
		const originalSelectionStart = textarea.selectionStart;
		const selectionStart = getLineStartIndex(textarea, originalSelectionStart);
		const bOriginalSelectionStartIsLineStart = selectionStart == originalSelectionStart;

		const originalSelectionEnd = textarea.selectionEnd;
		const selectionEnd = getLineEndIndex(textarea, originalSelectionEnd);

		const scrollPosition = textarea.scrollTop;

		let selectionStartOffset = 0;
		let selectionEndOffset = 0;

		// Resize selection temporarily
		textarea.selectionStart = selectionStart;
		textarea.selectionEnd = selectionEnd;

		const selectedText = textarea.value.substring(selectionStart, selectionEnd);
		const lines = selectedText.split('\n');

		// Our goal is to remove the comment text from all lines if all lines have it.
		// If any lines do not have the comment text, we want to add it to those 
		// and leave the rest alone.

		// Assume that all lines are currently commented
		// Iterate over lines in the selection until we find one that is not commented
		// If we do, set bShouldToggleOff to false and add the comment text before the line.
		let bShouldToggleOff = true;
		for (let index = 0; index < lines.length; index++) {
			if (lines[index].startsWith(text)) { continue; } // Skip lines that are already commented
			if (lines[index].trim() == "") { continue; } // Skip empty lines

			bShouldToggleOff = false;
			lines[index] = text + lines[index];

			if (!bOriginalSelectionStartIsLineStart) {
				if (index == 0) {
					selectionStartOffset += text.length;
				}
				selectionEndOffset += text.length;
			}
		}

		// Skip second loop if we don't need to toggle the comment off
		if (bShouldToggleOff) {
			for (let index = 0; index < lines.length; index++) {
				if (lines[index].startsWith(text + text)) { continue; } // Skip always-on comments ('##')
				if (lines[index].trim() == "") { continue; } // Skip empty lines

				// Guaranteed removal on each line
				lines[index] = lines[index].substring(text.length);

				if (index == 0 && !bOriginalSelectionStartIsLineStart) {
					selectionStartOffset -= text.length;
				}
				selectionEndOffset -= text.length;
			}
		}
		const modifiedText = lines.join('\n');

		pasteToTextArea(modifiedText, textarea, selectionStart, selectionEnd);

		// Restore original selection + offsets from adding/removing comment text
		textarea.selectionStart = clamp(originalSelectionStart + selectionStartOffset, 0, textarea.value.length);
		textarea.selectionEnd = clamp(originalSelectionEnd + selectionEndOffset, textarea.selectionStart, textarea.value.length);

		// Restore scroll position, as it can change when commenting or uncommenting a lot of lines
		textarea.scrollTop = scrollPosition;
	}
}

app.registerExtension({
	name: "JNodes.BatchCommenting",
	async setup() {

		{
			const labelWidget = $el("label", {
				textContent: "Batch-commenting Hotkey:",
			});

			const modifierKeysWidget = $el(
				"select",
				{
					oninput: (e) => {
						setting_ModifierKeyCombo.value = e.target.value;
						setFontOnAllTextAreas();
					},
				},
				getModifierKeyCombos().map((m) =>
					$el("option", {
						value: m,
						textContent: m,
						selected: setting_ModifierKeyCombo.value === m,
					})
				)
			);

			const keyCodeWidget = $el(
				"select",
				{
					oninput: (e) => {
						setting_KeyCode.value = e.target.value;
						setFontOnAllTextAreas();
					},
				},
				getKeyList().map((m) =>
					$el("option", {
						value: m,
						textContent: m,
						selected: setting_KeyCode.value === m,
					})
				)
			);

			const settingWidget = $el("div", {}, [modifierKeysWidget, keyCodeWidget]);

			const tooltip =
				"A key combo that, when pressed, will insert text at the beginning of the selected " +
				"lines in a multiline textarea, assuming it is the active element. If no text is " +
				"selected, the text will be inserted at the beginning of the line where the cursor " +
				"currently sits. This text will not automatically dummy out any lines, you will need " +
				"to pass the resulting text into a custom node that removes lines marked as 'commented'.";
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		{
			const labelWidget = $el("label", {
				textContent: "Batch-commenting Token:",
			});
			
			const settingWidget = $el("input", {
				value: setting_Token.value,
				onchange: function () { setting_Token.value = settingWidget.value; }
			});
			
			const tooltip = 
				"The token that will be inserted/removed when performing a batch comment operation"
			addJNodesSetting(labelWidget, settingWidget, tooltip);
		}

		window.addEventListener("keydown", function(event) {
			const { ctrlKey, metaKey, shiftKey, altKey, code } = event;
			const bUseShiftInCombo = setting_ModifierKeyCombo.value === getModifierKeyCombos()[0];
			const bModifiersPressed =
				(metaKey || ctrlKey) &&
				((bUseShiftInCombo && shiftKey) || (!bUseShiftInCombo && altKey));

			if (bModifiersPressed &&
				event.code == setting_KeyCode.value) {
				const textarea = document.activeElement;

				if (textarea.tagName === 'TEXTAREA') {
					toggleTextAtTheBeginningOfEachSelectedLine(setting_Token.value, textarea);
				}
			}
		}, true);
	}
});