// This script ensures that a given video or animated image is in the viewport before autoplaying it, 
// then plays it. If the image is scrolled out of view, the playback stops. This applies to video
// and image types including mp4, m4v, wepb, gif, apng, etc.

import { setting_VideoPlaybackOptions } from "./SettingsManager.js";

// Note: On some browsers the user may have to explicitly allow autoplay in order for playback to work correctly
// Otherwise, you end up with a bunch of errors while scrolling informing us that the user didn't 'interact' with the page first (even if they are clearly scrolling)

export class ImageAndVideoObserverOptions {
	playbackThreshold = 0.01; // Percentage of video that must be visible in order to load. Anything less and it will be unloaded.
}

let observerOptions = new ImageAndVideoObserverOptions();

const observedElements = new Set();

async function tryPlayVideo(element) {
	if (element.paused) {
		try {
			await element.play();
			element.currentTime = element.lastSeekTime;
		} catch (error) {
			console.error(error);
		}
	}
}

function tryStopVideo(element) {
	if (element.readyState >= element.HAVE_ENOUGH_DATA && !element.paused) {
		try {
			element.pause();
		} catch { }
	}
}

export function observeVisualElement(element) {
	if (!element) {
		return;
	}
	// Check if the element is already being observed
	if (!observedElements.has(element)) {
		// If not observed, add it to the set of observed elements
		observedElements.add(element);
		// Start observing the element
		imageAndVideoObserver.observe(element);
	}
}

export function unobserveVisualElement(element) {
	if (!element) {
		return;
	}
	observedElements.delete(element);
	imageAndVideoObserver.unobserve(element);
}

const imageAndVideoObserver = new IntersectionObserver((entries) => {
	entries.forEach(async entry => {

		const element = entry.target;

		if (!element) {
			unobserveVisualElement(element);
			return;
		}
		// Check if the video is intersecting with the viewport
		if (entry.isIntersecting) {

			if (element.onObserverIntersect) {
				element.onObserverIntersect();
			}
			else if (!element.src || element.src === '') {

				if (element.forceLoad) {
					element.forceLoad();
				}
				
				if (element.tagName !== 'VIDEO') {
					unobserveVisualElement(element);
					return;
				}
			}

			if (setting_VideoPlaybackOptions.value.autoplay) {
				tryPlayVideo(element);
			}
		} else {

			if (element.onObserverUnintersect) {
				element.onObserverUnintersect();
			}
			else if (element.tagName === 'VIDEO') {
				// Pause the video if it's not intersecting with the viewport
				tryStopVideo(element);

				if (element.currentTime) {
					element.lastSeekTime = element.currentTime;
				}

				if ('src' in element) {
					element.removeAttribute('src'); // Unload unobserved videos
					try {
						if (element.load) { element.load(); } // Release memory
					} catch { }
				}
			}
		}
	});
}, { threshold: observerOptions.playbackThreshold });