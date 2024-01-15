import os
import sys
from pathlib import Path

import folder_paths
from .logger import logger
from .misc import *

import cv2
import json
import random
import re
import shutil
import subprocess
import torch
import piexif
import piexif.helper

import numpy as np

import comfy.sd
from nodes import SaveImage
from comfy.utils import common_upscale

from PIL import Image, ImageSequence
from PIL.PngImagePlugin import PngInfo
from typing import Dict, List

folder_paths.folder_names_and_paths["video_formats"] = (
    [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "video_formats"),
    ],
    [".json"]
)

ffmpeg_path = shutil.which("ffmpeg")
if ffmpeg_path is None:
    logger.info("ffmpeg could not be found. Using ffmpeg from imageio-ffmpeg.")
    from imageio_ffmpeg import get_ffmpeg_exe
    try:
        ffmpeg_path = get_ffmpeg_exe()
    except:
        logger.warning("ffmpeg could not be found. Outputs that require it have been disabled")

class SaveVideo():
    '''
    Based on work done by Kosinkadink as a part of the Video Helper Suite.
    Edited to:
    -insert metadata directly into videos
    -return a format compatible with ImageDrawer
    -set quality on 'image' type outputs
    -use a filename suffix rather than prefix, simply because I prefer the counter to come first in the filename
    '''
    @classmethod
    def INPUT_TYPES(s):
        #Hide ffmpeg formats if ffmpeg isn't available
        if ffmpeg_path is not None:
            ffmpeg_formats = ["video/"+x[:-5] for x in folder_paths.get_filename_list("video_formats")]
        else:
            ffmpeg_formats = []
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": (
                    "INT",
                    {"default": 8, "min": 1, "step": 1},
                ),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "filename_suffix": ("STRING", {"default": ""}),
                "format": (["image/gif", "image/webp", "image/apng"] + ffmpeg_formats,),
                "save_to_output_dir": ("BOOLEAN", {"default": True}),
                "quality": ("INT", {"default": 95, "min": 0, "max": 100, "step": 1}),
            },
            "optional": {
                "save_metadata": ("BOOLEAN", {"default": True}),
                "save_workflow": ("BOOLEAN", {"default": True}),
                "audio_file": ("STRING", {"default": ""}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    OUTPUT_NODE = True
    FUNCTION = "combine_video"

    def combine_video(
        self,
        images,
        quality,
        frame_rate: int,
        loop_count: int,
        filename_suffix="",
        format="image/webp",
        save_to_output_dir=True,
        save_metadata=True,
        save_workflow=True,
        prompt=None,
        extra_pnginfo=None,
        audio_file=""
    ):
        # Prevent invalid output for ImageDrawer
        if filename_suffix is None:
            filename_suffix = "Video"
            
        # convert images to numpy
        images = images.cpu().numpy() * 255.0
        images = np.clip(images, 0, 255).astype(np.uint8)

        # get output information
        output_dir = (
            folder_paths.get_output_directory()
            if save_to_output_dir
            else folder_paths.get_temp_directory()
        )
        (
            full_output_folder,
            filename,
            _,
            subfolder,
            _,
        ) = folder_paths.get_save_image_path(filename_suffix, output_dir)

        metadata = PngInfo()
        video_metadata = {}
        if save_workflow and prompt is not None:
            metadata.add_text("prompt", json.dumps(prompt))
            video_metadata["prompt"] = prompt
        if extra_pnginfo is not None:
            for key in extra_pnginfo:
                if not save_workflow and key == "workflow":
                    continue
                value = f'"{extra_pnginfo[key]}"'
                metadata.add_text(key, json.dumps(value))
                video_metadata[key] = value
                
        counter = len(os.listdir(full_output_folder)) + 1

        format_type, format_ext = format.split("/")
        file = f"{counter:05}_{filename}.{format_ext}"
        file_path = os.path.join(full_output_folder, file)
        while os.path.exists(file_path):
            counter += 1
            file = f"{counter:05}_{filename}.{format_ext}"
            file_path = os.path.join(full_output_folder, file)
            
        if format_type == "image":
            
            frames = [Image.fromarray(f) for f in images]
            
            args = {
                "format":format_ext.upper(),
                "save_all":True,
                "append_images":frames[1:],
                "duration":round(1000 / frame_rate),
                "loop":loop_count,
                }   
            
            # Add metadata to images
            if format_ext == "gif":
                if save_metadata:
                    args["comment"] = json.dumps(video_metadata, indent=2, sort_keys=True)                
                    
            elif format_ext == "apng":
                compress_level = quality // 11
                args["compress_level"] = compress_level
                if save_metadata:
                    args["pnginfo"] = metadata
                    
            elif format_ext == "webp":
                args["quality"] = quality
                args["minimize_size"] = False
                if save_metadata:
                    exif_bytes = piexif.dump({
                            "Exif":{
                                piexif.ExifIFD.UserComment:piexif.helper.UserComment.dump(json.dumps(video_metadata, indent=2, sort_keys=True), encoding="unicode")}})
                    args["exif"] = exif_bytes 
                    
            frames[0].save(file_path, **args)
        else:
            # Use ffmpeg to save a video
            if ffmpeg_path is None:
                #Should never be reachable
                raise ProcessLookupError("Could not find ffmpeg")

            video_format_path = folder_paths.get_full_path("video_formats", format_ext + ".json")
            with open(video_format_path, 'r') as stream:
                video_format = json.load(stream)
            file = f"{counter:05}_{filename}.{video_format['extension']}"
            file_path = os.path.join(full_output_folder, file)
            dimensions = f"{len(images[0][0])}x{len(images[0])}"
            args = [ffmpeg_path, "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                    "-s", dimensions, "-r", str(frame_rate), "-i", "-", "-crf", str(quality) ] \
                    + video_format['main_pass']

            env=os.environ.copy()
            if  "environment" in video_format:
                env.update(video_format["environment"])
            res = None
            if save_metadata:
                os.makedirs(folder_paths.get_temp_directory(), exist_ok=True)
                metadata = json.dumps(video_metadata)
                metadata_path = os.path.join(folder_paths.get_temp_directory(), "metadata.txt")
                #metadata from file should  escape = ; # \ and newline
                metadata = metadata.replace("\\","\\\\")
                metadata = metadata.replace(";","\\;")
                metadata = metadata.replace("#","\\#")
                metadata = metadata.replace("=","\\=")
                metadata = metadata.replace("\n","\\\n")
                metadata = "comment=" + metadata
                with open(metadata_path, "w") as f:
                    f.write(";FFMETADATA1\n")
                    f.write(metadata)
                m_args = args[:1] + ["-i", metadata_path] + args[1:]
                try:
                    res = subprocess.run(m_args + [file_path], input=images.tobytes(),
                                         capture_output=True, check=True, env=env)
                except subprocess.CalledProcessError as e:
                    #Res was not set
                    print(e.stderr.decode("utf-8"), end="", file=sys.stderr)
                    logger.warn("An error occurred when saving with metadata")

            if not res:
                try:
                    res = subprocess.run(args + [file_path], input=images.tobytes(),
                                         capture_output=True, check=True, env=env)
                except subprocess.CalledProcessError as e:
                    raise Exception("An error occured in the ffmpeg subprocess:\n" \
                            + e.stderr.decode("utf-8"))
            if res.stderr:
                print(res.stderr.decode("utf-8"), end="", file=sys.stderr)


            # Audio Injection ater video is created, saves additional video with -audio.mp4
            # Accepts mp3 and wav formats
            # TODO test unix and windows paths to make sure it works properly. Path module is Used

            audio_file_path = Path(audio_file)
            file_path = Path(file_path)

            # Check if 'audio_file' is not empty and the file exists
            if audio_file and audio_file_path.exists() and audio_file_path.suffix.lower() in ['.wav', '.mp3']:
                
                # Mapping of input extensions to output settings (extension, audio codec)
                format_settings = {
                    '.mov': ('.mov', 'pcm_s16le'),  # ProRes codec in .mov container
                    '.mp4': ('.mp4', 'aac'),        # H.264/H.265 in .mp4 container
                    '.mkv': ('.mkv', 'aac'),        # H.265 in .mkv container
                    '.webp': ('.webp', 'libvorbis'),
                    '.webm': ('.webm', 'libvorbis'),
                    '.av1': ('.webm', 'libvorbis')
                }

                output_extension, audio_codec = format_settings.get(file_path.suffix.lower(), (None, None))

                if output_extension and audio_codec:
                    # Modify output file name
                    output_file_with_audio_path = file_path.with_stem(file_path.stem + "-audio").with_suffix(output_extension)

                    # FFmpeg command with audio re-encoding
                    mux_args = [
                        ffmpeg_path, "-y", "-i", str(file_path), "-i", str(audio_file_path),
                        "-c:v", "copy", "-c:a", audio_codec, "-b:a", "192k", "-strict", "experimental", "-shortest", str(output_file_with_audio_path)
                    ]
                    
                    subprocess.run(mux_args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
                # Else block for unsupported video format can be added if necessar

        previews = [
            {
                "filename": file,
                "subfolder": subfolder,
                "type": "output" if save_to_output_dir else "temp",
                "format": format,
            }
        ]
        return {"ui": {"images": previews}}

class SaveImageWithOutput(SaveImage):
    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {"images": ("IMAGE", ),
                     "save_to_output": ("BOOLEAN", {"default": False}),
                     "filename_prefix": ("STRING", {"default": "ComfyUI"})},
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
                }
        
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "save_images_with_output"
    
    def save_images_with_output(self, images, save_to_output, filename_prefix="ComfyUI", prompt=None, extra_pnginfo=None):
        if not save_to_output:
            self.output_dir = folder_paths.get_temp_directory()
            self.type = "temp"
            self.prefix_append = "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstupvxyz") for x in range(5))
            self.compress_level = 1

        return self.save_images(images, filename_prefix, prompt, extra_pnginfo)
        
class SaveImages1:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("INT", {"default": 8, "min": 1, "step": 1}),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "file_name": ("STRING", {"default": "AnimateDiff"}),
                "save_to_output": ("BOOLEAN", {"default": False}),
                "save_directory_override": ("STRING",),
                "format": (JNODES_IMAGE_FORMAT_TYPES,),
                "output_quality": ("INT", {"default": 95, "min": 1, "max": 100, "step": 1}),
                "show_preview": ("BOOLEAN", {"default": False}),
                "preview_quality": ("INT", {"default": 25, "min": 1, "max": 100, "step": 1}),
                "save_meta_data": (["None", "output_and_json", "output_and_first_frame_of_video", "output_only"],),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "save_to_output_dirs"

    def save_to_output_dirs(
        self,
        images,
        frame_rate: int,
        loop_count: int,
        file_name="{counter} - AnimateDiff",
        save_to_output=True,
        format="video/webp",
        output_quality=95,
        show_preview=True,
        preview_quality=95,
        save_meta_data = "None",
        prompt=None,
        extra_pnginfo=None,
    ):
        # convert images to numpy
        frames: List[Image.Image] = []
        for image in images:
            img = 255.0 * image.cpu().numpy()
            img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
            frames.append(img)
            
        # get output information (full_output_folder, filename, counter, subfolder, _,)
        temp_output_info = folder_paths.get_save_to_output_dir_path(file_name, folder_paths.get_temp_directory())
        save_output_info = folder_paths.get_save_to_output_dir_path(file_name, folder_paths.get_output_directory())
        
        format_type, format_ext = format.split("/")
        file_name_with_temp_counter = file_name.replace("{counter}", f"{temp_output_info[2]}")
        file_name_with_save_counter = file_name.replace("{counter}", f"{save_output_info[2]}")
        
        duration = round(1000 / frame_rate)
        
        if show_preview:
            preview_path = os.path.join(temp_output_info[0], f"{file_name_with_temp_counter}.webp")
            frames[0].save(
                    preview_path,
                    format="webp",
                    save_all=True,
                    append_images=frames[1:],
                    duration=duration,
                    loop=loop_count,
                    quality=preview_quality
                )
        
        should_save_metadata = save_meta_data != "None"
        
        full_output_folder, filename, counter, subfolder, _, = save_output_info if save_to_output else temp_output_info

        if should_save_metadata:
            metadata = PngInfo()
            if prompt is not None:
                metadata.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo is not None:
                for x in extra_pnginfo:
                    metadata.add_text(x, json.dumps(extra_pnginfo[x]))
    
            if save_meta_data == "output_and_json":
                # save first frame as png to keep metadata
                file = f"{file_name}.json"
                file_path = os.path.join(full_output_folder, file)
                with open(file_path, 'w') as json_file:
                    json.dump(metadata, json_file)
            elif save_meta_data == "output_and_first_frame_of_video" and format_type != "image":
                # save first frame as png to keep metadata
                file = f"{file_name}.png"
                file_path = os.path.join(full_output_folder, file)
                frames[0].save(
                    file_path,
                    pnginfo=metadata,
                    compress_level=4,
                )
        
        file_path = os.path.join(full_output_folder, file)
        if format_type == "image":
            # Use pillow directly to save an animated image
            if format_ext == "webp":
                frames[0].save(
                    file_path, 
                    format=format_ext.upper(),
                    save_all=True,
                    append_images=frames[1:], 
                    duration=round(1000 / frame_rate), 
                    loop=loop_count, 
                    quality=95,
                    exif=metadata
                )
            else:
                frames[0].save(
                    file_path,
                    format=format_ext.upper(),
                    save_all=True,
                    append_images=frames[1:],
                    duration=round(1000 / frame_rate),
                    loop=loop_count,
                    compress_level=4,
                    comment=metadata
                )
        else:
            # Use ffmpeg to save a video
            ffmpeg_path = shutil.which("ffmpeg")
            if ffmpeg_path is None:
                #Should never be reachable
                raise ProcessLookupError("Could not find ffmpeg")

            video_format_path = folder_paths.get_full_path("video_formats", format_ext + ".json")
            with open(video_format_path, 'r') as stream:
                video_format = json.load(stream)
            file = f"{filename}_{counter:05}_.{video_format['extension']}"
            file_path = os.path.join(full_output_folder, file)
            dimensions = f"{frames[0].width}x{frames[0].height}"
            args = [ffmpeg_path, "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                    "-s", dimensions, "-r", str(frame_rate), "-i", "-"] \
                    + video_format['main_pass'] + [file_path]

            env=os.environ.copy()
            if  "environment" in video_format:
                env.update(video_format["environment"])
            with subprocess.Popen(args, stdin=subprocess.PIPE, env=env) as proc:
                for frame in frames:
                    proc.stdin.write(frame.tobytes())

        previews = []
        
        if show_preview:
            previews = [
                {
                    "filename": file,
                    "subfolder": subfolder,
                    "type": "output" if save_to_output_dir else "temp",
                    "format": format,
                }
            ]
        return (previews,)
    
class SaveImagesOld:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("FLOAT", {"default": 8, "min": 1, "step": 1}),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "file_name": ("STRING", {"default": "AnimateDiff"}),
                "save_to_output": ("BOOLEAN", {"default": False}),
                "format": (JNODES_IMAGE_FORMAT_TYPES,),
                "output_quality": ("INT", {"default": 95, "min": 1, "max": 100, "step": 1}),
                "show_preview": ("BOOLEAN", {"default": False}),
                "preview_quality": ("INT", {"default": 25, "min": 1, "max": 100, "step": 1}),
                "save_meta_data": (["None", "output_and_json", "output_and_first_frame_of_video", "output_only"],),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "save_to_output_dirs"

    def save_to_output_dirs(
        self,
        images,
        frame_rate: float,
        loop_count: int,
        file_name="{counter} - AnimateDiff",
        save_to_output=True,
        format="video/webp",
        output_quality=95,
        show_preview=True,
        preview_quality=95,
        save_meta_data = "None",
        prompt=None,
        extra_pnginfo=None,
    ):
        # convert images to numpy
        frames: List[Image.Image] = []
        for image in images:
            img = 255.0 * image.cpu().numpy()
            img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
            frames.append(img)
            
        # get output information (full_output_folder, filename, counter, subfolder, _,)
        temp_output_info = folder_paths.get_save_to_output_dir_path(file_name, folder_paths.get_temp_directory())
        save_output_info = folder_paths.get_save_to_output_dir_path(file_name, folder_paths.get_output_directory())
        
        format_type, format_ext = format.split("/")
        file_name_with_temp_counter = file_name.replace("{counter}", f"{temp_output_info[2]}")
        file_name_with_save_counter = file_name.replace("{counter}", f"{save_output_info[2]}")
        
        duration = round(1000 / frame_rate)
        
        if show_preview:
            preview_path = os.path.join(temp_output_info[0], f"{file_name_with_temp_counter}.webp")
            frames[0].save(
                    preview_path,
                    format="webp",
                    save_all=True,
                    append_images=frames[1:],
                    duration=duration,
                    loop=loop_count,
                    quality=preview_quality
                )
        
        should_save_metadata = save_meta_data != "None"
        
        full_output_folder, filename, counter, subfolder, _, = save_output_info if save_to_output else temp_output_info

        if should_save_metadata:
            metadata = PngInfo()
            if prompt is not None:
                metadata.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo is not None:
                for x in extra_pnginfo:
                    metadata.add_text(x, json.dumps(extra_pnginfo[x]))
    
            if save_meta_data == "output_and_json":
                # save first frame as png to keep metadata
                file = f"{file_name}.json"
                file_path = os.path.join(full_output_folder, file)
                with open(file_path, 'w') as json_file:
                    json.dump(metadata, json_file)
            elif save_meta_data == "output_and_first_frame_of_video" and format_type != "image":
                # save first frame as png to keep metadata
                file = f"{file_name}.png"
                file_path = os.path.join(full_output_folder, file)
                frames[0].save(
                    file_path,
                    pnginfo=metadata,
                    compress_level=4,
                )
        
        file_path = os.path.join(full_output_folder, file)
        if format_type == "image":
            # Use pillow directly to save an animated image
            if format_ext == "webp":
                frames[0].save(
                    file_path, 
                    format=format_ext.upper(),
                    save_all=True,
                    append_images=frames[1:], 
                    duration=round(1000 / frame_rate), 
                    loop=loop_count, 
                    quality=95,
                    exif=metadata
                )
            else:
                frames[0].save(
                    file_path,
                    format=format_ext.upper(),
                    save_all=True,
                    append_images=frames[1:],
                    duration=round(1000 / frame_rate),
                    loop=loop_count,
                    compress_level=4,
                    comment=metadata
                )
        else:
            # Use ffmpeg to save a video
            ffmpeg_path = shutil.which("ffmpeg")
            if ffmpeg_path is None:
                #Should never be reachable
                raise ProcessLookupError("Could not find ffmpeg")

            video_format_path = folder_paths.get_full_path("video_formats", format_ext + ".json")
            with open(video_format_path, 'r') as stream:
                video_format = json.load(stream)
            file = f"{filename}_{counter:05}_.{video_format['extension']}"
            file_path = os.path.join(full_output_folder, file)
            dimensions = f"{frames[0].width}x{frames[0].height}"
            args = [ffmpeg_path, "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                    "-s", dimensions, "-r", str(frame_rate), "-i", "-"] \
                    + video_format['main_pass'] + [file_path]

            env=os.environ.copy()
            if  "environment" in video_format:
                env.update(video_format["environment"])
            with subprocess.Popen(args, stdin=subprocess.PIPE, env=env) as proc:
                for frame in frames:
                    proc.stdin.write(frame.tobytes())

        previews = []
        
        if show_preview:
            previews = [
                {
                    "filename": file,
                    "subfolder": subfolder,
                    "type": "output" if save_to_output_dir else "temp",
                    "format": format,
                }
            ]
        return (previews,)