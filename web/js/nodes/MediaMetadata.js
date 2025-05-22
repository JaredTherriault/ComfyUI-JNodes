import { app } from '/scripts/app.js'
import ExifReader from '../common/ExifReader-main/src/exif-reader.js';

export function getVideoMetadata(file, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const decoder = new TextDecoder();

        // Timeout fallback
        const timeout = setTimeout(() => {
            console.warn("getVideoMetadata: timeout");
            resolve(null); // or reject(new Error("Timeout")); if you prefer
        }, timeoutMs);

        reader.onload = (event) => {
            try {
                const videoData = new Uint8Array(event.target.result);
                const dataView = new DataView(videoData.buffer);

                // WEBM
                if (dataView.getUint32(0) === 0x1A45DFA3) {
                    let offset = 4 + 8;
                    while (offset < videoData.length - 16) {
                        if (dataView.getUint16(offset) === 0x4487) {
                            const name = String.fromCharCode(...videoData.slice(offset - 7, offset));
                            if (name === "COMMENT") {
                                let vint = dataView.getUint32(offset + 2);
                                let n_octets = Math.clz32(vint) + 1;
                                if (n_octets < 4) {
                                    let length = (vint >> (8 * (4 - n_octets))) & ~(1 << (7 * n_octets));
                                    const content = decoder.decode(videoData.slice(offset + 2 + n_octets, offset + 2 + n_octets + length));
                                    const json = JSON.parse(content);
                                    clearTimeout(timeout);
                                    resolve(json);
                                    return;
                                }
                            }
                        }
                        offset += 1;
                    }
                }

                // MP4
                if (dataView.getUint32(4) === 0x66747970 && dataView.getUint32(8) === 0x69736F6D) {
                    let offset = videoData.length - 4;
                    while (offset > 16) {
                        if (dataView.getUint32(offset) === 0x64617461) {
                            if (dataView.getUint32(offset - 8) === 0xa9636d74) {
                                let size = dataView.getUint32(offset - 4) - 4 * 4;
                                const content = decoder.decode(videoData.slice(offset + 12, offset + 12 + size));
                                const json = JSON.parse(content);
                                clearTimeout(timeout);
                                resolve(json);
                                return;
                            }
                        }
                        offset -= 1;
                    }
                }

                // No known format matched
                console.warn("getVideoMetadata: unsupported format");
                clearTimeout(timeout);
                resolve(null);
            } catch (err) {
                console.error("getVideoMetadata: error", err);
                clearTimeout(timeout);
                reject(err);
            }
        };

        reader.onerror = (err) => {
            clearTimeout(timeout);
            reject(err);
        };

        reader.readAsArrayBuffer(file);
    });
}

export function isVideoFile(file) {
    const testString = file?.name || file.type;
    if (testString?.endsWith("webm")) {
        return true;
    }
    if (testString?.endsWith("mp4")) {
        return true;
    }
    if (testString?.endsWith("ogg")) {
        return true;
    }

    return false;
}

async function handleFile(file) {

    let bShouldCallOriginal = true;

    if (file?.type?.startsWith("video/") || isVideoFile(file)) {
        const videoInfo = await getVideoMetadata(file);
        if (videoInfo) {
            if (videoInfo.workflow) {

                app.loadGraphData(videoInfo.workflow);
                bShouldCallOriginal = false;
            }
            //Potentially check for/parse A1111 metadata here.
        }
    } else if (file?.type?.endsWith("/webp")) {
        const webpArrayBuffer = await file.arrayBuffer();

        // Use the exif library to extract Exif data
        const exifData = ExifReader.load(webpArrayBuffer);
        //console.log("exif: " + JSON.stringify(exifData));

        const exif = exifData['UserComment'];

        if (exif) {

            // Convert the byte array to a Uint16Array
            const uint16Array = new Uint16Array(exif.value);

            // Create a TextDecoder for UTF-16 little-endian
            const textDecoder = new TextDecoder('utf-16le');

            // Decode the Uint16Array to a string
            const decodedString = textDecoder.decode(uint16Array);

            // Remove null characters
            const cleanedString = decodedString.replace(/\u0000/g, '');
            const jsonReadyString = cleanedString.replace("UNICODE", "")

            try {

                let metadata = JSON.parse(jsonReadyString);

                if (metadata?.workflow) {

                    let workflow = metadata.workflow;

                    if (typeof workflow === "string") {
                        workflow = JSON.parse(workflow);
                    }

                    app.loadGraphData(workflow);

                    bShouldCallOriginal = false;
                }
            } catch (error) {

                console.log(`${error} (${file.name})`);
            }
        }
    } 

    if (bShouldCallOriginal && app.originalHandleFile) {
        await app.originalHandleFile(file);
    }
}

// We need this, but if it's already been done by VHS, don't do it second time or it'll mean infinite recursion
if (!app.originalHandleFile) {
    //Storing the original function in app is probably a major no-no
    //But it's the only way I've found to keep the 'this' reference
    app.originalHandleFile = app.handleFile;
    app.handleFile = handleFile;
}

//hijack comfy-file-input to allow webm/mp4
document.getElementById("comfy-file-input").accept += ",video/webm,video/mp4";
