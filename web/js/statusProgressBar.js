import { api } from "../../../scripts/api.js";
import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { getValue, setValue,addJNodesSetting } from "./common/utils.js"

// Simple script that adds the current queue size to the window title
// Adds a favicon that changes color while active and a percentage complete of the current job
// And adds a progress bar to the comfy menu

// Thank you to pythongsssss and Kijai on discord for lighting the way toward this functionality!

var progressBar;
var progressBarContainer;

app.registerExtension({
	name: "JNodes.StatusProgressBar",
	async setup() {

		const featureName = "StatusIndicators.ProgressBar.";

		// localStorage accessors
		const getVal = (n, d) => {
			return getValue(featureName + n, d);
		};

		const saveVal = (n, v) => {
			setValue(featureName + n, v);
		};

		const labelWidget = $el("label", {
			textContent: "Show Progress Bar Above menu:",
		});

		const settingWidget = $el("input", {
			type: "checkbox",
			checked: getVal("Enabled", true),
			onchange: (e) => {
				saveVal("Enabled", e.target.checked);

				if (e.target.checked) {
					setup();
				} else {
					teardown();
				}
			},
		});

		addJNodesSetting(labelWidget, settingWidget);

		function createProgressBar() {
			const menu = document.querySelector(".comfy-menu");

			progressBar = $el("div", {
				id: "progressBar",
				style: {
					transition: 'width 0.25s',
					width: '0%',
					height: '100%',
					clipPath: 'inset(0)',
					background: "green",
					marginTop: '0',
					marginLeft: '0',
					marginRight: '0',
					marginBottom: '0h',
				}
			});

			progressBarContainer = $el("div", {
				id: "progressBarContainer",
				style: {
					width: '100%',
					height: '0.5vh',
					display: 'flex',
					marginTop: '0',
					marginLeft: '0.1vh',
					marginRight: '0.1vh',
					marginBottom: '0.5vh',
				}
			}, [
				progressBar
			]
			);

			menu.prepend(progressBarContainer);
		}

		function removeProgressBar() {
			if (progressBarContainer) {
				const menu = document.querySelector(".comfy-menu");

				menu.removeChild(progressBarContainer);
			}
		}

		function updateProgressBar(progress) {
			if (getVal("Enabled", true) && progressBar) {
				progressBar.style.width = `${progress}%`;
			}
		}

		function addListeners() {
			api.addEventListener("progress", ({ detail }) => {
				if (getVal("Enabled", true)) {
					const { value, max } = detail;
					const progress = Math.floor((value / max) * 100);

					if (!isNaN(progress)) {
						updateProgressBar(progress);
					}
				}
			});

			api.addEventListener("executed", async ({ detail }) => {
				updateProgressBar(0);
			});
		}

		function setup() {
			createProgressBar();
			addListeners();
		}

		function teardown() {
			removeProgressBar();
		}

		const bShouldSetup = getVal("Enabled", true);
		if (bShouldSetup) {
			setup();
		}
	},
});
