import { app } from '/scripts/app.js'
import { api } from '/scripts/api.js'

export const acceptableFileTypes = [ // todo: get types from python
	"video/webm", "video/mp4", "video/ogg", // Video formats
	"image/webp", "image/gif", "image/apng", "image/mjpeg", // Animated images 
	"image/jpg", "image/jpeg", "image/jfif", "image/png", // Still images
];

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

const CreatePreviewElement = (name, val, format) => {
	const [type] = format.split('/');
	const widget = {
		name,
		type,
		value: val,
		draw: function (ctx, node, widgetWidth, widgetY, height) {
			const [cw, ch] = this.computeSize(widgetWidth)
			offsetDOMWidget(this, ctx, node, widgetWidth, widgetY, ch)
		},
		computeSize: function (_) {
			const ratio = this.inputRatio || 1
			const width = Math.max(220, this.parent.size[0])
			return [width, (width / ratio + 10)]
		},
		onRemoved: function () {
			if (this.inputEl) {
				this.inputEl.remove()
			}
		},
	}

	widget.inputEl = document.createElement(type === 'video' ? 'video' : 'img')
	widget.inputEl.src = widget.value

	if (type === 'video') {
		widget.inputEl.muted = true;
		widget.inputEl.autoplay = true
		widget.inputEl.loop = true
		widget.inputEl.controls = true;
	}

	widget.inputEl.onload = function () {
		widget.inputRatio = widget.inputEl.naturalWidth / widget.inputEl.naturalHeight
	}
	document.body.appendChild(widget.inputEl)
	return widget;
}

const mediaPreview = {
	name: 'JNodes.media_preview',
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		switch (nodeData.name) {
			case 'JNodes_SaveVideo': {
				const onExecuted = nodeType.prototype.onExecuted
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
									CreatePreviewElement(`${prefix}_${i}`, previewUrl, params.format || 'image/webp')
								)
								w.parent = node
							})
						}
					}
					const onRemoved = node.onRemoved
					node.onRemoved = () => {
						cleanupNode(node)
						return onRemoved?.()
					}
				};
				node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]]);
				return r;
			};
			case 'JNodes_UploadVisualMedia': {
				const onAdded = nodeType.prototype.onAdded;
				nodeType.prototype.onAdded = function () {
					onAdded?.apply(this, arguments);

					const node = this;
					const mediaWidget = node.widgets.find((w) => w.name === "media");

					function createMediaPreview() {
						if (!mediaWidget.value) { return; }

						const components = mediaWidget.value.split('/');

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

						if (node.widgets) {
							const pos = node.widgets.findIndex((w) => w.name === `${prefix}_0`);
							if (pos !== -1) {
								for (let i = pos; i < node.widgets.length; i++) {
									node.widgets[i].onRemoved?.();
								}
								node.widgets.length = pos;
							}
							const previewUrl = api.apiURL(
								`/view?filename=${encodeURIComponent(name)}&type=${type}&subfolder=${encodeURIComponent(subfolder)}`
							);

							const extSplit = name.split('.');
							const extension = extSplit[extSplit.length - 1];

							let format = 'video/mp4';
							for (const fileType of acceptableFileTypes) {
								if (fileType.includes(`/${extension}`)) {
									format = fileType;
									break;
								}
							}
							const newWidget = node.addCustomWidget(
								CreatePreviewElement(`${prefix}_${0}`, previewUrl, format)
							);
							newWidget.parent = node;
						}

						const onRemoved = node.onRemoved;
						node.onRemoved = () => {
							cleanupNode(node);
							return onRemoved?.();
						};
						node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]]);
					}

					const originalCallback = node.callback;
					mediaWidget.callback = (message) => {
						createMediaPreview();
						return originalCallback ? originalCallback.apply(node, message) : undefined;
					};

				};
				break;
			};
		}
	}
}

app.registerExtension(mediaPreview)
