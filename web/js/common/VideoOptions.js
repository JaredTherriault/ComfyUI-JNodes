export class options_VideoPlayback { 
    autoplay = false; loop = true; controls = true; muted = true; useWheelSeek = true; invertWheelSeek = true; defaultVolume = 50;
}; 

export class info_VideoPlaybackOptions {
    autoplay = { tooltip: 'Should the videos automatically play as they scroll into view? Does not apply to animated images, only video types.', 
        bPropagateOnChange: true, forEachElement: forEachElement_Autoplay }; 
    loop = { tooltip: 'Should the videos automatically play again when the end is reached?', bPropagateOnChange: true, forEachElement: null }; 
    controls = { tooltip: 'Should controls such as play/pause, volume, etc be displayed on the video?', bPropagateOnChange: true, forEachElement: null }; 
    muted = { tooltip: 'Should videos play without audio?', bPropagateOnChange: true, forEachElement: null };
    useWheelSeek = { tooltip: 'Should videos seek when mousing over a video and using the scroll wheel?', bPropagateOnChange: false, forEachElement: null };
    invertWheelSeek = { tooltip: 'Should scroll wheel seeking be inverted? (If true, scrolling up will seek forward. If false, will seek backward)', 
        bPropagateOnChange: false, forEachElement: null };
    defaultVolume = { tooltip: 'The default volume at which videos should play if not muted.', bPropagateOnChange: false, forEachElement: forEachElement_Volume };
};

function forEachElement_Autoplay(element, propertyValue) {
    // Pause anything currently playing if autoplay is false
    // We don't want to play just anything, we'll let observer take care of that
    if (!propertyValue && element.pause && 'paused' in element && !element.paused) {
        element.pause();
    }
}

function forEachElement_Volume(element, propertyValue) {
    // Pause anything currently playing if autoplay is false
    // We don't want to play just anything, we'll let observer take care of that
    if (propertyValue && 'volume' in element) {
        element.volume = propertyValue / 100; // Slider is 1-100, volume is 0-1
    }
}
