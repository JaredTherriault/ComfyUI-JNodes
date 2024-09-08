import os
import sys
from pathlib import Path

import folder_paths
from .logger import logger
from .misc import *
from .utils import *

import copy
import cv2
import json
import math
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

FFMPEG_PATH = shutil.which("ffmpeg")
if FFMPEG_PATH is None:
    logger.info("ffmpeg could not be found. Using ffmpeg from imageio-ffmpeg.")
    from imageio_ffmpeg import get_ffmpeg_exe
    try:
        FFMPEG_PATH = get_ffmpeg_exe()
    except:
        logger.warning("ffmpeg could not be found. Outputs that require it have been disabled")

class SaveVideo():
    '''
    Based on work done by Kosinkadink as a part of the Video Helper Suite.
    '''
    @classmethod
    def INPUT_TYPES(s):
        # Get the list of filenames (including .json files) in the directory
        file_names = os.listdir(VIDEO_FORMATS_DIRECTORY)

        # Filter out only the JSON files (those ending with .json)
        json_files = [filename for filename in file_names if filename.endswith(".json")]

        # Generate the video format names by removing ".json" and prefixing with "video/"
        video_formats = ["video/" + filename[:-5] for filename in json_files]

        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("INT", {"default": 8, "min": 1, "step": 1},),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "filename_format": ("STRING", {"default": "Comfy%counter%"}),
                "output_format": (["image/gif", "image/webp", "image/apng"] + video_formats,),
                "save_to_output_dir": ("BOOLEAN", {"default": True}),
                "quality": ("INT", {"default": 95, "min": 0, "max": 100, "step": 1}),
                "save_metadata": ("BOOLEAN", {"default": True}),
                "save_workflow": ("BOOLEAN", {"default": True}),
                "audio_file": ("STRING", {"default": ""}),
                "batch_size": ("INT", {"default": 128, "min": 32, "step": 1}),
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
        frame_rate: int,
        loop_count: int,
        filename_format="Comfy%counter%",
        output_format="image/webp",
        save_to_output_dir=True,
        quality=95,
        save_metadata=True,
        save_workflow=True,
        audio_file="",
        batch_size=128,
        prompt=None,
        extra_pnginfo=None
    ):

        
        audio_options = {}
        audio_options["audio_input_path"] = audio_file
        audio_options["clip_audio"] = False

        return SaveVideoWithOptions().combine_video(
            images, frame_rate, loop_count,
            filename_format, output_format,
            save_to_output_dir, quality,
            save_metadata, save_workflow,
            batch_size, audio_options,
            prompt, extra_pnginfo
        )

class SaveVideoWithOptions():
    '''
    Based on work done by Kosinkadink as a part of the Video Helper Suite.
    '''
    @classmethod
    def INPUT_TYPES(s):
        # Get the list of filenames (including .json files) in the directory
        file_names = os.listdir(VIDEO_FORMATS_DIRECTORY)

        # Filter out only the JSON files (those ending with .json)
        json_files = [filename for filename in file_names if filename.endswith(".json")]

        # Generate the video format names by removing ".json" and prefixing with "video/"
        video_formats = ["video/" + filename[:-5] for filename in json_files]

        return {
            "required": {
                "images": ("IMAGE",),
                "frame_rate": ("INT", {"default": 8, "min": 1, "step": 1},),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "filename_format": ("STRING", {"default": "Comfy%counter%"}),
                "output_format": (["image/gif", "image/webp", "image/apng"] + video_formats,),
                "save_to_output_dir": ("BOOLEAN", {"default": True}),
                "quality": ("INT", {"default": 95, "min": 0, "max": 100, "step": 1}),
                "save_metadata": ("BOOLEAN", {"default": True}),
                "save_workflow": ("BOOLEAN", {"default": True}),
                "batch_size": ("INT", {"default": 128, "min": 32, "step": 1}),
            },
            "optional": {
                "audio_options": ("AUDIO_INPUT_OPTIONS",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    OUTPUT_NODE = True
    FUNCTION = "combine_video"

    @staticmethod
    def determine_file_name(filename, full_output_folder, output_format):

        format_type, format_ext_mime = output_format.split("/")
        format_ext = format_ext_mime

        for ext in ACCEPTED_IMAGE_AND_VIDEO_EXTENSIONS_COMPENDIUM:
            if ext in format_ext_mime:
                format_ext = ext 
                break
 
        file_path = os.path.join(full_output_folder, f"{filename}.{format_ext}")

        counter_token = "%counter%"
        if counter_token in filename:
            counter = len(os.listdir(full_output_folder)) + 1
            new_filename = filename.replace(counter_token, str(counter).zfill(5))
            file_path = os.path.join(full_output_folder, f"{new_filename}.{format_ext}")
            
            while os.path.exists(file_path):
                counter += 1
                new_filename = filename.replace(counter_token, str(counter).zfill(5))
                file_path = os.path.join(full_output_folder, f"{new_filename}.{format_ext}")

        return file_path, format_type, format_ext_mime, format_ext

    def combine_video(
        self,
        images,
        frame_rate: int,
        loop_count: int,
        filename_format="Comfy%counter%",
        output_format="image/webp",
        save_to_output_dir=True,
        quality=95,
        save_metadata=True,
        save_workflow=True,
        batch_size=128,
        audio_options=None,
        prompt=None,
        extra_pnginfo=None
    ):

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
        ) = folder_paths.get_save_image_path(filename_format, output_dir)
                
        file_path, format_type, format_ext_mime, format_ext = self.determine_file_name(
            filename, full_output_folder, output_format
        )

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
            
        if format_type == "image":
            
            frames = [tensor2pil(f)[0] for f in images]
            
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
            if FFMPEG_PATH is None:
                #Should never be reachable
                raise ProcessLookupError("Could not find ffmpeg")

            video_format_path = os.path.join(VIDEO_FORMATS_DIRECTORY, format_ext_mime + ".json")
            with open(video_format_path, 'r') as stream:
                video_format = json.load(stream)
                if "extension" in video_format:
                    format_ext = video_format["extension"]
            dimensions = f"{len(images[0][0])}x{len(images[0])}"
            output_quality = map_to_range(quality, 0, 100, 50, 1) # ffmpeg quality maps from 50 (worst) to 1 (best)
            args = [FFMPEG_PATH, "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                    "-s", dimensions, "-r", str(frame_rate), "-i", "-", "-crf", str(output_quality) ] \
                    + video_format['main_pass']

            env=os.environ.copy()
            if  "environment" in video_format:
                env.update(video_format["environment"])

            full_output_folder_temp = f"{full_output_folder}/temp"
            os.makedirs(full_output_folder_temp, exist_ok=True)

            interim_file_paths = []
            total_passes = math.ceil(float(len(images)) / float(batch_size))
            total_passes_digit_count = len(str(total_passes))
            join_videos_instance = JoinVideosInDirectory()
            for start in range(0, len(images), batch_size):

                batch_count = len(interim_file_paths) + 1
                logger.info(f"SaveVideo: Processing batch {str(batch_count).zfill(total_passes_digit_count)} of {total_passes}")

                end = min(start + batch_size, len(images))
                image_batch = images[start:end]
                
                # convert images to numpy
                image_batch = (image_batch.cpu().numpy() * 255.0).astype(np.uint8)

                interim_file_path = f"{full_output_folder_temp}/{get_clean_filename(file_path)}_{len(interim_file_paths)}.{format_ext}"
                interim_file_paths.append(interim_file_path)

                res = None
                # images = images.tobytes()
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
                        res = subprocess.run(m_args + [interim_file_path], input=image_batch.tobytes(),
                                            capture_output=True, check=True, env=env)
                    except subprocess.CalledProcessError as e:
                        #Res was not set
                        print(e.stderr.decode("utf-8"), end="", file=sys.stderr)
                        logger.warn("An error occurred when saving with metadata")

                if not res:
                    try:
                        res = subprocess.run(args + [interim_file_path], input=image_batch.tobytes(),
                                            capture_output=True, check=True, env=env)
                    except subprocess.CalledProcessError as e:
                        raise Exception("An error occured in the ffmpeg subprocess:\n" \
                                + e.stderr.decode("utf-8"))
                if res.stderr:
                    print(res.stderr.decode("utf-8"), end="", file=sys.stderr)

            join_videos_instance.join_videos_in_directory(full_output_folder_temp, file_path, audio_options, True)

        previews = [
            {
                "filename": f"{get_clean_filename(file_path)}.{format_ext}",
                "subfolder": subfolder,
                "type": "output" if save_to_output_dir else "temp",
                "format": output_format,
            }
        ]
        return {"ui": {"images": previews}}

class AudioInputOptions:

    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {
                        "audio_input_path": ("STRING", {"default": "/path/"}),
                        "clip_audio": ("BOOLEAN", {"default": False}),
                        "audio_clip_start_seconds": ("FLOAT", {"default": 0, "min": 0}),
                        "audio_clip_duration": ("FLOAT", {"default": 0, "min": 0}),
                     },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }
        
    RETURN_TYPES = ("AUDIO_INPUT_OPTIONS",)
    FUNCTION = "execute"

    def execute(self, **kwargs):
        kwargs_copy = copy.deepcopy(kwargs)
        kwargs_copy["audio_input_path"] = resolve_file_path(kwargs["audio_input_path"])
        return (kwargs_copy,)

class JoinVideosInDirectory:

    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {
                        "directory_containing_videos": ("STRING", {"default": "/path/"}),
                        "output_file_path": ("STRING", {"default": "/path/"}),
                        "audio_input_options": ("AUDIO_INPUT_OPTIONS",),
                        "delete_directory_containing_videos": ("BOOLEAN", {"default": False}),
                     },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }
        
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "join_videos_in_directory"

    def join_videos_in_directory(
        self, directory_containing_videos, output_file_path, audio_input_options, delete_directory_containing_videos=False
    ):

        directory_containing_videos = resolve_file_path(directory_containing_videos)
        output_file_path = resolve_file_path(output_file_path)

        full_output_directory = os.path.dirname(output_file_path)
        os.makedirs(full_output_directory, exist_ok=True)         

        # Get a list of video files in the folder
        video_files = [f for f in os.listdir(directory_containing_videos) if is_video(os.path.join(directory_containing_videos, f))]

        if not video_files:
            print("No video files found in the folder.")
            return

        should_apply_audio = False
        if audio_input_options:
            audio_input_path = audio_input_options.get("audio_input_path")
            should_apply_audio = os.path.isfile(audio_input_path) and self.has_audio_track(audio_input_path)

        if not should_apply_audio and len(video_files) == 1:
            source_file = os.path.join(directory_containing_videos, video_files[0])

            if source_file != output_file_path:
                try:
                    shutil.copy(source_file, output_file_path)
                    print(f"Single video file copied from {source_file} to {output_file_path}")
                except IOError as e:
                    print(f"An error occurred while copying the file: {e}")
        else:

            def alphanumeric_sort_key(filename):
                """Sort filenames alphanumerically."""
                return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', filename)]

            # Sort video files to maintain order
            video_files.sort(key=alphanumeric_sort_key)

            # Create a file to list video files
            list_file_path = os.path.join(directory_containing_videos, 'video_list.txt')

            with open(list_file_path, 'w') as list_file:
                for video_file in video_files:
                    list_file.write(f"file '{os.path.join(directory_containing_videos, video_file)}'\n")       
            
            # Preemptively create trimmed audio path even if we don't need it 
            trimmed_audio_path = os.path.join(directory_containing_videos, 'trimmed_audio.aac')

            # Build the ffmpeg command to concatenate videos and apply audio
            if should_apply_audio:
                audio_codec = 'aac'
                if output_file_path.endswith("webm"):
                    audio_codec = 'libopus'
                audio_input_path = audio_input_options.get("audio_input_path")                
                clip_audio = audio_input_options.get("clip_audio", False)
                audio_clip_start_seconds = audio_input_options.get("audio_clip_start_seconds", 0)
                audio_clip_duration = audio_input_options.get("audio_clip_duration", 0)

                use_whole_audio = audio_clip_start_seconds == 0 and audio_clip_duration == 0

                if clip_audio and not use_whole_audio:
                    # Trim the audio first
                    audio_duration = self.get_audio_duration(audio_input_path)
                    if audio_clip_duration == 0 or audio_clip_start_seconds + audio_clip_duration > audio_duration:
                        audio_clip_duration = audio_duration - audio_clip_start_seconds
                    audio_trim_command = [
                        'ffmpeg',
                        '-i', audio_input_path,
                        '-ss', str(audio_clip_start_seconds),
                        '-t', str(audio_clip_duration),
                        '-c:a', 'aac',
                        trimmed_audio_path
                    ]
                    try:
                        subprocess.run(audio_trim_command, check=True)
                        print(f"Trimmed audio saved to {trimmed_audio_path}")
                    except subprocess.CalledProcessError as e:
                        print(f"An error occurred during audio trimming: {e}")
                        return
                    audio_path_to_use = trimmed_audio_path
                else:
                    audio_path_to_use = audio_input_path

                ffmpeg_command_final = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', list_file_path,
                    '-i', audio_path_to_use,
                    '-c:v', 'copy',
                    '-c:a', audio_codec,
                    '-strict', 'experimental',
                    # '-loglevel', 'debug',  # Add this for detailed logs
                    output_file_path
                ]

            else:
                # No audio file provided
                ffmpeg_command_final = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', list_file_path,
                    '-c:v', 'copy',
                    '-strict', 'experimental',
                    output_file_path
                ]

            try:
                # Run ffmpeg to concatenate videos and optionally apply audio
                process_final = subprocess.Popen(
                    ffmpeg_command_final, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True
                )

                # Read the output and error streams
                stdout, stderr = process_final.communicate()

                # Wait for the process to finish
                process_final.wait()
                if process_final.returncode == 0:
                    print(f"\nProcessing complete. Output file: {output_file_path}")
                else:
                    print(f"\nAn error occurred during processing: ffmpeg process returned non-zero exit code {process_final.returncode}")
                    print(stdout)
                    print(stderr)
                    return

            except subprocess.CalledProcessError as e:
                print(f"\nAn error occurred: {e}")

            finally:
                # Clean up
                if os.path.exists(list_file_path):
                    os.remove(list_file_path)
                if os.path.exists(trimmed_audio_path):
                    os.remove(trimmed_audio_path)

        # Clean up video directory if desired
        if delete_directory_containing_videos:
            shutil.rmtree(directory_containing_videos)

        output_directory = folder_paths.get_output_directory()
        temp_directory = folder_paths.get_temp_directory()

        save_to_output_dir = output_file_path.startswith(output_directory)
        save_to_temp_dir = output_file_path.startswith(temp_directory)

        # While saving anywhere is supported, we can only display temp/output types
        if save_to_output_dir or save_to_temp_dir:
            filename = get_clean_filename(output_file_path)     
            format_ext = get_file_extension_without_dot(output_file_path)       
            subfolder = full_output_directory.replace(
                output_directory if save_to_output_dir else temp_directory,""
            )
            if subfolder.startswith("/"):
                subfolder = subfolder[1:]
            output_format = f"video/{format_ext}"
            
            previews = [
                {
                    "filename": f"{filename}.{format_ext}",
                    "subfolder": subfolder,
                    "type": "output" if save_to_output_dir else "temp",
                    "format": output_format,
                }
            ]
            return {"ui": {"images": previews}}

        return {}

    def get_audio_duration(self, file_path):
        """Get the duration of an audio file in seconds."""
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        info = json.loads(result.stdout)
        return float(info['format']['duration'])

    def has_audio_track(self, file_path):
        try:
            # Run ffprobe command to get stream information in JSON format
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-show_entries', 'stream=codec_type',
                    '-of', 'json',
                    file_path
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True
            )

            # Parse the JSON output
            output = json.loads(result.stdout)
            streams = output.get('streams', [])

            # Check if any of the streams are of type 'audio'
            for stream in streams:
                if stream.get('codec_type') == 'audio':
                    return True
            
            return False

        except subprocess.CalledProcessError as e:
            print(f"An error occurred while running ffprobe: {e}")
            return False

class SaveImageWithOutput(SaveImage):
    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {
                        "images": ("IMAGE", ),
                        "save_to_output": ("BOOLEAN", {"default": False}),
                        "filename_prefix": ("STRING", {"default": "ComfyUI"})
                     },
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
        

NODE_CLASS_MAPPINGS = {
    
    "JNodes_SaveVideo": SaveVideo,
    "JNodes_SaveVideoWithOptions": SaveVideoWithOptions,
    "JNodes_AudioInputOptions": AudioInputOptions,
    "JNodes_JoinVideosInDirectory": JoinVideosInDirectory,
    "JNodes_SaveImageWithOutput": SaveImageWithOutput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    
    "JNodes_SaveVideo": "Save Video (DEPRECATED, USE 'JNodes_SaveVideoWithOptions')",
    "JNodes_SaveVideoWithOptions": "Save Video (With Options)",
    "JNodes_AudioInputOptions": "Audio Input Options (For Video Output)",
    "JNodes_JoinVideosInDirectory": "Join Videos In Directory",
    "JNodes_SaveImageWithOutput": "Save Image With Output",
}