
from .py.server_backend import *

from aiohttp import web
from pathlib import Path

import importlib
import server

@server.PromptServer.instance.routes.get('/jnodes_list_comfyui_subdirectories')
async def list_comfyui_subdirectories_wrapper(request):
    return list_comfyui_subdirectories_request(request)

@server.PromptServer.instance.routes.get('/jnodes_list_immediate_subdirectories')
async def list_immediate_subdirectories_wrapper(request):
    return list_immediate_subdirectories_request(request)

@server.PromptServer.instance.routes.get('/jnodes_get_comfyui_subdirectory_images')
async def get_comfyui_subdirectory_images_wrapper(request):
    return get_comfyui_subdirectory_images_request(request)

@server.PromptServer.instance.routes.get('/jnodes_model_items')
async def get_model_items_wrapper(request):
    return get_model_items(request)

@server.PromptServer.instance.routes.get('/jnodes_save_model_config')
async def save_model_config_wrapper(request):
    return save_model_config(request)

@server.PromptServer.instance.routes.get("/jnodes_view_image")
async def view_image_wrapper(request):
    return await view_image(request)

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
    return request_task_cancellation(request)

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
    
WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

def load_nodes():

    for filename in (Path(__file__).parent.resolve() / "py").iterdir():
        
        module_name = filename.stem
        module = importlib.import_module(
            f".py.{module_name}", package=__package__
        )

        try:
            NODE_CLASS_MAPPINGS.update(getattr(module, "NODE_CLASS_MAPPINGS"))
            if hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS"):
                NODE_DISPLAY_NAME_MAPPINGS.update(getattr(module, "NODE_DISPLAY_NAME_MAPPINGS"))      
        except:
            pass      

load_nodes()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
