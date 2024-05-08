
import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../../common/Utilities.js";

import { ImageDrawerComponent } from "../Core/ImageDrawerModule.js";

export class BatchOptionManagerButton extends ImageDrawerComponent {

    constructor(args) {

		super(args);

        this.container = null;
        this.button = null;

        this.tooltipText = args.tooltipText || null;
        this.buttonClass = args.buttonClass || null;
        this.containerClass = args.containerClass || null;
    }

    makeWidget() {

        this.container = $el(`div.${this.containerClass ? this.containerClass : (this.buttonClass + "-container")}`, {
            style: {
                pointerEvents: "none"
            }
        });

        {
            this.button = $el(`button.${this.buttonClass}`, {
                title: this.tooltipText,
                style: {
                    display: "flex",
                    flexDirection: "row",
                    gap: "4px",
                    padding: "2px 6px",
                    borderRadius: '10px',
                    justifyContent: 'center',
                    background: "rgba(0,0,0,0.5)",
                    border: "none",
                    cursor: 'pointer',
                    pointerEvents: "all"
                }
            });
            this.button.classList.add("JNodes-interactive-container");

            // Add click event listener to button
            this.button.addEventListener('click', () => {
                this.onClickButton();
            });
            this.container.appendChild(this.button);
        }

        return {container: this.container, button: this.button};
    }

    onClickButton() {}

    setWidgetVisible(bNewVisibile) {
        utilitiesInstance.setElementVisible(this.container, bNewVisibile);
    }
}
