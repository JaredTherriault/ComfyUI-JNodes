
from abc import ABC, abstractmethod
from comfy_api.latest import io

from .py.server_backend import *

from aiohttp import web
from pathlib import Path

import asyncio
import importlib
import server

@server.PromptServer.instance.routes.get('/jnodes_list_comfyui_subdirectories')
async def list_comfyui_subdirectories_wrapper(request):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: list_comfyui_subdirectories_request(request))

@server.PromptServer.instance.routes.get('/jnodes_list_immediate_subdirectories')
async def list_immediate_subdirectories_wrapper(request):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: list_immediate_subdirectories_request(request))

@server.PromptServer.instance.routes.get('/jnodes_get_comfyui_subdirectory_images')
async def get_comfyui_subdirectory_images_wrapper(request):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: get_comfyui_subdirectory_images_request(request))

@server.PromptServer.instance.routes.get('/jnodes_list_model_subdirectories')
async def list_model_subdirectories_wrapper(request):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: list_model_subdirectories_request(request))

@server.PromptServer.instance.routes.get('/jnodes_model_items')
async def get_model_items_wrapper(request):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: get_model_items(request))

@server.PromptServer.instance.routes.post('/jnodes_save_model_user_info')
async def save_model_user_info_wrapper(request):
    return await save_model_user_info(request)

@server.PromptServer.instance.routes.get("/jnodes_view_image")
async def view_image_wrapper(request):
    return await view_image(request)

@server.PromptServer.instance.routes.post("/jnodes_save_image_as_model_preview")
async def save_image_as_model_preview_wrapper(request):
    return await save_image_as_model_preview(request)

@server.PromptServer.instance.routes.post('/jnodes_copy_item')
async def copy_item_wrapper(request):
    return await copy_item(request)

@server.PromptServer.instance.routes.get("/jnodes_load_info")
async def load_info_wrapper(request):
    return load_info(request)

@server.PromptServer.instance.routes.post('/jnodes_request_open_file_manager')
async def request_open_file_manager_wrapper(request):
    return await request_open_file_manager(request)

@server.PromptServer.instance.routes.post('/jnodes_request_task_cancellation')
async def request_task_cancellation_wrapper(request):
    request_task_cancellation()
    return web.json_response({"success": True})

@server.PromptServer.instance.routes.post('/jnodes_find_files')
async def find_files_wrapper(request):
    return await find_files(request)

@server.PromptServer.instance.routes.post('/jnodes_save_text')
async def save_text_wrapper(request):
    return await save_text(request)

@server.PromptServer.instance.routes.post('/jnodes_load_text')
async def load_text_wrapper(request):
    return await load_text(request)

@server.PromptServer.instance.routes.post('/jnodes_post_setting')
async def post_setting_wrapper(request):
    return await post_setting(request)

@server.PromptServer.instance.routes.post('/jnodes_post_all_settings')
async def post_all_settings_wrapper(request):
    return await post_all_settings(request)

@server.PromptServer.instance.routes.get('/jnodes_get_setting')
async def get_setting_wrapper(request):
    return await get_setting(request)

@server.PromptServer.instance.routes.get('/jnodes_get_all_settings')
async def get_all_settings_wrapper(request):
    return await get_all_settings(request)

@server.PromptServer.instance.routes.post("/jnodes_upload_image")
async def upload_image_wrapper(request):
    return await upload_image(request)

@server.PromptServer.instance.routes.delete("/jnodes_delete_item")
async def delete_item_wrapper(request):
    return await delete_item(request)

@server.PromptServer.instance.routes.get('/jnodes_get_browser_video_extensions')
def get_browser_video_extensions_wrapper(request):
    from .py.utils import ACCEPTED_BROWSER_VIDEO_EXTENSIONS
    return web.json_response({"success": True, "extensions": ACCEPTED_BROWSER_VIDEO_EXTENSIONS})

@server.PromptServer.instance.routes.post('/jnodes_edit_image_metadata')
async def edit_image_metadata_wrapper(request):
    return await edit_image_metadata(request)
    
WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

def load_nodes():

    for filename in (Path(__file__).parent.resolve() / "py").glob("*.py"):
        if not filename.is_file():
            continue
        if filename.suffix != ".py":
            continue
        if filename.name.startswith("."):
            continue
        if filename.name == "__init__.py":
            continue

        print("Loading:", filename)
        
        module_name = filename.stem
        module = importlib.import_module(f"{__package__}.py.{module_name}")

        try:
            NODE_CLASS_MAPPINGS.update(getattr(module, "NODE_CLASS_MAPPINGS"))
            if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
                NODE_DISPLAY_NAME_MAPPINGS.update(getattr(module, "NODE_DISPLAY_NAME_MAPPINGS"))      
        except:
            pass      

class JNodesExtension(ABC):
    async def on_load(self) -> None:
        """
        Called when an extension is loaded.
        This should be used to initialize any global resources needed by the extension.
        """

    @abstractmethod
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        """
        Returns a list of nodes that this extension provides.
        """

load_nodes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]