import os

import folder_paths
from .logger import logger
from .misc import *
from .utils import *

import cv2
import re
import torch

import numpy as np

import comfy.sd
from comfy.utils import common_upscale

from PIL import Image, ImageSequence, ImageOps
from typing import List
    

class VideoInfo:
    
    def __init__(self):
        self.original_frame_count = 0
        self.original_fps = 0.0
        self.original_video_duration = 0.0
        self.original_frame_time = 0.0
        
        self.actual_frame_count = 0
        self.actual_fps = 0.0
        self.actual_video_duration = 0.0
        self.actual_frame_time = 0.0
        
    @staticmethod
    def build_video_info(original_fps : float, original_frame_count : int, desired_frame_rate : float, frames_added : int):
        
        video_info = VideoInfo()
        
        video_info.original_fps = float(original_fps)
        video_info.original_frame_count = int(original_frame_count)
        video_info.original_video_duration = float(original_frame_count / original_fps)
        video_info.original_frame_time = float(1 / original_fps)
        
        actual_fps = desired_frame_rate if desired_frame_rate > 0.001 else original_fps
        video_info.actual_fps = float(actual_fps)
        video_info.actual_frame_count = int(frames_added)
        video_info.actual_video_duration = float(frames_added / actual_fps)
        video_info.actual_frame_time = float(1 / actual_fps)
        
        return video_info


class OutVideoInfo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "in_video_info": ("JNODES_VIDEO_INFO",),
            },
        }

    RETURN_TYPES = (
        "INT", "FLOAT", 
        "FLOAT", "FLOAT", 
        
        "INT", "FLOAT", 
        "FLOAT", "FLOAT",
    )
    
    RETURN_NAMES = (
        "original_frame_count", "original_fps", 
        "original_video_duration", "original_frame_time", 
        
        "actual_frame_count", "actual_fps", 
        "actual_video_duration", "actual_frame_time", 
    )
    
    FUNCTION = "output_video_info"

    def output_video_info(self, in_video_info : VideoInfo):
        out = (
            in_video_info.original_frame_count, in_video_info.original_fps, 
            in_video_info.original_video_duration, in_video_info.original_frame_time,
            
            in_video_info.actual_frame_count, in_video_info.actual_fps, 
            in_video_info.actual_video_duration, in_video_info.actual_frame_time
        )
        #print(out)
        return out
  

class LoadVideo:
    """
    A mutation from Kosinkadink's VideoHelperSuite, credits to his repository!
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "video": ("STRING", {"default": "X://insert/path/here.mp4"}),
                "desired_frame_rate": ("FLOAT", {"default": 0, "min": 0, "step": 1}),
                "force_size": (["Disabled", "256x?", "?x256", "256x256", "512x?", "?x512", "512x512"],),
                "frame_load_cap": ("INT", {"default": 0, "min": 0, "step": 1}),
                "skip_first_frames": ("INT", {"default": 0, "min": 0, "step": 1}),
                "select_every_nth": ("INT", {"default": 1, "min": 1, "step": 1}),
                "discard_transparency": ("BOOLEAN", {"default": True})
            },
        }

    RETURN_TYPES = ("IMAGE", "JNODES_VIDEO_INFO",)
    RETURN_NAMES = ("IMAGE", "out_video_info",)
    FUNCTION = "load_video"
    
    known_exceptions = []
    def load_video(self, **kwargs):
        try:
            return LoadVideo.load_video_cv(**kwargs)
        except Exception as e:
            raise RuntimeError(f"Failed to load video: {kwargs['video']}\ndue to: {e.__str__()}")

    @classmethod
    def VALIDATE_INPUTS(s, video, **kwargs):
        if video is not None and not os.path.isfile(video.strip("\"")):
            return "Invalid video file: {}".format(video)
        return True
    
    def target_size(width, height, force_size) -> tuple[int, int]:
        if force_size != "Disabled":
            force_size = force_size.split("x")
            if force_size[0] == "?":
                width = (width*int(force_size[1]))//height
                #Limit to a multple of 8 for latent conversion
                #TODO: Consider instead cropping and centering to main aspect ratio
                width = int(width)+4 & ~7
                height = int(force_size[1])
            elif force_size[1] == "?":
                height = (height*int(force_size[0]))//width
                height = int(height)+4 & ~7
                width = int(force_size[0])
        return (width, height)
    
    def force_size(force_size, width, height, images):
        if force_size != "Disabled":
            new_size = LoadVideo.target_size(width, height, force_size)
            if new_size[0] != width or new_size[1] != height:
                s = images.movedim(-1,1)
                s = common_upscale(s, new_size[0], new_size[1], "lanczos", "disabled")
                return s.movedim(1,-1)
                
        return images
    
    def load_video_pil(
            video: str, desired_frame_rate: float, force_size: str, frame_load_cap: int, skip_first_frames: int, select_every_nth: int, discard_transparency):
        """
        For any other animated type, such as webp, apng, or mjpeg.
        Can't really use the force_rate param since we're not sampling the video, 
        we're just loading the frames directly.
        """
        
        logger.info(
            'Falling back to load_video_pil. desired_frame_rate will be ignored, and the original frame rate will be used. ' +
            'If desired_frame_rate is important, please consider converting this media to another file type.')
    
        try:
            loaded_video = Image.open(video)
        except Exception as e:
            raise Exception(f"Unable to open video with pil fallback: {video}")
        
        frames = ImageSequence.Iterator(loaded_video)
        
        images = []
        original_frame_time = None
        for image in frames:
            if original_frame_time is None:
                if 'duration' not in image.info:
                    image.load()
                original_frame_time = image.info.get('duration', None)
            # Ensure the image does not have an alpha channel
            if discard_transparency and image.mode == 'RGBA':
                image = image.convert('RGB')
            image = ImageOps.exif_transpose(image)
            image = np.array(image, dtype=np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            images.append(image)
            
        if original_frame_time is None:
            raise Exception(f"Could not get original_frame_time from video: {video}")
            
        original_frame_count = len(images)
            
        original_fps = 1000 / original_frame_time
        width = loaded_video.width
        height = loaded_video.height
    
        # Remove images before the skip and beyond the cap
        if skip_first_frames != 0:
            images = images[skip_first_frames:]
        if frame_load_cap != 0:
            images = images[skip_first_frames:frame_load_cap]
        
        out_images = []
        for i, image in enumerate(images):
            if i % select_every_nth == 0:
                out_images.append(image)
        
        out_images = torch.cat(out_images, dim=0)
    
        out_images = LoadVideo.force_size(force_size, width, height, out_images)
    
        return (out_images, VideoInfo.build_video_info(original_fps, original_frame_count, original_fps, len(out_images)))
    
    def load_video_cv(
            video: str, desired_frame_rate: float, force_size: str, frame_load_cap: int, skip_first_frames: int, select_every_nth: int, discard_transparency):
        
        def retry_with_pil(video, desired_frame_rate, force_size, frame_load_cap, skip_first_frames, select_every_nth, discard_transparency):
            logger.info(f"Retrying with pil due to opencv error")
            return LoadVideo.load_video_pil(video, desired_frame_rate, force_size, frame_load_cap, skip_first_frames, select_every_nth, discard_transparency)
        
        try:
            video_cap = cv2.VideoCapture(video)
            if not video_cap.isOpened():
                return retry_with_pil(video, desired_frame_rate, force_size, frame_load_cap, skip_first_frames, select_every_nth, discard_transparency)
            # set video_cap to look at start_index frame
            images = []
            original_frame_count = video_cap.get(cv2.CAP_PROP_FRAME_COUNT)
            total_frame_count = 0
            total_frames_evaluated = -1
            frames_added = 0
            original_fps = video_cap.get(cv2.CAP_PROP_FPS)
            original_frame_time = 1/original_fps
            width = video_cap.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
            if desired_frame_rate < 0.001:
                target_frame_time = original_frame_time
            else:
                target_frame_time = 1/desired_frame_rate
            time_offset=target_frame_time - original_frame_time
            while video_cap.isOpened():
                if time_offset < target_frame_time:
                    is_returned, frame = video_cap.read()
                    # if didn't return frame, video has ended
                    if not is_returned:
                        break
                    time_offset += original_frame_time
                if time_offset < target_frame_time:
                    continue
                time_offset -= target_frame_time
                # if not at start_index, skip doing anything with frame
                total_frame_count += 1
                if total_frame_count <= skip_first_frames:
                    continue
                else:
                    total_frames_evaluated += 1
    
                # if should not be selected, skip doing anything with frame
                if total_frames_evaluated%select_every_nth != 0:
                    continue
    
                # opencv loads images in BGR format (yuck), so need to convert to RGB for ComfyUI use
                # follow up: can videos ever have an alpha channel?
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                # convert frame to comfyui's expected format (taken from comfy's load image code)
                image = Image.fromarray(frame)
                image = ImageOps.exif_transpose(image)
                image = np.array(image, dtype=np.float32) / 255.0
                image = torch.from_numpy(image)[None,]
                images.append(image)
                frames_added += 1
                # if cap exists and we've reached it, stop processing frames
                if frame_load_cap > 0 and frames_added >= frame_load_cap:
                    break
        finally:
            if video_cap:
                video_cap.release()
        if len(images) > 0:
           images = torch.cat(images, dim=0)
        else:
            return retry_with_pil(video, desired_frame_rate, force_size, frame_load_cap, skip_first_frames, select_every_nth, discard_transparency)
        
        images = LoadVideo.force_size(force_size, width, height, images)
                
        return (images, VideoInfo.build_video_info(original_fps, original_frame_count, desired_frame_rate, frames_added))


class UploadVideo:
    """
    This is also found in Kosinkadink's VideoHelperSuite, but that was something I contributed.
    """
    UPLOAD_SUBDIRECTORY = "upload_video"
    INPUT_DIR_TYPE_NAMES = ["input", "temp"]         
    
    @classmethod
    def INPUT_TYPES(s):
        files = []
        # This just pulls in whatever's in the /input/upload_video folder on start
        for input_type in s.INPUT_DIR_TYPE_NAMES:
            input_dir = convert_relative_comfyui_path_to_full_path(input_type)
            if not os.path.isdir(input_dir):
                continue
            for f in os.listdir(input_dir):
                if os.path.isfile(os.path.join(input_dir, f)):
                    file_parts = f.split('.')
                    if len(file_parts) > 1 and (file_parts[-1] in ACCEPTED_UPLOAD_VIDEO_EXTENSIONS + ACCEPTED_ANIMATED_IMAGE_EXTENSIONS):
                        files.append(f"{input_type}/{s.UPLOAD_SUBDIRECTORY}/{f}")
        return {"required": {
                    "video": (sorted(files), {"video_upload": True}),
                    "upload_to_directory": (s.INPUT_DIR_TYPE_NAMES,),
                    },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("video_path",)
    FUNCTION = "upload_video"
    
    def upload_video(self, video, upload_to_directory):
        return (convert_relative_comfyui_path_to_full_path(video),)

    @classmethod
    def VALIDATE_INPUTS(s, video, upload_to_directory, **kwargs):
        full_path = convert_relative_comfyui_path_to_full_path(video)
        if not os.path.isfile(full_path):
            return f"Invalid video file: {full_path}"
        return True


NODE_CLASS_MAPPINGS = {

    "JNodes_OutVideoInfo": OutVideoInfo,
    "JNodes_LoadVideo": LoadVideo,
    "JNodes_UploadVideo": UploadVideo,
}

NODE_DISPLAY_NAME_MAPPINGS = {

    "JNodes_OutVideoInfo": "Out Video Info (DEPRECATED, USE JNodes_BreakMediaInfo)",
    "JNodes_LoadVideo": "Load Video (DEPRECATED, USE JNodes_LoadVisualMediaFromPath)",
    "JNodes_UploadVideo": "Upload Video (DEPRECATED, USE JNodes_UploadVisualMedia)",
}