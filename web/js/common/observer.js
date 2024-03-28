// This script ensures that a given video or animated image is in the viewport before autoplaying it, 
// then plays it. If the image is scrolled out of view, the playback stops. This applies to video
// and image types including mp4, m4v, wepb, gif, apng, etc.

export class ObserverOptions {
	autoPlayVideos = true;
	playMuted = true;
	playbackThreshold = 0.15;
}

let observerOptions = new ObserverOptions();

const observedElements = new Set();

async function tryPlayVideo(element) {
	if (element.paused) {
		// Play the animation (e.g., for APNG, WebP, or video files)
		try {
			await element.play();
			element.muted = observerOptions.playMuted;
		} catch { }
	}
}

function tryStopVideo(element) {
	if (!element.paused) {
		// Pause the animation (e.g., for APNG, WebP, or video files)
		try {
			element.pause();
		} catch { }
	}
}

export function observeForAutoplay(element) {
	if (!element) {
		return;
	}
	// Check if the element is already being observed
	if (!observedElements.has(element)) {
		// If not observed, add it to the set of observed elements
		observedElements.add(element);
		// Start observing the element
		autoplayObserver.observe(element);
	}
}

export function unobserveForAutoplay(element) {
	if (!element) {
		return;
	}
	observedElements.delete(element);
	autoplayObserver.unobserve(element);
}

const autoplayObserver = new IntersectionObserver((entries) => {
	entries.forEach(async entry => {

		const element = entry.target;

		if (!element) {
			unobserveForAutoplay(element);
			return;
		}
		// Check if the video is intersecting with the viewport
		if (entry.isIntersecting) {
			if (!element.src) {
				element.src = element.dataSrc;

				// Reset explicit height and width to allow algorithmic dimensions
				element.style.height = '';
				element.style.width = '';

				if (element.tagName !== 'VIDEO') {
					unobserveForAutoplay(element);
					return;
				}
			}
			if (observerOptions.autoPlayVideos) {
				await tryPlayVideo(element);
			}
		} else {
			// Pause the animation if it's not intersecting with the viewport
			if (observerOptions.autoPlayVideos) {
				tryStopVideo(element);
			}
		}
	});
}, { threshold: observerOptions.playbackThreshold });