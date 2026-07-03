// Extracts embedded metadata (JSON) from video files by parsing WEBM and MP4 binary structures.
// Also reads EXIF data from images using the bundled ExifReader library.

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
                const metadata = {};

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
                    // Pass 1: backward scan for ©cmt atom — old-style videos store
                    // the entire metadata object as JSON inside this atom.
                    let offset = videoData.length - 4;
                    while (offset > 16) {
                        if (dataView.getUint32(offset) === 0x64617461) {
                            if (dataView.getUint32(offset - 8) === 0xa9636d74) {
                                let size = dataView.getUint32(offset - 4) - 4 * 4;
                                const content = decoder.decode(videoData.slice(offset + 12, offset + 12 + size));
                                try {
                                    Object.assign(metadata, JSON.parse(content));
                                } catch {
                                    // not JSON, ignore
                                }
                                break;
                            }
                        }
                        offset -= 1;
                    }

                    // Pass 2: mdta format (use_metadata_tags) — keys atom maps
                    // 1-based indices to key names, ilst items use numeric indices.
                    // Only run if Pass 1 found nothing.
                    if (Object.keys(metadata).length === 0) {
                        function mp4TypeStr(u32) {
                            return String.fromCharCode(
                                (u32 >> 24) & 0xFF, (u32 >> 16) & 0xFF,
                                (u32 >> 8) & 0xFF, u32 & 0xFF
                            );
                        }

                        function parseDataBox(bodyPos, boxSize) {
                            if (boxSize < 16) return null;
                            const typeIndicator = dataView.getUint32(bodyPos + 8);
                            if (typeIndicator > 1) return null;
                            const contentLen = boxSize - 16;
                            if (contentLen <= 0) return null;
                            return decoder.decode(videoData.slice(bodyPos + 16, bodyPos + 16 + contentLen));
                        }

                        function parseKeysBox(bodyPos, boxSize) {
                            if (boxSize < 12) return [];
                            const count = dataView.getUint32(bodyPos + 4);
                            const keys = [];
                            let p = bodyPos + 8;
                            const end = bodyPos + boxSize;
                            for (let i = 0; i < count && p + 8 <= end; i++) {
                                const eSz = dataView.getUint32(p);
                                const eType = dataView.getUint32(p + 4);
                                if (eSz < 8 || p + eSz > end) break;
                                if (eType === 0x6D647461) {
                                    keys.push(decoder.decode(videoData.slice(p + 8, p + eSz)));
                                }
                                p += eSz;
                            }
                            return keys;
                        }

                        function parseIlstItems(bodyPos, boxSize, mdtaKeys) {
                            let p = bodyPos;
                            const end = bodyPos + boxSize;
                            while (p + 8 <= end) {
                                const itemSz = dataView.getUint32(p);
                                if (itemSz < 8 || p + itemSz > end) break;
                                const itemKey = dataView.getUint32(p + 4);
                                let dp = p + 8;
                                const itemEnd = p + itemSz;
                                while (dp + 8 <= itemEnd) {
                                    const dSz = dataView.getUint32(dp);
                                    const dType = dataView.getUint32(dp + 4);
                                    if (dSz < 8 || dp + dSz > itemEnd) break;
                                    if (dType === 0x64617461) {
                                        const content = parseDataBox(dp, dSz);
                                        if (content !== null) {
                                            let name;
                                            if (mdtaKeys && itemKey >= 1 && itemKey <= mdtaKeys.length) {
                                                name = mdtaKeys[itemKey - 1];
                                            } else {
                                                break;
                                            }
                                            try { metadata[name] = JSON.parse(content); }
                                            catch { metadata[name] = content; }
                                        }
                                        break;
                                    }
                                    dp += dSz;
                                }
                                p += itemSz;
                            }
                        }

                        function parseMeta(bodyPos, metaSize) {
                            let p = bodyPos + 4;
                            const end = bodyPos + metaSize;
                            let keysBox = null;
                            let ilstBox = null;
                            while (p + 8 <= end) {
                                const sz = dataView.getUint32(p);
                                const tp = dataView.getUint32(p + 4);
                                if (sz < 8 || p + sz > end) break;
                                if (tp === 0x6B657973) keysBox = { size: sz, body: p + 8 };
                                else if (tp === 0x696C7374) ilstBox = { size: sz, body: p + 8 };
                                p += sz;
                            }
                            if (!ilstBox) return;
                            const mdtaKeys = keysBox ? parseKeysBox(keysBox.body, keysBox.size - 8) : null;
                            parseIlstItems(ilstBox.body, ilstBox.size - 8, mdtaKeys);
                        }

                        function walkMdta(start, end) {
                            let pos = start;
                            while (pos + 8 <= end) {
                                const sz = dataView.getUint32(pos);
                                const tp = dataView.getUint32(pos + 4);
                                if (sz < 8 || pos + sz > end) break;
                                const ts = mp4TypeStr(tp);
                                if (ts === "moov" || ts === "udta") {
                                    walkMdta(pos + 8, pos + sz);
                                } else if (ts === "meta") {
                                    parseMeta(pos + 8, sz - 8);
                                }
                                pos += sz;
                            }
                        }

                        walkMdta(0, videoData.length);
                    }

                    // Pass 3: ©too fallback — just the encoder string, last resort
                    if (Object.keys(metadata).length === 0) {
                        let off = videoData.length - 4;
                        while (off > 16) {
                            if (dataView.getUint32(off) === 0x64617461) {
                                if (dataView.getUint32(off - 8) === 0xa9746f6f) {
                                    let size = dataView.getUint32(off - 4) - 4 * 4;
                                    const content = decoder.decode(videoData.slice(off + 12, off + 12 + size));
                                    metadata["encoder"] = content;
                                    break;
                                }
                            }
                            off -= 1;
                        }
                    }

                    if (Object.keys(metadata).length > 0) {
                        clearTimeout(timeout);
                        resolve(metadata);
                        return;
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
