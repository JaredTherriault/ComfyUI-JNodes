import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

export class FormObject {

	constructor(
		name, 
		type, 
		defaultValue, 
		displayName = "", 
		tooltipText = "", 
		options = {},
		onClickResetToDefault = undefined,
		customWidget = undefined
	) {

		this._name = name;
		this._displayName = displayName;
		this._type = type;
		this._defaultValue = defaultValue;
		this._tooltipText = tooltipText;
		this._options = options;
		this._onClickResetToDefault = onClickResetToDefault;
		this._customWidget = customWidget;
	}
}

export class FormInfo {

	constructor() {

		this.itemToEdit;
		this.buttonText;
		this.onButtonClickFunction;
	}
}

export class ModelEditForm {

	constructor(imageDrawerInstance) {

        this.imageDrawerInstance = imageDrawerInstance;

		this._form;
		this._formContainer;
	}

	_getFormResponse(){

		let json = {};

		if (this._form) {

			for(const row of this._form.childNodes) {

				const label = row.childNodes[0].childNodes[0];
				let widget = row.childNodes[1].childNodes[0];

				if (widget && widget.id == "inputContainer") {
					widget = widget.childNodes[0];
				}

				if (label && widget) {

					let widgetValue = undefined;

					if (widget.getValue != undefined) {

						widgetValue = widget.getValue();

					} else if (widget.type == "checkbox") {
					
						widgetValue = widget.checked;

					} else if (widget.value != undefined) {

						widgetValue = widget.value;
					}

					if (widgetValue != undefined) {
						json[label.htmlFor] = widgetValue;
					}
				}
			}
		}

		return JSON.stringify(json);
	}

	focusFirstTextElement() {

		const textInput = this._formContainer.querySelector('input[type="text"]');
    	if (textInput) {
			textInput.focus();
		}
	}

	createForm(formObjects, formInfo) {

		// Create the form element
		this._formContainer = $el('div', 
			{
				style: {

					backgroundColor: "rgba(0,0,0,1)",
					padding: "0% 25px",
					borderStyle: "double",
					border: "deepskyblue",
					borderCollapse: "separate",
					display: "flex",
					flexDirection: "column",
					alignItems: "center"
				}
			}
		);

		const headerText = $el("h2", {

			textContent: `Editing${formInfo?.itemToEdit ? ' ' + formInfo.itemToEdit : ''}`,
		});
		this._formContainer.appendChild(headerText);

		this._form = $el("div");
		this._formContainer.appendChild(this._form);
	  
		// Loop through each FormObject and create inputs
		formObjects.forEach((formObject) => {
			// Create a label for the input
			const label = $el('label', { style: { padding: "0px 25px 0px 0px" } });
			label.setAttribute('for', formObject._name);
			label.textContent = 
				formObject._displayName ? formObject._displayName : 
				utilitiesInstance.convertToTitleCase(formObject._name);
		
			// Create the input element
			let input;
			if (formObject._customWidget) {
				// If a custom widget is provided, use it
				input = formObject._customWidget;
			} else {
				// Create a standard input element based on the type
				input = $el('input');
				input.setAttribute('type', formObject._type);

				if (formObject._type == "checkbox") {
					input.checked = formObject._defaultValue;
				} else {
					input.setAttribute('value', formObject._defaultValue);
				}

				if (formObject._type == "text") {
					input.style.width = "25vw"; 
				}
			}
		
			// Set the name and ID for the input
			input.setAttribute('name', formObject._name);
			input.setAttribute('id', formObject._name);

			if (formObject._options) {

				for (const key in formObject._options) {

					input.setAttribute(key, formObject._options[key]);
				}
			}

			let finalInputWidget = input;
			if (formObject._onClickResetToDefault) {

				const inputContainer = $el("div", {
					id: "inputContainer",
					style: {
						display: "flex"
					}
				});
				inputContainer.style.width = input.style.width;
				input.style.width = "inherit";
				const button = $el("button", { 
					onclick: () => { formObject._onClickResetToDefault(input); },
					textContent: "↩️", 
					title: "Reset to default",
					style: {
						border: "none",
						background: "transparent",
						cursor: "pointer", 
						fontSize: "1rem", 
						padding: "2px",
					}
				});
				inputContainer.appendChild(input);
				inputContainer.appendChild(button);

				finalInputWidget = inputContainer;
			}
		
			// Append the label and input to the form
			let row = $el("tr", 
				{
					style: {
						verticalAlign: "middle",
					}
				},
				[
					$el("td", { style:{ textAlign: "left" } }, [label]), 
					$el("td", { style:{ textAlign: "right" } }, [finalInputWidget])
				]
			);
			if (formObject._tooltipText) { row.title = formObject._tooltipText; }
			this._form.appendChild(row);

			if (this._form.childNodes.length % 2 == 0) {
				row.style.background = "rgba(255,255,255,0.1)"
			}
		});
	  
		// Add a submit button to the form
		if (formInfo.buttonText && formInfo.onButtonClickFunction) {
			const button = $el('button', { style: { margin: "5%" } });
			button.classList.add("JNodes-interactive-container");
			button.textContent = formInfo.buttonText;
			button.addEventListener('click', 
				async () => { formInfo.onButtonClickFunction(this._getFormResponse()); });
			this._formContainer.appendChild(button);

			this._formContainer.addEventListener("keydown", (event) => {

				if (event.key == "Enter") {

					event.preventDefault();
					button.click();
				}
			});
		}
	  
		return this._formContainer;
	}
}