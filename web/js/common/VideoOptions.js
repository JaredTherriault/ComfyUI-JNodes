import { setVideoPlaybackRate, setVideoVolume } from "./VideoControl.js";

export class options_VideoPlayback { 
    autoplay = false; loop = true; controls = true; muted = true; useWheelSeek = false; invertWheelSeek = true; defaultVolume = 50; defaultPlaybackRate = 1.00;
}; 

export class info_VideoPlaybackOptions {
    autoplay = { tooltip: 'Should the videos automatically play as they scroll into view? Does not apply to animated images, only video types.', 
        forEachElement: forEachElement_Autoplay, widgetType: 'checkbox' }; 
    loop = { tooltip: 'Should the videos automatically play again when the end is reached?', forEachElement: forEachElement_genericPropagatation, widgetType: 'checkbox' }; 
    controls = { tooltip: 'Should controls such as play/pause, volume, etc be displayed on the video?', forEachElement: forEachElement_genericPropagatation, widgetType: 'checkbox' }; 
    muted = { tooltip: 'Should videos play without audio?', forEachElement: forEachElement_genericPropagatation, widgetType: 'checkbox' };
    useWheelSeek = { tooltip: 'Should videos seek when mousing over a video and using the scroll wheel?', forEachElement: forEachElement_genericPropagatation, widgetType: 'checkbox' };
    invertWheelSeek = { tooltip: 'Should scroll wheel seeking be inverted? (If true, scrolling up will seek forward. If false, will seek backward)', 
        forEachElement: forEachElement_genericPropagatation, widgetType: 'checkbox' };
    defaultVolume = { tooltip: 'The default volume at which videos should play if not muted', forEachElement: forEachElement_Volume, widgetType: 'range' };
    defaultPlaybackRate = { tooltip: 'The default rate at which videos should play', forEachElement: forEachElement_playbackRate, widgetType: 'number', min: 0.01, max: 100.00, step: 0.01 };
};

function forEachElement_Autoplay(element, propertyName, propertyValue) {
    // Pause anything currently playing if autoplay is false
    // We don't want to play just anything, we'll let observer take care of that
    if (!propertyValue && element.pause && 'paused' in element && !element.paused) {
        element.pause();
    }
}

function forEachElement_genericPropagatation(element, propertyName, propertyValue) {
    element[propertyName] = propertyValue;
}

function forEachElement_Volume(element, propertyName, propertyValue) {
    if (isNaN(propertyValue)) { propertyValue = 1; }

    setVideoVolume(element, propertyValue);
}

function forEachElement_playbackRate(element, propertyName, propertyValue) {
    if (isNaN(propertyValue)) { propertyValue = 1; }

    setVideoPlaybackRate(element, propertyValue);
}
