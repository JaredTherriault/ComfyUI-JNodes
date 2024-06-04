
export function createModal(modalContent,) {
	if (!modalContent) { return; }

	// Zoom and Pan functionality
	let scale = 1;
	let translateX = -50; // Initial translate X percentage
	let translateY = -50; // Initial translate Y percentage
	let bIsPanningActive = false;
	let bHasPanned = false;
	let startX = 0;
	let startY = 0;

	// Set modal content style
	modalContent.style.position = 'absolute';
	modalContent.style.display = "inline-block";
	modalContent.style.left = "50%";
	modalContent.style.top = "50%";
	modalContent.style.transform = "translate(-50%, -50%)";
	modalContent.style.maxWidth = "99%";
	modalContent.style.maxHeight = "99%";
	modalContent.style.overflow = "hidden";

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

	modalContent.draggable = false;
	modalContainer.addEventListener("dragstart", (event) => { event.preventDefault(); });
	modalContainer.draggable = false;

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
		document.removeEventListener("keydown", handlekeyDown);
	}

	openModal();

	// Event listener for closing the modal
	closeButton.addEventListener("click", closeModal);

	// Add key event listeners
	function handlekeyDown(event) {
		if (event.key === "Escape") {
			event.preventDefault();
			closeModal();
		}
	}
	document.addEventListener("keydown", handlekeyDown);

	function zoom(event) {
		event.preventDefault(); // Prevent the default scroll behavior

		const zoomSpeed = 0.1;
		const delta = event.deltaY;

		// Adjust the scale based on scroll direction
		if (delta > 0) {
			scale = Math.max(0.1, scale - zoomSpeed); // Zoom out
		} else {
			scale = Math.min(5, scale + zoomSpeed); // Zoom in
		}

		// Apply the scale and initial translate to the modal content
		modalContent.style.transform = `translate(${translateX}%, ${translateY}%) scale(${scale})`;
	}

	function startPan(event) {
		bIsPanningActive = true;
		modalContainer.style.cursor = "grabbing";
		startX = event.clientX;
		startY = event.clientY;
	}

	function pan(event) {
		if (!bIsPanningActive) return;

		const dx = event.clientX - startX;
		const dy = event.clientY - startY;

		// Adjust translate values
		translateX += (dx / modalContainer.clientWidth) * 100;
		translateY += (dy / modalContainer.clientHeight) * 100;

		// Update start positions for next movement
		startX = event.clientX;
		startY = event.clientY;

		// Apply the transformation
		modalContent.style.transform = `translate(${translateX}%, ${translateY}%) scale(${scale})`;

		bHasPanned = true;
	}

	function endPan() {
		bIsPanningActive = false;
		modalContainer.style.cursor = "grab";
	}

	function onMouseUp() {
		endPan();

		if (!bHasPanned) {
			closeModal();
		}

		bHasPanned = false;
	}

	modalContainer.addEventListener("wheel", zoom);
	modalContainer.addEventListener("mousedown", startPan);
	modalContainer.addEventListener("mousemove", pan);
	modalContainer.addEventListener("mouseup", onMouseUp);
	modalContainer.addEventListener("mouseleave", endPan);

	return modalContainer;
}