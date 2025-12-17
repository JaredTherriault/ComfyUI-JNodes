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

export const hasWidgets = (node) => {
	if (!node.widgets || !node.widgets?.[Symbol.iterator]) {
		return false
	}
	return true
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
			width: "0px",
		}
	});

    function setIsVisible(bNewSetting) {
        container.style.display = bNewSetting ? "flex" : "none";
    }

    function cleanupNode() {

        if (container) {
            container.remove();
        }
    }

	const [type] = format.split('/');
	const widget = {
		name,
		type,
		value: val,
		draw: function (ctx, node, widgetWidth, widgetY, height) {
			//update widget position, hide if off-screen
			const transform = ctx.getTransform();
			//calculate coordinates with account for browser zoom
        	const bcr = app.canvas.canvas.getBoundingClientRect()

			const ds = app.canvas.ds;
			const scale = ds.scale; // gets the litegraph zoom

			// As other events can set the element invisible, 
			// we must set it visible explicitly every draw call
			setIsVisible(true);

			const x = transform.e * scale / transform.a + bcr.x;
			const y = transform.f * scale / transform.a + bcr.y;

			const setting = app.ui.settings.getSettingValue("Comfy.UseNewMenu").toLowerCase();
			const comfyMenuBar = document.querySelector(".comfyui-body-top");
			const topOffset = comfyMenuBar && setting == "top" ? comfyMenuBar.clientHeight : 0; //Comfy.UseNewMenu

			Object.assign(this.inputEl.style, {
				left: (x + 15 * scale) + "px",
				top: ((y + widgetY * scale) + topOffset) + "px",
				width: ((widgetWidth - 30) * scale) + "px",
				zIndex: 2 + (node.is_selected ? 1 : 0),
			});

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
			cleanupNode();
		},
        setIsVisible,
        cleanupNode,
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

	let displayData = jnodesPayload?.displayData;

	function setInfoTextFromDisplayData(inDisplayData) {
		if (inDisplayData && Object.keys(inDisplayData).length > 0) {
			try {

				inDisplayData = utilitiesInstance.sortJsonObjectByKeys(inDisplayData);
				let jsonString = utilitiesInstance.stringifyDisplayData(inDisplayData);

				if (jsonString) {
					// console.log(PayloadString);

					jsonString = utilitiesInstance.removeCurlyBracesFromJsonString(jsonString);

					infoTextArea.value = utilitiesInstance.unindentJsonString(jsonString);

					infoTextArea.style.display = "unset";
					infoTextArea.rows = infoTextArea.value.split('\n').length || 5;
					infoTextArea.readOnly = true;
				}

			} catch (e) {
				console.error(e);
			}
		}
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
					// console.log(currentInfo.textContent);

					let fps = displayData?.FramesPerSecond;

					if (fps) {
						const currentFrame = mediaElement.currentTime * fps;
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
	}

	function setFontSizesBasedOnCanvasScale() {

		const currentScale = app?.canvas?.ds?.scale;

		const newFontSize = `${11 * currentScale}px`;

		if (infoTextArea) {
			infoTextArea.style.fontSize = newFontSize;
		}
		if (currentInfo) {
			currentInfo.style.fontSize = newFontSize;
		}
	};

	const originalOnRedraw = app?.canvas?.ds?.onredraw;
	app.canvas.ds.onredraw = (payload) => {

		if (originalOnRedraw && typeof originalOnRedraw === 'function') {
			originalOnRedraw(payload);
		}

		setFontSizesBasedOnCanvasScale();

		// Clear leftover images from viewport
		widget.inputEl.style.top = `${document.body.clientHeight}px`;
		widget.inputEl.style.left = `${document.body.clientWidth}px`;
	};

	setFontSizesBasedOnCanvasScale(); // Call it to set font size immediately

	widget.inputEl = container;
	widget.parent = node;

	document.body.appendChild(widget.inputEl);

    // When entering/exiting subgraph
    app.canvas.canvas.addEventListener('litegraph:set-graph', ()=>{
        if (widget) {
            widget.setIsVisible(false);
        }
    });

    // On Changes to graph
    const original_beforeChange = app.graph.beforeChange
    app.graph.beforeChange = function () {
        if (widget) {
            widget.setIsVisible(false);
        }
        original_beforeChange?.apply(this, arguments)
    }

    const original_afterChange = app.graph.afterChange
    app.graph.afterChange = function () {
        original_afterChange?.apply(this, arguments)
        if (widget) {
            widget.setIsVisible(false);
        }  // afterChange gets called without a beforeChange sometimes
    }
    
    // When a subgraph is made containing this node
    const original_subgraph = app.graph.convertToSubgraph
    app.graph.convertToSubgraph = function (nodes) {
        if (node && nodes.has(node)) {
            if (widget) {
                widget.cleanupNode();
            }
        }
        const r = original_subgraph.apply(this, arguments);
        return r;
    };

    // Canvas movement events
    window.addEventListener("canvasMoved", (e) => {
        if (widget) {
            widget.setIsVisible(false);
        }
    });

    window.addEventListener("pointerdown", (e) => {
        if (widget) {
            if (widget.inputEl.contains(e.target)) {
                return; // ignore clicks inside the widget
            }
            widget.setIsVisible(false);
        }
    });

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
									'/view?' + new URLSearchParams(params).toString()
								)
								node.previewElement = CreatePreviewElement(`${prefix}_${0}`, previewUrl, params.format, node);

								const w = node.addCustomWidget(node.previewElement);
								node.setSizeForimage?.();
							})
						}
					}
					const onRemoved = node.onRemoved;
					node.onRemoved = () => {
						node.previewElement?.cleanupNode(node);
						return onRemoved?.();
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
						const extension = extSplit[extSplit.length - 1].toLowerCase();

						let format = 'video/mp4';
						for (const fileType of AcceptableFileTypes) {
							if (fileType.includes(`/${extension}`)) {
								format = fileType;
								break;
							}
						}
						ThisNode.previewElement = CreatePreviewElement(`${prefix}_${0}`, previewUrl, format, ThisNode, JnodesPayload);

						const newWidget = ThisNode.addCustomWidget(ThisNode.previewElement);
						ThisNode.setSizeForimage?.();
					}

					const onRemoved = ThisNode.onRemoved;
					ThisNode.onRemoved = () => {
						ThisNode.previewElement?.cleanupNode(ThisNode);
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
