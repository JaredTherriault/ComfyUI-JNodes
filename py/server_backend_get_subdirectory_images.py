import os 
import re 

from .logger import *
from .utils import *

import concurrent
import multiprocessing

import cv2
import json
import subprocess
import piexif
from PIL import Image, PngImagePlugin, ExifTags

DEBUG = False

class GetSubdirectoryImages:

    def __init__(self, in_directory, recursive):
        self.CANCELLATION_REQUESTED = False

        self.in_directory = in_directory
        self.recursive = recursive

        self.results = []

    def should_cancel_task(self):
        return self.CANCELLATION_REQUESTED

    def get_subdirectory_images(self):
        
        """
        List images and directories in the specified root directory, optionally including files from subdirectories.

        Args:
            in_subdirectory (str): The root directory from which to start listing files and directories.
            recursive (bool): Whether to include images from subdirectories.

        Returns:
            list: A list of dictionaries containing information about images.
        """

        import time
        start_time = time.time()

        self.walk_through_subdirectories_and_files("")

        end_time = time.time()
        print(f"Execution time (get_subdirectory_images): got {len(self.results)} results in {end_time - start_time} seconds")

        return self.results

    def walk_through_subdirectories_and_files(self, current_subdirectory):
        """
        Recursively list files and directories within the specified directory.

        Args:
            current_subdirectory (str): The directory to process.
        """
        if self.should_cancel_task():
            return

        full_directory = os.path.join(self.in_directory, current_subdirectory)
        if not os.path.isdir(full_directory):
            return   

        def evaluate_result(result):
            if result[0] == False:
                full_path = result[1]
                if self.recursive and os.path.isdir(full_path):

                    new_subd = os.path.join(current_subdirectory, os.path.basename(full_path.replace("\\", "/")))
                    self.walk_through_subdirectories_and_files(new_subd)

            else:
                self.results.append(result[1])

        def do_multiprocess(in_items): 
            proc_count = multiprocessing.cpu_count()
            proc_count_recursive = max(1, int(proc_count / 2)) # To ensure we don't overflow in recursive multiprocess loads
            args = [(item, full_directory, current_subdirectory) for item in in_items]
            with multiprocessing.Pool(processes= 1 if DEBUG else proc_count_recursive if self.recursive else proc_count) as pool:
                results_from_pool = pool.starmap(process_item, args)
                for result in results_from_pool:
                    evaluate_result(result)

        def do_multithreading(in_items):
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(process_item, item, full_directory, current_subdirectory) for item in in_items]

                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    evaluate_result(result)

        def do_sequential(in_items): 
            for item in in_items:
                result = process_item(item, full_directory, current_subdirectory)
                evaluate_result(result)

        def prefer_multithreading(items):
            try: 
                do_multithreading(items)

            except Exception as e2: 

                log_exception("Error:", e2)

                do_sequential(items)

        def prefer_multiprocess(items):
            try: 
                do_multiprocess(items)

            except Exception as e1:

                log_exception("Error:", e1)

                prefer_multithreading(items)

        def do_auto(items):

            # Sort out items by type
            videos = []
            others = []

            for item in items:
                if is_video(item):
                    videos.append(item)
                else:
                    others.append(item)

            # At 5000+ images or 60+ videos multiprocess becomes faster, 
            # but multithreaded performance is better in recursion
            # At small numbers of items, sequential is much faster than multithreading
            # in terms of percentage, but the end user won't feel a difference
            # And in recursive workloads sequential performs worse when multiple subfolders are present
            if len(videos) > 0:
                if len(videos) > (200 if self.recursive else 60):
                    prefer_multiprocess(videos)
                else:
                    prefer_multithreading(videos)

            if len(others) > 0:
                if len(others) > (10000 if self.recursive else 5000):
                    prefer_multiprocess(others)
                else:
                    prefer_multithreading(others)

        items = os.listdir(full_directory)  
        do_auto(items)

def process_item(item, full_directory, current_subdirectory):
    """
    Process a single file or directory item.

    Args:
        item (str): The name of the file or directory.
    """

    full_path = os.path.join(full_directory, item)

    if os.path.isfile(full_path) and is_acceptable_image_or_video_for_browser_display(item):

        return True, process_acceptable_item(item, current_subdirectory, full_path)
            
    return False, full_path, item

def extract_png_metadata(img):
    """Extracts PNG metadata."""
    metadata = {}
    if isinstance(img.info, dict):
        for key, value in img.info.items():
            metadata[key] = value
    return metadata

def extract_jpg_exif(img):
    """Extracts EXIF metadata from JPG/WebP."""
    exif_data = {}
    try:
        exif_raw = img._getexif()
        if exif_raw:
            exif_data = {ExifTags.TAGS.get(tag, tag): value for tag, value in exif_raw.items()}
            # Decode UserComment if it's JSON
            if "UserComment" in exif_data:
                try:
                    exif_data = json.loads(piexif.helper.UserComment.load(exif_data["UserComment"]))
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        logger.warning(f"Unable to extract EXIF data: {e}")
    return exif_data

def extract_gif_comment(img):
    """Extracts JSON metadata stored in a GIF comment, if available."""
    try:
        comment = img.info.get("comment", "").decode("utf-8")
        return json.loads(comment) if comment else None
    except (json.JSONDecodeError, AttributeError):
        return comment  # Return raw text if it's not JSON

def extract_video_metadata(full_path):
    """Extracts video metadata using ffprobe via subprocess."""
    metadata = {}
    try:
        # Run ffprobe and capture JSON output
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_format", "-print_format", "json", full_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # Parse JSON output
        probe = json.loads(result.stdout)
        format_tags = probe.get("format", {}).get("tags", {})
        
        # Handle comment field
        if "comment" in format_tags:
            try:
                metadata = json.loads(format_tags["comment"])
            except json.JSONDecodeError:
                metadata["comment"] = format_tags["comment"]
    except Exception as e:
        logger.warning(f"Unable to extract video metadata: {e}")

    return metadata

def process_acceptable_item(item, current_subdirectory, full_path):
    file_size = os.path.getsize(full_path)
    dimensions = [0, 0]
    is_video_item = is_video(item)
    file_age = os.path.getctime(full_path)
    frame_count = -1
    fps = -1

    metadata_read = True
    metadata = {}

    try:
        if is_video_item:
            metadata = extract_video_metadata(full_path)

            try: # Attempt on GPU first
                cap = cv2.cudacodec.VideoReader(full_path)
            except:
                cap = cv2.VideoCapture(full_path)
            if cap.isOpened():
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                dimensions = [width, height]

                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                fps = cap.get(cv2.CAP_PROP_FPS)

                cap.release()
        else:
            with Image.open(full_path) as img:
                dimensions = img.size
                ext = full_path.lower()

                if ext.endswith(".png"):
                    metadata = extract_png_metadata(img)
                elif ext.endswith(".jpg") or ext.endswith(".jpeg") or ext.endswith(".webp"):
                    metadata = extract_jpg_exif(img)
                elif ext.endswith(".gif"):
                    metadata["comment"] = extract_gif_comment(img)

        # Filter out json-incompatible metadata
        json_serializable_meta = {}
        for tag, value in metadata.items():
            
            try:
                as_dict = {tag: value}
                json.dump(as_dict)
            
                json_serializable_meta[tag] = value
            except:
                pass
        metadata = json_serializable_meta

    except Exception as e:
        metadata_read = False
        logger.warning(f"Unable to get metadata for '{full_path}': {e}")

    return {
        'item': item,
        'format': f"{'video' if is_video_item else 'image'}/{get_file_extension_without_dot(item)}",
        "file_age": file_age, 
        'file_size': file_size,
        'dimensions': dimensions,
        'is_video': is_video_item,
        'metadata_read': metadata_read,
        "subdirectory": current_subdirectory,
        'metadata': metadata,
        'frame_count': frame_count, 
        'fps': fps, 
        'duration_in_seconds': frame_count / fps if frame_count > 1 and fps > 1 else -1
    }