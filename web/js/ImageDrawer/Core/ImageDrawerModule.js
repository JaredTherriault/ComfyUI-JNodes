import { app } from "/scripts/app.js";

/*
    The idea is to have a central place for all classes to be able to access other classes without circular dependency issues.
    Each participating class will need to inherit from ImageDrawerComponent. Its owning script will need to keep an instance of a ClassInstanceFactory,
    one for each participating class. For example, in ImageDrawer.js with 'import { ImageDrawerComponent, ClassInstanceFactory } from "./Core/ImageDrawerModule.js";':

        class ImageDrawerMain extends ImageDrawerComponent {

            constructor(args) {

                super(args);

                // Other ImageDrawer class stuff
            }
        }

        ...

        const factoryInstance = new ClassInstanceFactory(ImageDrawer);

    The ClassInstanceFactory instance registers itself with the Module automatically, but does not create an instance of the component class it governs yet.

    When the user wants to access a component, they just 'import { imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";' and call, for example:

        const imageDrawerMainInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerMain", this.drawerInstanceIndex);

    This returns an instance of the ImageDrawer class for the given caller's same drawerInstanceIndex, as there may be many instances of the drawer widget.
    This assumes the calling class is also a ImageDrawerComponent. If not, 'this.drawerInstanceIndex' may be omitted from the call, assuming there is only on drawer widget instance.
    It is best to call getComponentByName() inside of a function, similar to functional programming paradigms. This ensures the instance is not created if not necessary.

    getComponentByName() will check drawerInstanceToComponentMap at the given drawerInstanceIndex for an existing instance of the component with the given name, i.e. "ImageDrawerMain".
    If it doesn't find an instance, it will lookup the registered ClassInstanceFactory with the given name and call makeInstance() on it, then the instance will automatically
    register itself with the module so next time getComponentByName() is called, it will just return the instance that was created earlier.

    This ensures not only that script instances are created on-demand and don't take up memory when never used, but also that any class can reference any other class without a hard
    reference to that class, thus pre-empting the possibility of circular dependency.

    Pros of this approach include:
        -Circular dependency issues become impossible
        -Imports are much cleaner
        -Scripts are only instantiated when needed, thus saving on memory
        -Easily extensible for end-user plugin creation

    Cons of this approach include:
        -Possibility of a component class's name being changed, thus breaking all getComponentByName() calls to that component unless manually updated
        -Participating classes need some boilerplate to create and to reference
        -Startup may take longer as we wait for ClassInstanceFactory instances to register themselves
*/

class ImageDrawerComponentManager {

    constructor() {
        this.classInstanceFactories = [];
        this.drawerInstanceToComponentMap = {}; // Drawer instance index mapped to a set of registered components
    }

    registerClassInstanceFactory(factory) {
        this.classInstanceFactories.push(factory);
    }

    _getClassInstanceFactoryByName(name) {
        const foundFactory = this.classInstanceFactories.find(
            (factory) => factory.name === name);

        if (foundFactory) {
            return foundFactory;
        }

        return null;
    }

    _getOrInitComponentArrayByDrawerIndex(drawerInstanceIndex) {
        if (!this.drawerInstanceToComponentMap[drawerInstanceIndex]) {
            this.drawerInstanceToComponentMap[drawerInstanceIndex] = [];
        }

        return this.drawerInstanceToComponentMap[drawerInstanceIndex];
    }

    registerComponent(component, drawerInstanceIndex = 0) {

        this._getOrInitComponentArrayByDrawerIndex(drawerInstanceIndex).push(component);
    }

    getComponentByName(name, drawerInstanceIndex = 0) {
        let foundComponent = this._getOrInitComponentArrayByDrawerIndex(drawerInstanceIndex).find(
            (component) => component.name === name);

        if (!foundComponent) {
            const foundFactory = this._getClassInstanceFactoryByName(name);

            if (foundFactory) {
                foundComponent = foundFactory.makeInstance(drawerInstanceIndex);
            }
        }

        return foundComponent;
    }

    async setup() {
        const imageDrawerMainInstance = this.getComponentByName("ImageDrawerMain");

        if (imageDrawerMainInstance) {
            await imageDrawerMainInstance.setup();
        } else {
            throw ("imageDrawerMainInstance never registered!");
        }
    }
};

export const imageDrawerComponentManagerInstance = new ImageDrawerComponentManager();

export class ImageDrawerComponent {

    constructor(args) {

        this.name = args.name;
        this.drawerInstanceIndex = args.drawerInstanceIndex || 0;

        imageDrawerComponentManagerInstance.registerComponent(this, this.drawerInstanceIndex);
    }
}

export class ClassInstanceFactory {

    constructor(managedComponentClass, args = {}) {

        if (!managedComponentClass) {
            throw("ClassInstanceFactory initialized without a managedComponentClass!");
        }
        
        this.managedComponentClass = managedComponentClass;
        this.name = managedComponentClass.name;
        this.scriptArgs = args;
        this.scriptArgs.name = this.name;

        imageDrawerComponentManagerInstance.registerClassInstanceFactory(this);
    }

    makeInstance(drawerInstanceIndex = 0) {
        this.scriptArgs.drawerInstanceIndex = drawerInstanceIndex;
        const newComponentInstance = new this.managedComponentClass(this.scriptArgs); // Will be automatically registered
        return newComponentInstance;
    }
}

app.registerExtension({
    name: "JNodes.ImageDrawer",
    async setup() {
        await imageDrawerComponentManagerInstance.setup();
    }
});