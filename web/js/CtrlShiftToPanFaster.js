import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "JNodes.CtrlShiftToPanFaster",
    init() {
        const panSpeedFactor = 10;
        let last_mouse = [0, 0];

        function processMouseMove(event) {
            var mouse = [event.clientX, event.clientY];
            var delta = [
                (mouse[0] - last_mouse[0]) * panSpeedFactor,
                (mouse[1] - last_mouse[1]) * panSpeedFactor
            ];
            last_mouse = mouse;

            if (event.shiftKey && event.ctrlKey) {

                var LiteGraphInstance = window?.LiteGraph;
                var canvas = LiteGraphInstance?.LGraphCanvas?.active_canvas;

                if (canvas && canvas.ds) {
                    canvas.ds.offset[0] += delta[0] / canvas.ds.scale;
                    canvas.ds.offset[1] += delta[1] / canvas.ds.scale;
                    canvas.dirty_canvas = true;
                    canvas.dirty_bgcanvas = true;
                }
            }
        }

        document.addEventListener("mousemove", processMouseMove);
        document.addEventListener("mouseup", (event) => {last_mouse = [event.clientX, event.clientY];});
    }
});