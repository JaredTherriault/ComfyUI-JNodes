import shutil
import os

import folder_paths
from .logger import logger
from .misc import *
from .utils import *

import copy
import cv2
import hashlib
import json
import random
import re
import torch

import numpy as np

import comfy.sd
from comfy.utils import common_upscale

from PIL import Image, ImageSequence, ImageOps
from typing import List
from pathlib import Path

try:
    from numba import njit, prange
except Exception as e:
    print(f"WARINING! Numba failed to import! Stereoimage generation will be much slower! ({str(e)})")
    from builtins import range as prange
    def njit(parallel=False):
        def Inner(func): return lambda *args, **kwargs: func(*args, **kwargs)
        return Inner
import numpy as np
from PIL import Image


class MediaInfo:

    def __init__(self, start_frame, frame_count, fps, width, height):
        self.start_frame = int(start_frame)
        self.frame_count = int(frame_count)
        self.fps = float(fps)
        self.duration = float(frame_count / fps)
        self.frame_time = float(1 / fps)
        self.width = int(width)
        self.height = int(height)

    def to_dict(self):
        """
        Convert MediaInfo object to a dictionary representation.
        """
        return {
            "start_frame": self.start_frame,
            "frame_count": self.frame_count,
            "fps": self.fps,
            "duration": self.duration,
            "frame_time": self.frame_time,
            "width": self.width,
            "height": self.height,
        }

    def to_string(self):
        return json.dumps(self.to_dict(), indent=4)


class MediaInfoToString:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "in_media_info": ("JNODES_MEDIA_INFO",),
            },
        }

    RETURN_TYPES = ("STRING",)

    FUNCTION = "media_info_to_string"

    def media_info_to_string(self, in_media_info):
        return (in_media_info.to_string(),)


class BreakMediaInfo:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "in_media_info": ("JNODES_MEDIA_INFO",),
            },
        }

    RETURN_TYPES = (
        "INT",
        "INT",
        "FLOAT",
        "FLOAT",
        "FLOAT",
        "INT",
        "INT",
    )

    RETURN_NAMES = (
        "start_frame",
        "frame_count",
        "fps",
        "duration",
        "frame_time",
        "width",
        "height",
    )

    FUNCTION = "break_media_info"

    def break_media_info(self, in_media_info: MediaInfo):
        out = (
            in_media_info.start_frame,
            in_media_info.frame_count,
            in_media_info.fps,
            in_media_info.duration,
            in_media_info.frame_time,
            in_media_info.width,
            in_media_info.height,
        )
        # print(out)
        return out


class AppendReversedFrames:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "remove_head": ("BOOLEAN", {"default": False}),
                "remove_tail": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "append_reversed_frames"

    def append_reversed_frames(self, frames, remove_head=False, remove_tail=False):
        frames_reverse = copy.copy(frames)[::-1]
        if remove_head:
            frames_reverse.pop(0)
        if remove_tail:
            frames_reverse.pop(-1)
        return (frames + frames_reverse,)


class LoadVisualMediaFromPath:
    """
    A mutation from Kosinkadink's VideoHelperSuite, credits to his repository!
    """

    FORCE_SIZE_DIMENSIONS = ["Disabled", "256", "512", "768", "1024"]
    TIME_UNITS = ["frames", "seconds"]

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "media_path": ("STRING", {"default": "/insert/path/here.ext"}),
                "start_at_n": ("INT", {"default": 0, "min": 0, "step": 1}),
                "start_at_unit": (s.TIME_UNITS,),
                "sample_next_n": (
                    "INT",
                    {"default": 0, "min": 0, "step": 1},
                ),  # 0 in this case means no maximum
                "sample_next_unit": (s.TIME_UNITS,),
                "frame_skip": ("INT", {"default": 0, "min": 0, "step": 1}),
                "discard_transparency": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = (
        "IMAGE",
        "JNODES_MEDIA_INFO",
        "JNODES_MEDIA_INFO",
    )
    RETURN_NAMES = ("IMAGE", "original_media_info", "output_media_info")
    FUNCTION = "load_media"

    known_exceptions = []

    def load_media(self, **kwargs):
        return LoadVisualMediaFromPath.load_media_cv(**kwargs)

    @classmethod
    def VALIDATE_INPUTS(s, media_path, **kwargs):
        if media_path is not None and not os.path.isfile(media_path.strip('"')):
            return "Invalid media file: {}".format(media_path)
        return True

    @staticmethod
    def build_output_media_info(
        original_fps: float,
        frame_skip: int,
        frames_added: int,
        start_frame: int,
        width: int,
        height: int,
    ):
        return MediaInfo(
            start_frame, frames_added, original_fps / (frame_skip + 1), width, height
        )

    @staticmethod
    def get_unit_as_frames(n: int, unit: str, fps: float, frame_skip: int):
        if unit == "seconds":
            return int(n * fps)

        return n

    @staticmethod
    def load_media_pil(
        media_path: str,
        start_at_n: int,
        start_at_unit: str,
        sample_next_n: int,
        sample_next_unit: str,
        frame_skip: int,
        discard_transparency,
    ):
        """
        For any other animated type, such as webp, apng, or mjpeg.
        """

        try:
            loaded_media = Image.open(media_path)
        except Exception as e:
            raise Exception(f"Unable to open media with pil fallback: {media_path}")

        frames = list(ImageSequence.Iterator(loaded_media))

        # Short loop to get needed metadata
        original_frame_time = None
        for image in frames:
            if original_frame_time is None:
                if "duration" not in image.info:
                    image.load()
                original_frame_time = image.info.get("duration", None)
                break

        if original_frame_time is None:
            raise Exception(f"Could not get original_frame_time from media: {media_path}")

        original_frame_count = len(frames)

        original_fps = 1000 / original_frame_time
        width = loaded_media.width
        height = loaded_media.height

        # Remove images before the skip and beyond the cap
        start_at_frame = (
            0
            if start_at_n == 0
            else clamp(
                LoadVisualMediaFromPath.get_unit_as_frames(
                    start_at_n, start_at_unit, original_fps, frame_skip
                ),
                0,
                original_frame_count - 1,
            )
        )
        sample_next_frame_count = (
            0
            if sample_next_n == 0
            else LoadVisualMediaFromPath.get_unit_as_frames(
                sample_next_n, sample_next_unit, original_fps, frame_skip
            )
        )

        if start_at_frame > 0:
            frames = frames[start_at_frame:]
        if (
            sample_next_n > 0
            and start_at_frame + sample_next_frame_count < original_frame_count
        ):
            frames = frames[:sample_next_frame_count]

        # Actual image extraction loop
        out_images = []
        for i, frame in enumerate(frames):
            loaded_media.seek(i)
            if i % (frame_skip + 1) == 0:
                # Ensure the image does not have an alpha channel
                if discard_transparency and frame.mode == "RGBA":
                    frame = frame.convert("RGB")
                frame = ImageOps.exif_transpose(frame)
                frame = pil2tensor(frame)
                out_images.append(frame)

        if len(out_images) > 0:
            out_images = torch.cat(out_images, dim=0)

        return (
            out_images,
            MediaInfo(0, original_frame_count, original_fps, width, height),
            LoadVisualMediaFromPath.build_output_media_info(
                original_fps,
                frame_skip,
                len(out_images),
                start_at_frame,
                width,
                height,
            ),
        )

    @staticmethod
    def load_media_cv(
        media_path: str,
        start_at_n: int,
        start_at_unit: str,
        sample_next_n: int,
        sample_next_unit: str,
        frame_skip: int,
        discard_transparency,
    ):

        def retry_with_pil(
            media: str,
            start_at_n: int,
            start_at_unit: str,
            sample_next_n: int,
            sample_next_unit: str,
            frame_skip: int,
            discard_transparency,
        ):
            logger.info(f"Retrying with pil due to opencv error")
            return LoadVisualMediaFromPath.load_media_pil(
                media,
                start_at_n,
                start_at_unit,
                sample_next_n,
                sample_next_unit,
                frame_skip,
                discard_transparency,
            )

        try:
            media_path = resolve_file_path(media_path)
            media_cap = cv2.VideoCapture(media_path)
            if not media_cap.isOpened():
                return retry_with_pil(
                    media_path,
                    start_at_n,
                    start_at_unit,
                    sample_next_n,
                    sample_next_unit,
                    frame_skip,
                    discard_transparency,
                )
            # set media_cap to look at start_index frame
            images = []
            original_frame_count = media_cap.get(cv2.CAP_PROP_FRAME_COUNT)
            original_fps = media_cap.get(cv2.CAP_PROP_FPS)
            width = media_cap.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = media_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)

            original_frame_time = 1 / original_fps

            start_at_frame = LoadVisualMediaFromPath.get_unit_as_frames(
                start_at_n, start_at_unit, original_fps, frame_skip
            )

            sample_next_frames = LoadVisualMediaFromPath.get_unit_as_frames(
                sample_next_n, sample_next_unit, original_fps, frame_skip
            )

            # Set the starting frame
            media_cap.set(cv2.CAP_PROP_POS_FRAMES, start_at_frame)

            total_frames_evaluated = start_at_frame - 1

            while media_cap.isOpened():

                is_returned, frame = media_cap.read()

                # if no return frame, video has ended
                if not is_returned:
                    break

                # if not at start_index, skip doing anything with frame
                total_frames_evaluated += 1

                # if should not be selected, skip doing anything with frame
                if total_frames_evaluated % (frame_skip + 1) != 0:
                    continue

                # opencv loads images in BGR format (yuck), so need to convert to RGB for ComfyUI use
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                # convert frame to comfyui's expected format (taken from comfy's load image code)
                image = Image.fromarray(frame)
                image = ImageOps.exif_transpose(image)
                image = pil2tensor(image)

                if discard_transparency and image.mode == "RGBA":
                    image = image.convert("RGB")

                images.append(image)

                # if frame limit exists and we've reached it, stop processing frames
                if sample_next_frames > 0 and len(images) >= sample_next_frames:
                    break
        finally:
            if media_cap:
                media_cap.release()

        if len(images) > 0:
            images = torch.cat(images, dim=0)
        else:
            return retry_with_pil(
                media_path,
                start_at_n,
                start_at_unit,
                sample_next_n,
                sample_next_unit,
                frame_skip,
                discard_transparency,
            )

        return (
            images,
            MediaInfo(0, original_frame_count, original_fps, width, height),
            LoadVisualMediaFromPath.build_output_media_info(
                original_fps,
                frame_skip,
                len(images),
                LoadVisualMediaFromPath.get_unit_as_frames(
                    start_at_n, start_at_unit, original_fps, frame_skip
                ),
                width,
                height,
            ),
        )

class LoadVisualMediaFromPath_Batch:
    """
    A mutation from Kosinkadink's VideoHelperSuite, credits to his repository!
    This loads all images from a given path, optionally recursively,
    into a single tensor batch, meaning all images are of the same size.
    """

    FORCE_SIZE_DIMENSIONS = ["Disabled", "256", "512", "768", "1024"]
    TIME_UNITS = ["frames", "seconds"]

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "media_path": ("STRING", {"default": "/insert/path/here"}),
                "recursive": ("BOOLEAN", {"default": True}),
                "start_at_n": ("INT", {"default": 0, "min": 0, "step": 1}),
                "start_at_unit": (s.TIME_UNITS,),
                "sample_next_n": (
                    "INT",
                    {"default": 0, "min": 0, "step": 1},
                ),  # 0 in this case means no maximum
                "sample_next_unit": (s.TIME_UNITS,),
                "frame_skip": ("INT", {"default": 0, "min": 0, "step": 1}),
                "discard_transparency": ("BOOLEAN", {"default": True}),
                "image_return_limit": ("INT", {"default": 0, "min": 0, "step": 1}),
                "shuffle": ("BOOLEAN", {"default": False}),
                #"seed": ("INT", {"default": 0, "max": 0xffffffffffffffff}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "load_media"

    def collect_media_paths(self, in_path, recursive, image_return_limit, shuffle, seed):

        collected_paths = []

        if in_path:
            is_dir = os.path.isdir(in_path)
            if is_dir:
                for path in os.listdir(in_path):
                    full_path = os.path.join(in_path, path)
                    if os.path.isfile(full_path):
                        collected_paths.append(full_path)
                    elif recursive:  # If it's a directory and recursive flag is True
                        # Don't pass shuffle or limit parameters for the recursions, they're a post-process
                        collected_paths.extend(self.collect_media_paths(full_path, recursive, 0, False, seed))

        if shuffle:
            #random.seed(seed)
            random.shuffle(collected_paths)
        else:
            collected_paths = sorted(collected_paths)

        if len(collected_paths) > image_return_limit and image_return_limit > 0:
            collected_paths = collected_paths[:image_return_limit]

        return collected_paths


    def process_media(self, collected_paths, **kwargs):

        local_kwargs = copy.deepcopy(kwargs)

        del local_kwargs["recursive"]
        del local_kwargs["image_return_limit"]
        del local_kwargs["shuffle"]
        #del local_kwargs["seed"]

        images = []

        for path in collected_paths:
            if os.path.isfile(path):
                new_kwargs = copy.deepcopy(local_kwargs)
                new_kwargs["media_path"] = path
                return_value = LoadVisualMediaFromPath.load_media_cv(**new_kwargs)
                if len(images) == 0:
                    images = return_value[0]
                elif len(return_value[0]) == 1:
                    images = self.batch(images, return_value[0])
        
        return images

    def batch(self, image1, image2):
        if image1.shape[1:] != image2.shape[1:]:
            image2 = comfy.utils.common_upscale(image2.movedim(-1,1), image1.shape[2], image1.shape[1], "bilinear", "center").movedim(1,-1)

        s = torch.cat((image1, image2), dim=0)
        return s

    def meta_collect_paths(self, **kwargs):
        media_path = kwargs.get("media_path").strip()
        recursive = kwargs.get("recursive", False)
        image_return_limit = kwargs.get("image_return_limit", 0)
        shuffle = kwargs.get("shuffle", False)
        seed = kwargs.get("seed", 0)

        return self.collect_media_paths(resolve_file_path(media_path), recursive, image_return_limit, shuffle, 0)

    def load_media(self, **kwargs):

        collected_paths = self.meta_collect_paths(**kwargs)

        images = self.process_media(collected_paths, **kwargs)

        return (images,)

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        try:
            if kwargs.get("shuffle", False) == True:
                return float("nan")
            else:
                return ""
        except Exception as e:
            logger.error(e)
            return ""

class LoadVisualMediaFromPath_List(LoadVisualMediaFromPath_Batch):
    """
    A mutation from Kosinkadink's VideoHelperSuite, credits to his repository!
    This loads all images from a given path, optionally recursively,
    into a list of images that may be of varying shape and size.
    """

    OUTPUT_IS_LIST = (True,)

    def process_media(self, collected_paths, **kwargs):

        local_kwargs = copy.deepcopy(kwargs)

        del local_kwargs["recursive"]
        del local_kwargs["image_return_limit"]
        del local_kwargs["shuffle"]
        #del local_kwargs["seed"]

        images = []

        for path in collected_paths:
            if os.path.isfile(path):
                new_kwargs = copy.deepcopy(local_kwargs)
                new_kwargs["media_path"] = path
                return_value = LoadVisualMediaFromPath.load_media_cv(**new_kwargs)[0]
                images.append(return_value)
        
        return images

class UploadVisualMedia:
    """
    This is based on UploadVideo found in Kosinkadink's VideoHelperSuite, but that was something I contributed.

    Files specifically uploaded from the upload button or dragged in from the OS file system will be uploaded to the directory set by "upload_to_directory".

    Files dragged in from the Image Drawer will be referenced instead of reuploaded, if possible.
    If not, they will be uploaded to the upload directory if within the comfy upload size limit.

    Returns the full local path to the chosen media. If the media comes from the Image Drawer, media metadata will also be returned.
    """

    UPLOAD_SUBDIRECTORY = "upload_media"
    INPUT_DIR_TYPE_NAMES = ["input", "temp"]

    @classmethod
    def INPUT_TYPES(s):
        files = []

        valid_dirs = ["input"]
        for input_type in s.INPUT_DIR_TYPE_NAMES:
            starting_subdirectory = f"{input_type}/{s.UPLOAD_SUBDIRECTORY}"
            valid_dirs.append(starting_subdirectory)

            # Get all subdirectories starting from starting_subdirectory
            for root, dirs, files in os.walk(convert_relative_comfyui_path_to_full_path(starting_subdirectory), followlinks=True):
                for subdir in dirs:
                    # Construct the path and replace the input_type part
                    path = f"{root}/{subdir}"
                    relative_path = path.replace(convert_relative_comfyui_path_to_full_path(input_type), "")
                    formatted_path = f"{input_type}/{relative_path}"
                    
                    # Normalize the path and add to valid_dirs
                    valid_dirs.append(os.path.normpath(formatted_path))



        # This just pulls in whatever's in the /input or /temp /upload_media folders on start
        for input_type in valid_dirs:
            input_dir = convert_relative_comfyui_path_to_full_path(input_type)
            if not os.path.isdir(input_dir):
                continue
            for filename in os.listdir(input_dir):
                file_path = os.path.join(input_dir, filename)
                if os.path.isfile(file_path):
                    file_parts = filename.split(".")
                    if len(file_parts) > 1 and (
                        file_parts[-1].lower()
                        in ACCEPTED_UPLOAD_VIDEO_EXTENSIONS
                        + ACCEPTED_ANIMATED_IMAGE_EXTENSIONS
                        + ACCEPTED_STILL_IMAGE_EXTENSIONS
                    ):
                        files.append(f"{input_type}/{filename}")
        return {
            "required": {
                "media": (sorted(files), {"media_upload": True}),
                "upload_to_directory": (s.INPUT_DIR_TYPE_NAMES,),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("media_path",)
    FUNCTION = "upload_media"

    def upload_media(self, media, **kwargs):
        return (convert_relative_comfyui_path_to_full_path(media),)

    @classmethod
    def VALIDATE_INPUTS(s, media, **kwargs):
        full_path = convert_relative_comfyui_path_to_full_path(media)
        if not os.path.isfile(full_path):
            return f"Invalid media file: {full_path}"
        return True

class CreateStereoscopicImageFromDepth:

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_image": ("IMAGE",),
                "depth_map": ("IMAGE",),
                "max_disparity": ("INT", {"default": 1000}),
                "mode": (["side-by-side (SBS)", "over-under (OU)"],),
                "swap_images": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "create_sbs_stereo"

    def create_sbs_stereo(self, input_image, depth_map, max_disparity, mode, swap_images):
        """
        Create a stereoscopic image from an input image and a depth map.

        Parameters:
        - input_image: The RGB input image as a PyTorch tensor with shape [1, height, width, 3].
        - depth_map: The depth map image as a PyTorch tensor with shape [1, height, width, 3].
        - max_disparity: Maximum disparity for creating the 3D effect.
        - mode: 'SBS' for side-by-side or 'OU' for over-under.
        - swap_images: Boolean to swap left and right images.

        Returns:
        - The stereoscopic image as a PyTorch tensor.
        """

        # Remove batch dimensions
        # while len(input_image.shape) > 3:
        #     input_image = input_image.squeeze(0)
        # while len(depth_map.shape) > 3:
        #     depth_map = depth_map.squeeze(0)
        # stereos = self.create_stereoimages(input_image, depth_map, max_disparity)

        # return (stereos,)

        # Convert tensors to numpy arrays
        input_image_np = input_image.squeeze(0).numpy()
        depth_map_np = depth_map.squeeze(0).numpy()

        height, width, channels = input_image_np.shape

        # Create the left and right images
        left_image = np.zeros_like(input_image_np)
        right_image = np.zeros_like(input_image_np)

        for y in range(height):
            for x in range(width):
                for c in range(channels):
                    # Get the disparity for the current pixel from the depth map
                    disparity = (depth_map_np[y, x, c].item() / 255.0) * max_disparity

                    # Calculate the new x positions for left and right images
                    left_x = int(x - disparity / 2)
                    right_x = int(x + disparity / 2)

                    # Make sure the new x positions are within image bounds
                    if 0 <= left_x < width:
                        left_image[y, left_x, c] = input_image_np[y, x, c]
                    if 0 <= right_x < width:
                        right_image[y, right_x, c] = input_image_np[y, x, c]

        if swap_images:
            left_image, right_image = right_image, left_image

        # Combine images
        if mode.lower() == 'sbs' or mode.lower() == 'side-by-side (sbs)':
            stereo_image_np = np.hstack((left_image, right_image))
        elif mode.lower() == 'ou' or mode.lower() == 'over-under (ou)':
            stereo_image_np = np.vstack((left_image, right_image))
        else:
            raise ValueError("Mode should be 'SBS' for side-by-side or 'OU' for over-under")

        # Convert the result back to a tensor
        stereo_image = torch.from_numpy(stereo_image_np).unsqueeze(0)

        return (stereo_image,)

NODE_CLASS_MAPPINGS = {
    
    # media_nodes
    "JNodes_MediaInfoToString": MediaInfoToString,
    "JNodes_BreakMediaInfo": BreakMediaInfo,
    "JNodes_AppendReversedFrames": AppendReversedFrames,
    "JNodes_LoadVisualMediaFromPath": LoadVisualMediaFromPath,
    "JNodes_LoadVisualMediaFromPath_Batch": LoadVisualMediaFromPath_Batch,
    "JNodes_LoadVisualMediaFromPath_List": LoadVisualMediaFromPath_List,
    "JNodes_UploadVisualMedia": UploadVisualMedia,
    "JNodes_CreateStereoscopicImageFromDepth": CreateStereoscopicImageFromDepth,

}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    # media_nodes
    "JNodes_MediaInfoToString": "Media Info To String",
    "JNodes_BreakMediaInfo": "Break Media Info",
    "JNodes_AppendReversedFrames": "Append Reversed Frames",
    "JNodes_LoadVisualMediaFromPath": "Load Visual Media From Path",
    "JNodes_LoadVisualMediaFromPath_Batch": "Load Visual Media From Path (Batch)",
    "JNodes_LoadVisualMediaFromPath_List": "Load Visual Media From Path (List)",
    "JNodes_UploadVisualMedia": "Upload Visual Media",
    "JNodes_CreateStereoscopicImageFromDepth": "Create Stereoscopic Image From Depth (Experimental)",

}