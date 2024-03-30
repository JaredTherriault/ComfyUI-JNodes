import { $el } from "/scripts/ui.js";
import { app } from "/scripts/app.js";

var underButtonContent;

// A class that saves and loads its given value via localStorage automatically. 
// Use it for any setting that should have its data saved.
export class ConfigSetting {
    constructor(settingName, defaultValue) {
        this._settingName = settingName;
        this._defaultValue = defaultValue;
        this._onChange = () => { }; // Default callback function
    }

    // Getter method
    get value() {
        return this.getValue(this._settingName, this._defaultValue);
    }

    // Setter method
    set value(newValue) {
        this.setValue(this._settingName, newValue);
        this._onChange(newValue); // Call the callback function when value changes
    }

    // Method to set the callback function
    setOnChange(callback) {
        this._onChange = callback;
    }

    // localStorage
    getValue(name, defaultValue) {
        const val = localStorage.getItem("JNodes.Settings." + name);
        //console.log("localstorage (" + name + " : " + val + ")");
        if (val !== null) {
            try { // Try to parse the value automatically, and if we can't then just return the string
                return JSON.parse(val);
            } catch (error) {
                return val;
            }
        }
        //console.log("return defaultValue");
        return defaultValue;
    };

    setValue(name, val) {
        localStorage.setItem("JNodes.Settings." + name, val);
    };

    // Usage Example

    // Create an instance of the Observable class
    //   const mySetting = new ConfigSetting();

    // Set the onChange callback function
    //   mySetting.setOnChange((newValue) => {
    //     console.log(`Value changed to: ${newValue}`);
    //   });

    // Change the value, which triggers the callback function
    //   mySetting.value = 10;
}


function createExpandableSettingsArea() {

    const nameWidget = $el("label", {
        textContent: "JNodes Settings ",
    });

    const toggleButton = document.createElement('button');
    toggleButton.textContent = '►';
    toggleButton.classList.add('toggle-btn');

    underButtonContent = $el('div', {
        style: {
            id: 'under-button-content',
            textAlign: 'center',
            margin: 'auto',
            width: '100%',
            display: 'table',
            visibility: 'collapse'
        }
    });

    // Add click event listener to toggle button
    toggleButton.addEventListener('click', function () {
        const bIsCollapsed = underButtonContent.style.visibility === 'collapse';

        // Toggle content display
        underButtonContent.style.visibility =
            bIsCollapsed ? 'visible' : 'collapse';

        // Toggle button arrow orientation
        toggleButton.textContent = bIsCollapsed ? '▼' : '►';
    });

    app.ui.settings.addSetting({
        id: "JNodes.SettingsContainer",
        name: "JNodes Settings Container",
        type: () => {
            return $el("tr", {
                style: {
                    width: "100%",
                }
            }, [
                $el("td", {
                    colSpan: '2',
                }, [
                    $el("div", {
                        style: {
                            textAlign: 'center',
                            margin: 'auto',
                            width: '100%',
                        },
                    }, [nameWidget, toggleButton]), underButtonContent
                ]),
            ]);
        },
    });
}

export function addJNodesSetting(nameWidget, settingWidget, tooltip) {
    if (!underButtonContent) {
        createExpandableSettingsArea();
    }

    function sortTable() {
        const rows = Array.from(underButtonContent.children);

        // Sort the rows based on the text in the left cell
        rows.sort((a, b) => {
            const textA = a.children[0].textContent.trim().toLowerCase();
            const textB = b.children[0].textContent.trim().toLowerCase();
            return textA.localeCompare(textB);
        });

        underButtonContent.innerHTML = '';

        // Update the table with the sorted rows
        rows.forEach(row => underButtonContent.appendChild(row));
    }

    let title = tooltip ? tooltip.toString() : '';
    nameWidget.title = nameWidget.title ? nameWidget.title : title;
    settingWidget.title = settingWidget.title ? settingWidget.title : title;

    underButtonContent.appendChild(
        $el("tr", [
            $el("td", {
                style: {
                    verticalAlign: "middle",
                }
            }, [
                nameWidget ? nameWidget : $el("div")
            ]),
            $el("td", {
                style: {
                    verticalAlign: "middle",
                    textAlign: "left",
                }
            }, [
                settingWidget ? settingWidget : $el("div")
            ])
        ])
    );

    sortTable();
}