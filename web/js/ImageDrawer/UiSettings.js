import { $el } from "/scripts/ui.js";

import { ConfigSetting, addJNodesSetting } from "../common/SettingsManager.js";
import { options_VideoPlayback } from "../common/VideoOptions.js";

export const defaultKeyList = "prompt, workflow";

export class ImageDrawerConfigSetting extends ConfigSetting {
    constructor(settingName, defaultValue) {
        super("ImageDrawer." + settingName, defaultValue);
    }
}

export let setting_bEnabled = new ImageDrawerConfigSetting("bEnabled", true);
export let setting_bMasterVisibility = new ImageDrawerConfigSetting("bMasterVisibility", true);
export let setting_DrawerAnchor = new ImageDrawerConfigSetting("DrawerAnchor", "top-left");

export let setting_KeyList = new ImageDrawerConfigSetting("ImageVideo.KeyList", defaultKeyList);
export let setting_bKeyListAllowDenyToggle = new ImageDrawerConfigSetting("ImageVideo.bKeyListAllowDenyToggle", false);

export let setting_ModelCardAspectRatio = new ImageDrawerConfigSetting("Models.AspectRatio", 0.67);

export let setting_VideoPlaybackOptions = new ImageDrawerConfigSetting("Video.VideoOptions", new options_VideoPlayback);

// A script governing the settings added to the ComfyUI menu and other UI elements

// Button setup

// A button shown in the comfy modal to show the drawer after it's been hidden
const showButton = $el("button.comfy-settings-btn", {
    textContent: "🖼️",
    style: {
        right: "16px",
        cursor: "pointer",
        display: "none",
    },
});
showButton.onclick = () => {
    imageDrawer.style.display = "block";
    showButton.style.display = "none";
    setting_bMasterVisibility.value = true;
};
document.querySelector(".comfy-settings-btn").after(showButton);

export const setupUiSettings = (onDrawerAnchorInput) => {
    // Enable/disable
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Enabled:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bEnabled.value,
                oninput: (e) => {
                    setting_bEnabled.value = e.target.value;
                },
            },
        );

        const tooltip = "Whether or not the image drawer is initialized (requires page reload)";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }
    // Drawer location
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Anchor:",
        });

        const settingWidget = createDrawerSelectionWidget(onDrawerAnchorInput);            

        const tooltip = "To which part of the screen the drawer should be docked";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Mouse over image/video key allow/deny list
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Image & Video Key List:",
        });

        const settingWidget = $el(
            "input",
            {
                defaultValue: setting_KeyList.value,
                oninput: (e) => {
                    setting_KeyList.value = e.target.value;
                },
            },
        );

        const tooltip = "A set of comma-separated names to include or exclude " +
            "from the tooltips applied to images in the drawer";
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }

    // Mouse over image/video key allow/deny list toggle
    {
        const labelWidget = $el("label", {
            textContent: "Image Drawer Image & Video Key List Allow/Deny Toggle:",
        });

        const settingWidget = $el(
            "input",
            {
                type: "checkbox",
                checked: setting_bKeyListAllowDenyToggle.value,
                oninput: (e) => {
                    setting_bKeyListAllowDenyToggle.value = e.target.value;
                },
            },
        );

        const tooltip = `Whether the terms listed in the Key List should be 
		denied or allowed, excluding everything else.
		True = Allow list, False = Deny list.`
        addJNodesSetting(labelWidget, settingWidget, tooltip);
    }
};

export function createDrawerSelectionWidget(onInput) {
    return $el("select", {
        oninput: onInput,
    },
        ["top-left", "top-right", "bottom-left", "bottom-right"].map((m) =>
            $el("option", {
                value: m,
                textContent: m,
                selected: setting_DrawerAnchor.value === m,
            })
        )
    );
}