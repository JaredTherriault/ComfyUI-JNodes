import os 
import re 

from .logger import *
from .utils import *

from PIL import Image

import concurrent
import multiprocessing

import cv2

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
        print(f"Execution time (get_subdirectory_images): {end_time - start_time} seconds")

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

        def evaulate_result(result):
            if result[0] == False:
                full_path = result[1]
                if self.recursive and os.path.isdir(full_path):

                    new_subd = os.path.join(current_subdirectory, item)
                    self.walk_through_subdirectories_and_files(new_subd)

            else:
                self.results.append(result[1])

        def do_multiprocess(in_items): 
            proc_count = multiprocessing.cpu_count()
            proc_count_recursive = max(1, int(proc_count / 2)) # To ensure we don't overflow in recursive multiprocess loads
            args = [(item, full_directory, current_subdirectory) for item in in_items]
            with multiprocessing.Pool(processes= proc_count_recursive if self.recursive else proc_count) as pool:
                results_from_pool = pool.starmap(process_item, args)
                for result in results_from_pool:
                    evaulate_result(result)

        def do_multithreading(in_items):
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(process_item, item, full_directory, current_subdirectory) for item in in_items]

                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    evaulate_result(result)

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

def process_acceptable_item(item, current_subdirectory, full_path):
    file_size = os.path.getsize(full_path)
    dimensions = [0, 0]
    frame_count = -1
    fps = -1
    is_video_item = is_video(item)

    metadata_read = True

    try:
        if is_video_item:
            try:
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
    except Exception as e:
        metadata_read = False
        logger.warning(f"Unable to get meta for '{full_path}': {e}")

    file_age = os.path.getctime(full_path)
    file_format = f"{'video' if is_video_item else 'image'}/{get_file_extension_without_dot(item)}"
    
    return {
        'item': item, 'file_age': file_age, 'format': file_format, 'file_size': file_size, 'dimensions': dimensions,
        'is_video': is_video_item, 'metadata_read': metadata_read, "subdirectory": current_subdirectory,
        'frame_count': frame_count, 'fps': fps, 
        'duration_in_seconds': frame_count / fps if frame_count > 1 and fps > 1 else -1
    }