
export function createModal(modalContent, newFocus) {
	if (!modalContent) { return; }
	// Create a modal container
	const modalContainer = document.createElement("div");
	modalContainer.style.display = "none";
	modalContainer.style.position = "fixed";
	modalContainer.style.zIndex = "10000";
	modalContainer.style.left = "0";
	modalContainer.style.top = "0";
	modalContainer.style.width = "100%";
	modalContainer.style.height = "100%";
	modalContainer.style.overflow = "auto";
	modalContainer.style.backgroundColor = "rgba(0,0,0,0.7)";

	// Create close button
	const closeButton = document.createElement("span");
	modalContainer.style.zIndex = "10001";
	closeButton.innerHTML = "&times;";
	closeButton.style.color = "#aaa";
	closeButton.style.float = "right";
	closeButton.style.fontSize = "28px";
	closeButton.style.fontWeight = "bold";
	closeButton.style.cursor = "pointer";

	// Append modal content to modal container
	modalContainer.appendChild(modalContent);

	// Append close button to modal container
	modalContainer.appendChild(closeButton);

	// Append modal container to the document body
	document.body.appendChild(modalContainer);

	// Function to open the modal
	function openModal() {
		modalContainer.style.display = "block";
	}

	// Function to close the modal
	function closeModal() {
		modalContainer.parentNode.removeChild(modalContainer);
	}

	openModal();

	// Event listener for closing the modal
	closeButton.addEventListener("click", closeModal);
	modalContainer.addEventListener("click", closeModal);

	// Add event listener to close modal on "Escape" key press
	modalContainer.addEventListener("keydown", function(event) {
		if (event.key === "Escape") {
			closeModal();
		}
	});

	if (newFocus) {
		newFocus.focus();
	} else {
		// Remove focus from the currently focused element
		document.activeElement.blur();
	}

	return modalContainer;
}