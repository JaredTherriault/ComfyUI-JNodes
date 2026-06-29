// Creates a lightweight CSS loading spinner element (lds-ring) for use throughout the UI.

import { utilitiesInstance } from "./Utilities.js";

utilitiesInstance.addStylesheet(import.meta.url);

export function createSpinner() {
	const div = document.createElement("div");
	div.innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;
	return div.firstElementChild;
}
