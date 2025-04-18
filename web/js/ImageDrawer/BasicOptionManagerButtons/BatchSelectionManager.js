import { $el } from "/scripts/ui.js";

import { ContextModel } from "../Contexts.js";

import { ClassInstanceFactory } from "../Core/ImageDrawerModule.js";

import { BatchOptionManagerButton } from "./BatchOptionManagerButton.js";

class BatchSelectionManager extends BatchOptionManagerButton {

    constructor(args) {

        super(args);

        this.selectionCheckbox = null;
        this.countText = null;

        this.lastCheckedItemCount = {};

        this.onCheckedItemCountUpdatedMulticastFunctions = [];
    }

    makeWidget() {

        const superWidget = super.makeWidget();

        {
            this.selectionCheckbox = $el("input.JNodes-image-drawer-menu-selection-manager-checkbox", {
                title: "Toggle select/deselect all",
                type: "checkbox",
                checked: false,
                style: {
                    pointerEvents: "none"
                }
            });
            superWidget.button.appendChild(this.selectionCheckbox);
        }

        {
            this.countText = $el("label", {
                textContent: "(0)",
                style: {
                    color: "white",
                    pointerEvents: "none"
                }
            });
            superWidget.button.appendChild(this.countText)
        }

        this.updateWidget();

        // Subscribe to imageList Changes
        const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
        imageDrawerListInstance.registerStartChangingImageListMulticastFunction(() => {

            this.lastCheckedItemCount = { selectedCount: 0, totalItems: 0 };
    
            this.notifyCheckedItemCountUpdatedMulticastDelegate();

            const bUpdateCount = false;
            this.updateWidget(bUpdateCount);
        });
        imageDrawerListInstance.registerFinishChangingImageListMulticastFunction(() => {

            this.updateWidget();
        });

        return superWidget;
    }

    onClickButton() {

        const counts = this.countCheckedItems();

        let bNewCheckedState = true; // Default to select all

        if (counts.selectedCount == counts.totalItems) {

            // Deselect all
            bNewCheckedState = false;
        }

        this.setSelectedStateOnAll(bNewCheckedState);
    }

    setSelectedStateOnAll(bNewCheckedState) {

        const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
        const listChildren = imageDrawerListInstance.getImageListChildren();

        for (const child of listChildren) {
            if (child.setSelected) {
                child.setSelected(bNewCheckedState, false); // Don't update this widget after each item, update it after all selections are changed
            }
        }

        this.updateWidget();
    }

    getValidSelectedItems() {

        const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
        const listChildren = imageDrawerListInstance.getVisibleImageListChildren();

        // Count up selected items in the current view
        let selectedItems = [];
        for (const child of listChildren) {
            if (child.bIsCheckboxSelectorChecked && child.bIsCheckboxSelectorChecked == true) {
                selectedItems.push(child);
            }
        }

        return selectedItems;
    }

    countCheckedItems() {

        const imageDrawerListInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerList");
        const listChildren = imageDrawerListInstance.getVisibleImageListChildren();

        const selectedCount = this.getValidSelectedItems().length;

        this.lastCheckedItemCount = { selectedCount: selectedCount, totalItems: listChildren.length };

        this.notifyCheckedItemCountUpdatedMulticastDelegate();

        return this.lastCheckedItemCount;
    }


    registerCheckedItemCountUpdatedMulticastFunction(inFunction) {
        if (typeof inFunction == "function") {
            this.onCheckedItemCountUpdatedMulticastFunctions.push(inFunction);
        }
    }

    notifyCheckedItemCountUpdatedMulticastDelegate() {

        // Filter out invalid delegates
        this.onCheckedItemCountUpdatedMulticastFunctions = this.onCheckedItemCountUpdatedMulticastFunctions.filter(func => func !== null && func !== undefined);

        for (const func of this.onCheckedItemCountUpdatedMulticastFunctions) {
            func(this.lastCheckedItemCount);
        }
    }

    updateWidget(bUpdateCount = true) {

        if (bUpdateCount) {
            this.countCheckedItems();
        }

        // Set widget visibilities and text

        this.selectionCheckbox.indeterminate = false;

        if (this.lastCheckedItemCount.selectedCount == 0) {

            this.selectionCheckbox.checked = false;

        } else if (this.lastCheckedItemCount.selectedCount == this.lastCheckedItemCount.totalItems) {

            this.selectionCheckbox.checked = true;

        } else { // selectedCount < listChildren.length or perhaps some kind of computer rogue state

            this.selectionCheckbox.indeterminate = true;
        }

        this.countText.textContent = `(${this.lastCheckedItemCount.selectedCount}/${this.lastCheckedItemCount.totalItems})`;

        // Hide selector for model contexts as it's not currently implemented
        const imageDrawerContextSelectorInstance = this.imageDrawerInstance.getComponentByName("ImageDrawerContextSelector");
		const currentContext = imageDrawerContextSelectorInstance.getCurrentContextObject();
        const bIsContextModel = currentContext instanceof ContextModel;

        this.setWidgetVisible(!bIsContextModel);
    }
}

const factoryInstance = new ClassInstanceFactory(BatchSelectionManager, {
    tooltipText: "Toggle select/deselect all", buttonClass: "JNodes-image-drawer-menu-selection-manager-button"
});