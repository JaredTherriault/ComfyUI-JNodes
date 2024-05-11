import { app } from "/scripts/app.js";
import { api } from '/scripts/api.js';
import { ComfyWidgets } from "/scripts/widgets.js";
import { AcceptableFileTypes } from "./VideoPreview.js";
import { utilitiesInstance } from "../common/Utilities.js";

function mediaUpload(node, inputName, inputData, app) {
	const mediaWidget = node.widgets.find((w) => w.name === "media");
	const typeWidget = node.widgets.find((w) => w.name === "upload_to_directory");
	let uploadWidget;

	//console.log(mediaWidget);

	// Clear widget value if temp since it didn't survive the relaunch
	if (mediaWidget.value != undefined && mediaWidget.value.startsWith("temp/")) {
		mediaWidget.value = "";
	}

	var default_value = mediaWidget.value;
	Object.defineProperty(mediaWidget, "value", {
		set: function (value) {
			this._real_value = value;
		},

		get: function () {
			let value = "";
			if (this._real_value) {
				value = this._real_value;
			} else {
				return default_value;
			}

			if (value.filename) {
				let real_value = value;
				value = "";
				if (real_value.subfolder) {
					value = real_value.subfolder + "/";
				}

				value += real_value.filename;

				if (real_value.type && real_value.type !== "input")
					value += ` [${real_value.type}]`;
			}
			return value;
		}
	});
	// Restricted to 100MB or so
	async function uploadFile(file, bUpdateMediaWidget) {
		try {
			// Wrap file in formdata so it includes filename
			const body = new FormData();
			body.append("image", file);
			body.append("type", typeWidget.value);
			body.append("subfolder", "upload_media");
			body.append("filename", file.filename || '');
			const resp = await api.fetchApi("/jnodes_upload_image", {
				method: "POST",
				body, 
				cache: "no-store"
			});

			if (resp.status === 200) {
				const data = await resp.json();
				// Add the file to the dropdown list and update the widget value
				let path = data.name;
				if (data.subfolder) path = data.subfolder + "/" + path;
				if (data.type) path = data.type + "/" + path;

				updateNode(path, bUpdateMediaWidget);
			} else {
				alert(resp.status + " - " + resp.statusText);
			}
		} catch (error) {
			alert(error);
		}
	}
	async function updateNode(path, bUpdateMediaWidget, jnodesPayload = null) {
		try {
			// Add the file to the dropdown list and update the widget value
			if (!mediaWidget.options.values.includes(path)) {
				mediaWidget.options.values.push(path);
			}

			if (bUpdateMediaWidget) {
				mediaWidget.value = path;
				mediaWidget.callback(path, jnodesPayload); // Update media container
			}

			// Remove metadata text widget


			return true;

		} catch (error) {
			alert(error);
			return false;
		}
	}

	const fileInput = document.createElement("input");
	Object.assign(fileInput, {
		type: "file",
		accept: AcceptableFileTypes.join(","),
		style: "display: none",
		onchange: async () => {
			if (fileInput.files.length) {
				await uploadFile(fileInput.files[0], true);
			}
		},
	});
	document.body.append(fileInput);

	// Create the button widget for selecting the files
	uploadWidget = node.addWidget("button", "choose file or drag and drop", "media", () => {
		fileInput.click();
	});
	uploadWidget.serialize = false;

	// Add handler to check if a media is being dragged over our node
	node.onDragOver = function (e) {

		// Since firefox doesn't give us access to the dragged items if they originate from the page itself, 
		// we have no way to know what's being dragged. So we just return true to allow dropping from the drawer.
		return true;
	};

	// On drop upload files
	node.onDragDrop = async function (e) {
		if (e.dataTransfer) {

			function conditionallyUploadFile(file) {
				if (AcceptableFileTypes.includes(file.type)) {
					const bUpdateMediaWidget = true;
					uploadFile(file, bUpdateMediaWidget); // Just upload the very first matching object in the payload
					return true;
				}

				return false;
			}

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				return conditionallyUploadFile(e.dataTransfer.files[0]); // If there's a file just return the first one uploaded
			} else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) { // If no files look in items

				let filenameItem;
				let fileUrlItem;

				for (const item of e.dataTransfer.items) {

					if (item.kind == 'file') { // items can have its own 'file' kind

						const file = item.getAsFile();

						if (file) {
							return conditionallyUploadFile(file); // Early out if 'file' kind
						} else {
							console.error("Error getting file from dropped item.");
						}

					} else if (item.type == 'text/jnodes_image_drawer_payload') { // a payload specific to media from the drawer

						let bSuccessfulLoad = false;

						// Create a promise to encapsulate the asynchronous operation
						const loadItemAsString = (item) => {
							return new Promise((resolve, reject) => {
								item.getAsString((value) => {
									if (value) {
										try {
											const jnodesPayload = JSON.parse(value);
											let path = jnodesPayload.filename;
											if (jnodesPayload.subdirectory) { path = jnodesPayload.subdirectory + "/" + path; }
											if (jnodesPayload.type) { path = jnodesPayload.type + "/" + path; }

											const bUpdateMediaWidget = true;
											const bSuccess = updateNode(path, bUpdateMediaWidget, jnodesPayload);

											// Resolve the promise with the result of updateNode()
											resolve(bSuccess);
										} catch (e) {
											console.error(`Error getting file from dropped item: ${e}`);
											// Reject the promise in case of an error
											reject(e);
										}
									} else {
										// Resolve with false if value is empty
										resolve(false);
									}
								});
							});
						};

						// Wait for the return of the Promise
						await loadItemAsString(item)
							.then((success) => {
								bSuccessfulLoad = success;
							})
							.catch((error) => {
								console.error('Error loading item as string:', error);
							});

						if (bSuccessfulLoad) {
							return true; // Early out for jnodes_image_drawer_payload
						}

					} else if (item.type == 'application/x-moz-file-promise-url') { // Firefox specific pair fallback

						if (!fileUrlItem) { fileUrlItem = item; }

					} else if (item.type == 'application/x-moz-file-promise-dest-filename') { // Firefox specific pair fallback

						if (!filenameItem) { filenameItem = item; }

					}
				}

				// Manually get filename and load file (Mozilla) if 
				if (fileUrlItem) {

					let filename;

					if (filenameItem) {
						await filenameItem.getAsString(async (value) => {
							if (value) { filename = value; }
						});
					}

					fileUrlItem.getAsString(async (value) => {
						let file = await utilitiesInstance.loadFileFromURL(value);

						if (!filename) {
							// Set filename from url maybe
							filename = `${Math.random()}.${file.type.split('/')[1]}`;
						}

						file.filename = filename;

						if (file) {
							return conditionallyUploadFile(file);
						} else {
							console.error("Error getting file from dropped item.");
						}
					});
				}
			}
		}

		return false;
	};

	return { widget: uploadWidget };
}

ComfyWidgets.MEDIAUPLOAD = mediaUpload;

app.registerExtension({
	name: "JNodes.UploadVisualMedia",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		switch (nodeData?.name) {
			case 'JNodes_UploadVisualMedia': {
				nodeData.input.required.upload = ["MEDIAUPLOAD"];
				break;
			}
		}
	}
});