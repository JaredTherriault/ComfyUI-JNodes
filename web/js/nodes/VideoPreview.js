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

function offsetDOMWidget(
	widget,
	ctx,
	node,
	widgetWidth,
	widgetY,
	height
) {
	const margin = 10
	const elRect = ctx.canvas.getBoundingClientRect()
	const transform = new DOMMatrix()
		.scaleSelf(
			elRect.width / ctx.canvas.width,
			elRect.height / ctx.canvas.height
		)
		.multiplySelf(ctx.getTransform())
		.translateSelf(0, widgetY + margin)

	const scale = new DOMMatrix().scaleSelf(transform.a, transform.d)
	Object.assign(widget.inputEl.style, {
		transformOrigin: '0 0',
		transform: scale,
		left: `${transform.e}px`,
		top: `${transform.d + transform.f}px`,
		width: `${widgetWidth}px`,
		height: `${(height || widget.parent?.inputHeight || 32) - margin}px`,
		position: 'absolute',
		background: !node.color ? '' : node.color,
		color: !node.color ? '' : 'white',
		zIndex: 5, //app.graph._nodes.indexOf(node),
	})
}

export const hasWidgets = (node) => {
	if (!node.widgets || !node.widgets?.[Symbol.iterator]) {
		return false
	}
	return true
}

export const cleanupNode = (node) => {
	if (!hasWidgets(node)) {
		return
	}

	for (const w of node.widgets) {
		if (w.canvas) {
			w.canvas.remove()
		}
		if (w.inputEl) {
			w.inputEl.remove()
		}
		// calls the widget remove callback
		w.onRemoved?.()
	}
}

const CreatePreviewElement = (name, val, format, node, jnodesPayload = null) => {
	const [type] = format.split('/');
	const widget = {
		name,
		type,
		value: val,
		draw: function (ctx, node, widgetWidth, widgetY, height) {
			//update widget position, hide if off-screen
			const transform = ctx.getTransform();
			const scale = app.canvas.ds.scale;//gets the litegraph zoom
			//calculate coordinates with account for browser zoom
			const x = transform.e * scale / transform.a;
			const y = transform.f * scale / transform.a;
			Object.assign(this.inputEl.style, {
				left: (x + 15 * scale) + "px",
				top: (y + widgetY * scale) + "px",
				width: ((widgetWidth - 30) * scale) + "px",
				zIndex: 2 + (node.is_selected ? 1 : 0),
				position: "absolute",
			});
			this._boundingCount = 0;

			// Fit node once everything has been loaded in and displayed
			if (!this.inputEl.bHasAutoResized) {
				this.inputEl.bHasAutoResized = fitNode();
			}
		},
		computeSize: function (width) {
			if (this.aspectRatio && !this.inputEl?.hidden) {
				let height = (node.size[0] - 30) / this.aspectRatio;
				if (!(height > 0)) {
					height = 0;
				}
				return [width, height];
			}
			return [width, -4];//no loaded src, widget should not display
		},
		onRemoved: function () {
			if (this.inputEl) {
				this.inputEl.remove();
			}
		},
	}

	function fitNode() {
		try {
			const constantWidth = bIsVideo ? mediaElement.videoWidth : mediaElement.naturalWidth;
			let widgetHeights = bIsVideo ? mediaElement.videoHeight : mediaElement.naturalHeight;

			if (constantWidth > 0 && widgetHeights > 0) {
				for (const widgetChild of container.childNodes) {
					if (widgetChild && widgetChild != mediaElement) {
						let childAspect = (widgetChild.clientWidth / widgetChild.clientHeight);
						widgetHeights += (constantWidth / childAspect);
					}
				}
				widget.aspectRatio = ((constantWidth) / widgetHeights);

				node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])
				node.graph.setDirtyCanvas(true);
				return true;
			} else {
				return false;
			}
		} catch (e) {
			return false;
		}
	}

	let container = $el("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			draggable: false,
			maxHeight: "100%",
		}
	});

	const bIsVideo = type === 'video';

	let mediaElement = $el(bIsVideo ? 'video' : 'img', {
		style: {
			width: "100%"
		}
	});
	container.appendChild(mediaElement);

	// Ideally info can be appended if we have a JNodesPayload since we get this info in python beforehand
	let infoTextArea = $el("textarea", {
		wrap: "hard",
		style: {
			display: "none",
			resize: "none",
			color: "inherit",
			backgroundColor: "inherit",
			width: "100%"
		}
	});
	container.appendChild(infoTextArea);

	let displayData = jnodesPayload?.DisplayData;

	function setInfoTextFromDisplayData(inDisplayData) {
		if (inDisplayData && Object.keys(inDisplayData).length > 0) {
			try {
				const FileDimensionStringifier = (key, value) => {
					// Check if the key is 'FileDimensions'
					if (key === 'FileDimensions') {
						// Serialize the value of 'FileDimensions' as a single line string
						return JSON.stringify(value);
					}

					if (typeof value == "number") {
						return value.toFixed(3);
					}
					// Return the original value for other keys
					return value;
				};

				inDisplayData = utilitiesInstance.SortJsonObjectByKeys(inDisplayData);
				const payloadString = JSON.stringify(inDisplayData, FileDimensionStringifier, 4); // Pretty formatting

				if (payloadString) {
					// console.log(PayloadString);

					// Remove curly braces
					const lines = payloadString.substring(1, payloadString.length - 1).split('\n');
					const unindentedLines = lines.map(Line => {
						// Use a regular expression to match the first tab or leading whitespace
						const unindentedLine = Line.replace(/^\s{4}/, ''); // Replace leading tab (\t)
						// Alternatively, replace leading spaces (e.g., with /^\s{4}/ for 4 spaces)

						return unindentedLine;
					});
					infoTextArea.style.display = "unset";
					infoTextArea.value = unindentedLines.join('\n').trim();
					infoTextArea.rows = infoTextArea.value.split('\n').length || 5;
					infoTextArea.readOnly = true;
				}

			} catch (e) {
				console.error(e);
			}
		}
	}

	if (displayData && Object.keys(displayData).length > 0) {
		// Set immediately
		setInfoTextFromDisplayData(displayData);
	} else {
		function constructAndDisplayData(inDisplayData) {
			if (inDisplayData.FileDimensions) {
				inDisplayData.AspectRatio = inDisplayData.FileDimensions[0] / inDisplayData.FileDimensions[1];
			}
			setInfoTextFromDisplayData(inDisplayData);
			setFontSizesBasedOnCanvasScale();
			container.bHasAutoResized = false; // Resize node on next draw call
		}
		// Construct DisplayData on load
		if (bIsVideo) {
			mediaElement.addEventListener("loadedmetadata", () => {
				let displayData = {};
				displayData.FileDimensions = [mediaElement.videoWidth, mediaElement.videoHeight];
				constructAndDisplayData(displayData);
			});
		} else {
			mediaElement.addEventListener("load", () => {
				let displayData = {};
				displayData.FileDimensions = [mediaElement.naturalWidth, mediaElement.naturalHeight];
				constructAndDisplayData(displayData);
			});
		}
	}

	let currentInfo = null;

	// Good for all videos
	if (bIsVideo) {

		mediaElement.muted = true;
		mediaElement.autoplay = true
		mediaElement.loop = true
		mediaElement.controls = true;

		// Function to update the label text dynamically
		container.updateCurrentInfo = function () {
			// Update the text content of CurrentInfo based on updated currentTime and fps
			if (mediaElement.currentTime) {
				currentInfo.textContent = `Current Time: ${mediaElement.currentTime.toFixed(0)}`;

				let fps = displayData?.FramesPerSecond;

				if (!fps) {
					if (mediaElement.currentTime && mediaElement.mozPresentedFrames) {
						fps = mediaElement.mozPresentedFrames / mediaElement.currentTime;
					}
				}

				if (mediaElement.mozPresentedFrames || fps) {
					const currentFrame = mediaElement.mozPresentedFrames ? mediaElement.mozPresentedFrames : mediaElement.currentTime * fps;
					currentInfo.textContent += ` Current Frame: ${currentFrame.toFixed(0)}`;
				}
			}
		}

		currentInfo = $el("label", {
			textContent: "Current Time: 0",
		});
		container.appendChild(currentInfo);

		// Attach an event listener to the MediaElement to trigger updates on time change
		mediaElement.addEventListener("timeupdate", container.updateCurrentInfo);
	}

	function setFontSizesBasedOnCanvasScale() {

		const currentScale = app?.canvas?.ds?.scale;

		const newFontSize = `${15 * currentScale}px`;

		if (infoTextArea) {
			infoTextArea.style.fontSize = newFontSize;
		}
		if (currentInfo) {
			currentInfo.style.fontSize = newFontSize;
		}
	};

	if (infoTextArea || currentInfo) {

		const originalOnRedraw = app?.canvas?.ds?.onredraw;
		app.canvas.ds.onredraw = () => {

			if (originalOnRedraw && typeof originalOnRedraw === 'function') {
				originalOnRedraw();
			}

			setFontSizesBasedOnCanvasScale();
		};

		setFontSizesBasedOnCanvasScale(); // Call it to set font size immediately
	}

	widget.inputEl = container;
	widget.parent = node;

	document.body.appendChild(widget.inputEl);

	// Set src to JNodes href if available, otherwise use constructed src
	if (jnodesPayload?.href) {
		mediaElement.src = jnodesPayload.href;
	} else {
		mediaElement.src = widget.value;
	}

	return widget;
}

const mediaPreview = {
	name: 'JNodes.media_preview',
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		switch (nodeData.name) {
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
									'/view?' + new URLSearchParams(params).toString()
								)
								const w = node.addCustomWidget(
									CreatePreviewElement(`${prefix}_${i}`, previewUrl, params.format || 'image/webp', node)
								)
								node.setSizeForimage?.();
							})
						}
					}
					const onRemoved = node.onRemoved
					node.onRemoved = () => {
						cleanupNode(node)
						return onRemoved?.()
					};

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
						const pos = ThisNode.widgets.findIndex((w) => w.name === `${prefix}_0`);
						if (pos !== -1) {
							for (let i = pos; i < ThisNode.widgets.length; i++) {
								ThisNode.widgets[i].onRemoved?.();
							}
							ThisNode.widgets.length = pos;
						}
						const previewUrl = api.apiURL(
							`/jnodes_view_image?filename=${encodeURIComponent(name)}&type=${type}&subfolder=${encodeURIComponent(subfolder)}`
						);

						const extSplit = name.split('.');
						const extension = extSplit[extSplit.length - 1];

						let format = 'video/mp4';
						for (const fileType of AcceptableFileTypes) {
							if (fileType.includes(`/${extension}`)) {
								format = fileType;
								break;
							}
						}
						const newWidget = ThisNode.addCustomWidget(
							CreatePreviewElement(`${prefix}_${0}`, previewUrl, format, ThisNode, JnodesPayload)
						);
						ThisNode.setSizeForimage?.();
					}

					const onRemoved = ThisNode.onRemoved;
					ThisNode.onRemoved = () => {
						cleanupNode(ThisNode);
						return onRemoved?.();
					};
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
