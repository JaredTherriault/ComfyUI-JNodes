
import { $el } from "/scripts/ui.js";

import { BatchOptionManagerButton } from "./BatchOptionManagerButton.js";

import { utilitiesInstance } from "../../common/Utilities.js";
import { ClassInstanceFactory, imageDrawerComponentManagerInstance } from "../Core/ImageDrawerModule.js";

class BatchFavouriteManager extends BatchOptionManagerButton {

    constructor(args) {

        super(args);

        this.bConfirmState = false;

        this.confirmText = null;
    }

    makeWidget() {

        const superWidget = super.makeWidget();

        {
            const icon = $el("label", {
                textContent: "⭐",
                style: {
                    color: "white",
                    fontWeight: "bolder",
                    pointerEvents: "none"
                }
            });
            superWidget.button.appendChild(icon);
        }

        {
            this.confirmText = $el("label", {
                textContent: "Confirm?",
                style: {
                    color: "white",
                    pointerEvents: "none",
                    display: "none"
                }
            });
            superWidget.button.appendChild(this.confirmText);
        }

        // Subscribe to when the selection manager's count is updated
        const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
        batchSelectionManagerInstance.registerCheckedItemCountUpdatedMulticastFunction(() => {

            const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
            let lastCheckedItemCount = batchSelectionManagerInstance.lastCheckedItemCount;

            if (Object.keys(lastCheckedItemCount).length == 0) {
                lastCheckedItemCount = batchSelectionManagerInstance.countCheckedItems();
            }

            this.setWidgetVisible(lastCheckedItemCount.selectedCount > 0);
        });

        this.setWidgetVisible();

        return superWidget;
    }

    onClickButton() {

        if (!this.bConfirmState) {

            this.setConfirmState(true);

        } else {

            const imageDrawerContextSelectorInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerContextSelector");
            const currentContextObject = imageDrawerContextSelectorInstance.getCurrentContextObject();
            if (currentContextObject) {
                currentContextObject.onRequestBatchFavourite();

                // Deselect All
                const batchSelectionManagerInstance = imageDrawerComponentManagerInstance.getComponentByName("BatchSelectionManager");
                batchSelectionManagerInstance.setSelectedStateOnAll(false);
            }
        }
    }

    setWidgetVisible(bNewVisibile) {

        this.setConfirmState(false);
        super.setWidgetVisible(bNewVisibile);
    }

    setConfirmState(bNewConfirmState) {

        this.bConfirmState = bNewConfirmState;
        utilitiesInstance.setElementVisible(this.confirmText, this.bConfirmState);
    }
}

const factoryInstance = new ClassInstanceFactory(BatchFavouriteManager, {
    tooltipText: "Copy all visible selected items to Favourites directory (defined in Settings > JNodes Settings)", buttonClass: "JNodes-image-drawer-menu-favourite-selected-button"
});