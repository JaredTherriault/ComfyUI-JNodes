import { $el } from "/scripts/ui.js";

import { app } from '/scripts/app.js'
import { api } from '/scripts/api.js'
import { utilitiesInstance } from "../common/Utilities.js";

const VideoTypes = [
	"video/webm", "video/mp4", "video/ogg", // Video formats
];

const AnimatedImagetypes = [
	"image/webp", "image/gif", "image/apng", "image/mjpeg", // Animated images 
];

const StillImageTypes = [
	"image/jpg", "image/jpeg", "image/jfif", "image/png", // Still images
];

export const AcceptableFileTypes = VideoTypes.concat(AnimatedImagetypes, StillImageTypes);

const containerHeightPercentage = 0.7;

export const hasWidgets = (node) => {
	if (!node.widgets || !node.widgets?.[Symbol.iterator]) {
		return false
	}
	return true
}

function getLabelHeight(label) {
	if (!label || label.style.display === "none") return 0;
	return label.getBoundingClientRect().height;
}

function fitHeight(node) {
    node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])

    node?.graph?.setDirtyCanvas(true);
}

const CreatePreviewElement = (name, val, format, node, jnodesPayload = null) => {

	let container = $el("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			draggable: false,
			maxHeight: "100%",
			position: "absolute",
			width: "100%",
		}
	});

    function setIsVisible(bNewSetting) {
        container.style.opacity = bNewSetting ? "1" : "0";
        container.style.pointerEvents = bNewSetting ? "auto" : "none";
    }
    container.setIsVisible = setIsVisible;

	container.rebuildMediaElement = (bIsVideo, src) => {

		if (container.mediaElement) {
			container.removeChild(container.mediaElement);
		}

		container.mediaElement = $el(bIsVideo ? 'video' : 'img', {
			src: src,
			style: {
				width: "100%",
  				height: "100%",
  				objectFit: "contain"
			}
		});

		if (bIsVideo) {

			container.mediaElement.addEventListener("loadedmetadata", () => {

				container.aspectRatio = container.mediaElement.videoWidth / container.mediaElement.videoHeight;
				fitHeight(node);
			});
		} else {

			container.mediaElement.onload = () => {
				container.aspectRatio = container.mediaElement.naturalWidth / container.mediaElement.naturalHeight;
				fitHeight(node);
			};
		}

		if (container.firstChild) {
			container.insertBefore(container.firstChild, container.mediaElement);
		} else {
			container.appendChild(container.mediaElement);
		}
	}

	const bIsVideo = format.startsWith("video");

	container.rebuildMediaElement(bIsVideo, jnodesPayload?.href? jnodesPayload.href : val);

	// Ideally info can be appended if we have a JNodesPayload since we get this info in python beforehand
	container.infoTextArea = $el("textarea", {
		wrap: "hard",
		style: {
			display: "none",
			resize: "none",
			color: "inherit",
			backgroundColor: "inherit",
			width: "100%",
			overflow: "hidden",
			boxSizing: "border-box",
		}
	});
	container.appendChild(container.infoTextArea);

	let displayData = jnodesPayload?.displayData;

	function setInfoTextFromDisplayData(inDisplayData) {
		if (inDisplayData && Object.keys(inDisplayData).length > 0) {
			try {

				inDisplayData = utilitiesInstance.sortJsonObjectByKeys(inDisplayData);
				let jsonString = utilitiesInstance.stringifyDisplayData(inDisplayData);

				if (jsonString) {
					// console.log(PayloadString);

					jsonString = utilitiesInstance.removeCurlyBracesFromJsonString(jsonString);

					container.infoTextArea.value = utilitiesInstance.unindentJsonString(jsonString);

					container.infoTextArea.style.display = "unset";
					container.infoTextArea.readOnly = true;

					function autoResize() {
						container.infoTextArea.style.height = 'auto';                 // reset
						container.infoTextArea.style.height = container.infoTextArea.scrollHeight + 'px';
					}

					// Resize after DOM paint
					requestAnimationFrame(() => autoResize());
				}

			} catch (e) {
				console.error(e);
			}
		}
	};

	container.getTextareaHeight = function() {
		if (container.infoTextArea.style.display === "none") return 0;
		return container.infoTextArea.scrollHeight || container.infoTextArea.offsetHeight || 0;
	}

	let currentInfo = null;

	if (displayData && Object.keys(displayData).length > 0) {
		// Set immediately
		setInfoTextFromDisplayData(displayData);
	} else {
		function constructAndDisplayData(inDisplayData) {
			if (inDisplayData.FileDimensions) {
				inDisplayData.AspectRatio = inDisplayData.FileDimensions[0] / inDisplayData.FileDimensions[1];
			}
			setInfoTextFromDisplayData(inDisplayData);
			container.bHasAutoResized = false; // Resize node on next draw call
		}
		// Construct DisplayData on load
		if (bIsVideo) {
			container.mediaElement.addEventListener("loadedmetadata", () => {
				let displayData = {};
				displayData.FileDimensions = [container.mediaElement.videoWidth, container.mediaElement.videoHeight];
				constructAndDisplayData(displayData);
			});
		} else {
			container.mediaElement.addEventListener("load", () => {
				let displayData = {};
				displayData.FileDimensions = [container.mediaElement.naturalWidth, container.mediaElement.naturalHeight];
				constructAndDisplayData(displayData);
			});
		}

		// Good for all videos
		if (bIsVideo) {

			container.mediaElement.muted = true;
			container.mediaElement.autoplay = true
			container.mediaElement.loop = true
			container.mediaElement.controls = true;

			// Function to update the label text dynamically
			container.updateCurrentInfo = function () {
				// Update the text content of CurrentInfo based on updated currentTime and fps
				if (container.mediaElement.currentTime) {
					currentInfo.textContent = `Current Time: ${container.mediaElement.currentTime.toFixed(0)}`;
					// console.log(currentInfo.textContent);

					let fps = displayData?.FramesPerSecond;

					if (fps) {
						const currentFrame = container.mediaElement.currentTime * fps;
						currentInfo.textContent += ` Current Frame: ${currentFrame.toFixed(0)}`;
					}
				}
			}

			currentInfo = $el("label", {
				textContent: "Current Time: 0",
			});
			container.appendChild(currentInfo);

			// Attach an event listener to the MediaElement to trigger updates on time change
			container.mediaElement.addEventListener("timeupdate", container.updateCurrentInfo);
		}

		container.getCurrentInfoHeight = function() {
			return getLabelHeight(currentInfo);
		}
	}

	return container;
}

const mediaPreview = {
	name: 'JNodes.media_preview',
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		switch (nodeData.name) {
			case "JNodes_SaveVideoWithOptions":
			case 'JNodes_SaveVideo': {
				const onExecuted = nodeType.prototype.onExecuted;
				nodeType.prototype.onExecuted = function (message) {
					const r = onExecuted ? onExecuted.apply(this, message) : undefined

					const node = this;
					const prefix = 'jnodes_media_preview_'

					if (node.widgets) {
						const pos = node.widgets.findIndex((w) => w.name === `${prefix}_0`)
						if (pos !== -1) {
							for (let i = pos; i < node.widgets.length; i++) {
								node.widgets[i].onRemoved?.()
							}
							node.widgets.length = pos
						}
						if (message?.images?.length > 0) {
							message.images.forEach((params, i) => {
								const previewUrl = api.apiURL(
									'/jnodes_view_image?' + new URLSearchParams(params).toString()
								)
								node.previewElement = CreatePreviewElement(`${prefix}_${0}`, previewUrl, params.format, node);

								if (!node.mediaPreview) {
								    node.mediaPreview = utilitiesInstance.addComfyNodeWidget(
								        node, node.previewElement, name, "VideoPreview", {
								            serialize: false,
								            hideOnZoom: false,
								        }
								    );
								
								    node.mediaPreview.computeSize = function (width) {
								        if (!node.previewElement.aspectRatio || node.mediaPreview.parentEl.hidden) {
								            return [width, -4];
								        }
								
								        const previewWidth = node.size[0] - 20;
								        let mediaHeight = previewWidth / node.previewElement.aspectRatio;
								        if (!(mediaHeight > 0)) mediaHeight = 0;
								
								        const textareaHeight = node.previewElement.getTextareaHeight();
								        const currentInfoHeight = node.previewElement.getCurrentInfoHeight();
								
								        const totalHeight =
								            mediaHeight +
								            textareaHeight +
								            currentInfoHeight +
								            20; // padding / margins
								
								        node.previewElement.computedHeight = totalHeight;
								
								        return [width, totalHeight];
								    };
								} else {
								    node.mediaPreview.parentEl.firstChild.replaceWith(node.previewElement);
								}
							})
						}
					}

					return r;
				};
				break;
			};
			case 'JNodes_UploadVisualMedia': {

				function createMediaPreview(MediaPath, ThisNode, JnodesPayload = null) {
					if (!MediaPath) { return; }

					const components = MediaPath.split('/');

					let type = '';
					let subfolder = '';
					let name = '';

					if (components.length > 3) {
						type = components[0];
						subfolder = components.slice(1, components.length - 1).join('/'); // For deeply nested assets
						name = components[components.length - 1];
					} else if (components.length === 3) {
						[type, subfolder, name] = components;
					} else if (components.length === 2) {
						[type, name] = components;
					} else {
						name = components[0];
					}

					const prefix = 'jnodes_media_preview_';

					if (ThisNode.widgets) {

						const extSplit = name.split('.');
						const extension = extSplit[extSplit.length - 1].toLowerCase();

						let format = 'video/mp4';
						for (const fileType of AcceptableFileTypes) {
							if (fileType.includes(`/${extension}`)) {
								format = fileType;
								break;
							}
						}

						const bIsVideo = format.startsWith("video");

						const previewUrl = api.apiURL(
							`/jnodes_view_image?filename=${encodeURIComponent(name)}&type=${type}&subfolder=${encodeURIComponent(subfolder)}`
						);

						const pos = ThisNode.widgets.findIndex((w) => w.name === `${prefix}_0`);
						if (pos !== -1) {
							for (let i = pos; i < ThisNode.widgets.length; i++) {
								ThisNode.widgets[i].onRemoved?.();
							}
							ThisNode.widgets.length = pos;
						}

						ThisNode.previewElement = CreatePreviewElement(`${prefix}_${0}`, previewUrl, format, ThisNode, JnodesPayload);
					
						if (!ThisNode.mediaPreview) {

							ThisNode.mediaPreview = utilitiesInstance.addComfyNodeWidget(
								ThisNode, ThisNode.previewElement, name, "VideoPreview", {
									serialize: false,
									hideOnZoom: false,
								});

							ThisNode.mediaPreview.computeSize = function (width) {
								if (!ThisNode.previewElement.aspectRatio || ThisNode.mediaPreview.parentEl.hidden) {
									return [width, -4];
								}

								const previewWidth = ThisNode.size[0] - 20;
								let mediaHeight = previewWidth / ThisNode.previewElement.aspectRatio;
								if (!(mediaHeight > 0)) mediaHeight = 0;

								const textareaHeight = ThisNode.previewElement.getTextareaHeight();
								const currentInfoHeight = ThisNode.previewElement.getCurrentInfoHeight();

								const totalHeight =
									mediaHeight +
									textareaHeight +
									currentInfoHeight +
									20; // padding / margins

								ThisNode.previewElement.computedHeight = totalHeight;

								return [width, totalHeight];
							};

						} else {
							ThisNode.mediaPreview.parentEl.firstChild.replaceWith(ThisNode.previewElement);
						}
					
					}
				}

				const onAdded = nodeType.prototype.onAdded;
				nodeType.prototype.onAdded = function () {
					onAdded?.apply(this, arguments);

					const ThisNode = this;
					const MediaWidget = ThisNode.widgets.find((w) => w.name === "media");

					const originalCallback = ThisNode.callback;
					MediaWidget.callback = (message, JnodesPayload = null) => {
						createMediaPreview(MediaWidget.value, ThisNode, JnodesPayload);
						return originalCallback ? originalCallback.apply(ThisNode, message) : undefined;
					};

				};

				const onConfigure = nodeType.prototype.onConfigure;
				nodeType.prototype.onConfigure = function () {

					onConfigure?.apply(this, arguments);

					const ThisNode = this;
					const MediaWidget = ThisNode.widgets.find((w) => w.name === "media");
					createMediaPreview(MediaWidget.value, ThisNode);
				};

				break;
			};
		}
	}
}

app.registerExtension(mediaPreview)
