import { utilitiesInstance } from "./Utilities.js";

export function isElementVideo(element) {
    return element && element.tagName === 'VIDEO';
}

export async function toggleVideoPlayback(video) {
    if (!video.pause || !video.play || !('paused' in video)) { return; }

    if (video.paused) {
        await video.play();
    } else {
        video.pause();
    }
};

export function toggleVideoMute(video) {
    if ('muted' in video) {
        video.muted = !video.muted;
    }
}

export function setVideoVolume(video, percentage) {
    video.volume = utilitiesInstance.clamp(percentage / 100, 0.0, 1.0); // Slider is 1-100, volume is 0-1
}

export function toggleVideoFullscreen(video) {
    if (!document.fullscreenElement) {
        video.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

export function setVideoPlaybackRate(video, rate) {
    video.playbackRate = utilitiesInstance.clamp(rate, 0.05, 100.00);
}

export function seekVideo(video, delta) {
    if (!video.duration || !video.currentTime) { return; }

    const maxTime = video.duration;
    const currentTime = video.currentTime;
    const seekStep = utilitiesInstance.clamp(maxTime / 100, 1, 10); // Seek multiplier: 1 sec min / 1% of video / 10 sec max

    let newTime = currentTime + (delta * seekStep);
    newTime = utilitiesInstance.clamp(newTime, 0, maxTime); // utilitiesInstance.clamp within valid range

    video.currentTime = newTime; // Seek the video to the new time
};

export function onScrollVideo(video, event, bInvertWheelSeek) {
    event.preventDefault(); // Prevent default scroll behavior

    // Determine the scroll direction (positive or negative)
    let scrollDelta = Math.sign(event.deltaY); // -1 for up, 1 for down

    if (bInvertWheelSeek) {
        scrollDelta *= -1;
    }

    seekVideo(video, scrollDelta);
}