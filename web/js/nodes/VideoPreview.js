import { $el } from "/scripts/ui.js";

import { app } from '/scripts/app.js'
import { api } from '/scripts/api.js'

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

function fitHeight(node) {
    node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])
    node.graph.setDirtyCanvas(true);
}

const CreatePreviewElement = (name, val, format, node, JnodesPayload = null) => {
	const [type] = format.split('/');
	const widget = {
		name,
		type,
		value: val,
		draw: function (ctx, node, widgetWidth, widgetY, height) {
			const [cw, ch] = this.computeSize()
			offsetDOMWidget(this, ctx, node, widgetWidth, widgetY, ch)
		},
		computeSize : function(width) {
			if (this.aspectRatio && !this.parentEl?.hidden) {
				let height = (node.size[0]-30)/ this.aspectRatio;
				if (!(height > 0)) {
					height = 0;
				}
				return [width, height];
			}
			return [width, -4];//no loaded src, widget should not display
		},
		onRemoved: function () {
			if (this.inputEl) {
				this.inputEl.remove()
			}
		},
	}

	const MediaMargin = 0.95;
	const MediaAspectAdjustment = -((1.0 - MediaMargin) / 2);

	let Container = $el("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			pointerEvents: "none",
			maxHeight: "100%",
		}
	});

	const bIsVideo = type === 'video';
	const bIsAnimatedImage = AnimatedImagetypes.includes(format);

	let MediaElement = $el(bIsVideo ? 'video' : 'img', {
		// draggable: false,
		style: {
			width: `${MediaMargin * 100}%`,
		}
	});

	if (bIsVideo) {

		MediaElement.muted = true;
		MediaElement.autoplay = true
		MediaElement.loop = true
		MediaElement.controls = true;

	} else { // Images, still or animated

		function ResizeToImage() {
			if (Container) {
				// let WidgetWidth = 0;
				let WidgetHeights = 0;
				for (const WidgetChild of Container.childNodes) {
					if (WidgetChild) {
						// if (WidgetChild.tagName === "IMG") {
						// 	if (WidgetWidth == 0) { WidgetWidth = WidgetChild.width; }
						// 	const AspectRatio = WidgetChild.width / WidgetChild.height; // The image is loaded but not added to the node yet
						// 	WidgetHeights += (WidgetWidth / AspectRatio); // So we need to calculate its pixel aspect and apply that to the node's current width 
						// } else {
							WidgetHeights += WidgetChild.naturalHeight; // Other widgets are expected to be calculated normally
						// }
					}
				}
				widget.aspectRatio = (MediaElement.naturalWidth * (MediaMargin + MediaAspectAdjustment)) / WidgetHeights;
				fitHeight(node);
			}
		}

		MediaElement.onload = function () {
			ResizeToImage();
		}

	} 

	Container.appendChild(MediaElement);

	// Info can only be appended if we have a JNodesPayload since we need to get this info in python beforehand
	if (JnodesPayload && (bIsVideo || bIsAnimatedImage)) {
		try {
			let StreamlinedPayload = {};
			if (JnodesPayload?.file?.duration_in_seconds > 0) {
				StreamlinedPayload.duration_in_seconds = JnodesPayload.file.duration_in_seconds;
			}
			if (JnodesPayload?.file?.fps > 0) {
				StreamlinedPayload.fps = JnodesPayload.file.fps;
			}
			if (JnodesPayload?.file?.frame_count > 0) {
				StreamlinedPayload.frame_count = JnodesPayload.file.frame_count;
			}
			if (JnodesPayload?.file?.file_size) {
				StreamlinedPayload.file_size = JnodesPayload.file.file_size;
			}
			if (JnodesPayload?.file?.dimensions) {
				StreamlinedPayload.dimensions = JnodesPayload.file.dimensions;
			}

			if (Object.keys(StreamlinedPayload).length > 0) {
				const PayloadString = JSON.stringify(StreamlinedPayload, null, 4); // Pretty formatting
				// console.log(PayloadString);
				const TextWidget = $el("textarea", {
					wrap: "hard",
					rows: 10,
					style: {
						resize: "none",
						width: WidgetMarginAsPercentage,
						color: "inherit",
						backgroundColor: "inherit"
					}
				});
				TextWidget.value = PayloadString;
				TextWidget.readOnly = true;
				Container.appendChild(TextWidget);

				if (bIsVideo) {

					// Function to update the label text dynamically
					Container.updateCurrentInfo = function () {
						// Update the text content of CurrentInfo based on updated MediaElement.currentTime and StreamlinedPayload.fps
						const CurrentFrame = MediaElement.currentTime * StreamlinedPayload.fps;
						CurrentInfo.textContent = `Current Time: ${MediaElement.currentTime.toFixed(0)} Current Frame: ${CurrentFrame.toFixed(0)}`;

						if (CurrentFrame > 1 && Container && !Container.bHasAutoResized) {
							let WidgetHeights = 0;
							for (const WidgetChild of Container.childNodes) {
								if (WidgetChild) {
									WidgetHeights += WidgetChild.clientHeight;
								}
							}
							widget.aspectRatio = (Container.clientWidth * (MediaMargin + MediaAspectAdjustment)) / WidgetHeights;
							fitHeight(node);

							Container.bHasAutoResized = true;
						}
					}
					
					const CurrentInfo = $el("label", {
						textContent: "",
						style: {
							fontSize: "small"
						}
					});
					Container.appendChild(CurrentInfo);

					// Attach an event listener to the MediaElement to trigger updates on time change
					MediaElement.addEventListener("timeupdate", Container.updateCurrentInfo);
				}
			}

		} catch (e) {
			console.error(e);
		}
	}

	widget.inputEl = Container;
	widget.parent = node;

	document.body.appendChild(widget.inputEl);
	MediaElement.src = widget.value;
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
							`/view?filename=${encodeURIComponent(name)}&type=${type}&subfolder=${encodeURIComponent(subfolder)}`
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
					MediaWidget.callback = (message, jnodesPayload = null) => {
						createMediaPreview(MediaWidget.value, ThisNode, jnodesPayload);
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
