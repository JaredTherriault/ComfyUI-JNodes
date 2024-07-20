import { $el } from "/scripts/ui.js";

import { imageDrawerComponentManagerInstance } from "../ImageDrawer/Core/ImageDrawerModule.js";

export class ModalManager {

	constructor(imageIndex = undefined) {

		// If this modal is representing an image in imageList,
		// add functionality to switch to neighboring images or
		// enable auto mode / slideshows
		this._imageIndex = imageIndex;

		// Zoom and Pan functionality
		this._scale = 1;
		this._translateX = -50; // Initial translate X percentage
		this._translateY = -50; // Initial translate Y percentage
		this._bIsPanningActive = false;
		this._bHasPanned = false;
		this._startX = 0;
		this._startY = 0;

		this._modalContainer;
		this._modalContent;

		this.handleKeyDownFunction;
		this._bButtonPressed = false;
	}

	createModal(modalContent,) {
		if (!modalContent) { return; }

		this._modalContent = modalContent;

		this._setModalContentStyle();

		// Append modal content to modal container
		this._getOrCreateModalContainer().appendChild(this._modalContent);

		this._createModalControlButtons();

		this.handleKeyDownFunction = (event) => { this._handleKeyDown(event); };

		// Add key event listeners
		document.addEventListener("keydown", this.handleKeyDownFunction);

		return this._getOrCreateModalContainer();
	}

	createModalReadyImage(href) {
		return $el("img", {
			src: href,
			style: {
				position: 'relative',
				width: '99vw',
				height: '99vh',
				objectFit: 'contain',
				display: 'block',
				margin: 'auto',
			},
		});
	}

	_setModalContentStyle() {

		this._modalContent.style.position = 'absolute';
		this._modalContent.style.display = "inline-block";
		this._modalContent.style.left = "50%";
		this._modalContent.style.top = "50%";
		this._modalContent.style.transform = "translate(-50%, -50%)";
		this._modalContent.style.maxWidth = "99%";
		this._modalContent.style.maxHeight = "99%";
		this._modalContent.style.overflow = "hidden";

		// Prevent drag & drop operation
		this._modalContent.draggable = false;
	}

	_createAndOpenModalContainer() {
		this._modalContainer = document.createElement("div");
		this._modalContainer.style.display = "block";
		this._modalContainer.style.position = "fixed";
		this._modalContainer.style.zIndex = "10000";
		this._modalContainer.style.left = "0";
		this._modalContainer.style.top = "0";
		this._modalContainer.style.width = "100%";
		this._modalContainer.style.height = "100%";
		this._modalContainer.style.overflow = "auto";
		this._modalContainer.style.backgroundColor = "rgba(0,0,0,0.7)";

		this._modalContainer.addEventListener("wheel", (event) => { this._zoom(event); });
		this._modalContainer.addEventListener("mousedown", (event) => { this._startPan(event); });
		this._modalContainer.addEventListener("mousemove", (event) => { this._pan(event); });
		this._modalContainer.addEventListener("mouseup", (event) => { this._onMouseUp(event); });
		this._modalContainer.addEventListener("mouseleave", (event) => { this._endPan(); });

		// Prevent drag & drop operation
		this._modalContainer.addEventListener("dragstart", (event) => { event.preventDefault(); });
		this._modalContainer.draggable = false;

		this._modalContainer.data = this;

		// Append modal container to the document body
		document.body.appendChild(this._modalContainer);
	}

	_getOrCreateModalContainer() {
		if (!this._modalContainer) {
			this._createAndOpenModalContainer();
		}
		return this._modalContainer;
	}

	_createModalControlButtons() {

		const createButton = (text, tooltip, clickFunction) => {
			const button = $el("button", {
				title: tooltip,
				textContent: text,
				style: {
					background: "none",
					border: "none",
					padding: "0px",
					color: "white",
					fontWeight: "bolder",
					fontSize: "400%",
					cursor: 'pointer',
					position: "absolute",
					filter: "drop-shadow(13px 0px black)",
				},
				onmousedown: () => {
					this._bButtonPressed = true;
				},
				onclick: clickFunction,
			});
			button.classList.add("JNodes-interactive-container");

			return button;
		}

		const previousImageButton = createButton("<", "See previous image", () => { this._displayNeighbouringImage(-1); });
		previousImageButton.style.left = "2.5%";
		previousImageButton.style.top = "50%";
		this._getOrCreateModalContainer().appendChild(previousImageButton);

		const nextImageButton = createButton(">", "See next image", () => { this._displayNeighbouringImage(1); });
		nextImageButton.style.right = "2.5%";
		nextImageButton.style.top = "50%";
		this._getOrCreateModalContainer().appendChild(nextImageButton);

		// Count
		if (this._imageIndex != undefined) {

			const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
			const currentListChildren = imageDrawerListInstance.getVisibleImageListChildren();

			const countWidget = $el("label", {
				textContent: `${this._imageIndex + 1}/${currentListChildren.length}`,
				style: {
					background: "rgba(0,0,0,0.5)",
					color: "white",
					fontWeight: "bolder",
					fontSize: "100%",
					fontFamily: "arial",
					position: "absolute",
					right: "1%",
					top: "1%"
				}
			});
			this._getOrCreateModalContainer().appendChild(countWidget);
		}
	}

	// Function to close the modal and destroy the class instance
	_closeModal() {
		if (this._modalContainer && this._modalContainer.parentNode) {
			this._modalContainer.parentNode.removeChild(this._modalContainer);
		}
		document.removeEventListener("keydown", this.handleKeyDownFunction);

		delete this;
	}

	_handleKeyDown(event) {
		if (event.key === "Escape") {
			event.preventDefault();
			this._closeModal();
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			this._displayNeighbouringImage(-1);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			this._displayNeighbouringImage(1);
		}
	}

	_zoom(event) {
		event.preventDefault(); // Prevent the default scroll behavior

		const zoomSpeed = 0.1;
		const delta = event.deltaY;

		// Adjust the scale based on scroll direction
		if (delta > 0) {
			this._scale = Math.max(0.1, this._scale - zoomSpeed); // Zoom out
		} else {
			this._scale = Math.min(5, this._scale + zoomSpeed); // Zoom in
		}

		// Apply the scale and initial translate to the modal content
		this._modalContent.style.transform = `translate(${this._translateX}%, ${this._translateY}%) scale(${this._scale})`;
	}

	_startPan(event) {
		this._bIsPanningActive = true;
		this._getOrCreateModalContainer().style.cursor = "grabbing";
		this._startX = event.clientX;
		this._startY = event.clientY;
	}

	_pan(event) {
		if (!this._bIsPanningActive) return;

		const dx = event.clientX - this._startX;
		const dy = event.clientY - this._startY;

		// Adjust translate values
		this._translateX += (dx / this._getOrCreateModalContainer().clientWidth) * 100;
		this._translateY += (dy / this._getOrCreateModalContainer().clientHeight) * 100;

		// Update start positions for next movement
		this._startX = event.clientX;
		this._startY = event.clientY;

		// Apply the transformation
		this._modalContent.style.transform = `translate(${this._translateX}%, ${this._translateY}%) scale(${this._scale})`;

		this._bHasPanned = true;
	}

	_endPan() {
		this._bIsPanningActive = false;
		this._getOrCreateModalContainer().style.cursor = "grab";
	}

	_onMouseUp(event) {

		this._endPan();

		if (this._bButtonPressed == true) {

			this._bButtonPressed = false;
			return;
		}

		if (this._bHasPanned) {

			this._bHasPanned = false;

		} else if (event.button == 0) { // Left mouse button only can close

			this._closeModal();

		}
	}

	_displayNeighbouringImage(offset = 0) {

		if (this._imageIndex !== undefined) {

			const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");
			const currentListChildren = imageDrawerListInstance.getVisibleImageListChildren();

			let newImageIndex = this._imageIndex;
			let newImage;

			// Loop until we find an image format child
			do {
				newImageIndex += offset;

				// Wrap index to first or last index at the extremes
				newImageIndex = ((newImageIndex % currentListChildren.length) + currentListChildren.length) % currentListChildren.length;

				newImage = currentListChildren[newImageIndex];

				// Break if we round back to the original image index
				if (newImageIndex == this._imageIndex) {
					break;
				}

			} while (newImage?.bIsVideoFormat);

			const modalManager = new ModalManager(newImageIndex);
			modalManager.createModal(modalManager.createModalReadyImage(newImage.fileInfo.href));

			this._closeModal();
		}
	}
}