# Pil image from base64
import base64
import io
import os
import shutil
from pathlib import Path

import numpy as np
from huggingface_hub import hf_hub_download
from inpainter import Inpainter
from PIL import Image

model_path = "./model/big-lama.pt"


def download_model_if_missing():
    """Download the LaMa model from Hugging Face if it doesn't exist locally"""
    abs_model_path = Path(model_path).resolve()
    if abs_model_path.exists():
        print(f"Model already exists at {model_path}")
        return abs_model_path

    downloaded_path = hf_hub_download(
        repo_id="ardiantovn/big-lama",
        filename="big-lama.pt",
        cache_dir=None,  # Use default cache
        local_dir=None   # Download to cache first
    )

    os.makedirs(abs_model_path.parent, exist_ok=True)
    shutil.copy(downloaded_path, abs_model_path)
    return abs_model_path


if __name__ == "__main__":
    model = download_model_if_missing()

    # Load sample request
    path = "./sample/request.json"
    with open(path, "r") as f:
        sample_request = f.read()
        # parse to dict
        import json
        sample_request = json.loads(sample_request)

    # log time taken to inpaint
    import time
    start_time = time.time()

    image_b64 = sample_request["image"].split(",")[-1]
    mask_b64 = sample_request["mask"].split(",")[-1]

    image = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert('RGB')
    mask = Image.open(io.BytesIO(base64.b64decode(mask_b64))).convert('L')

    global_inpainter = Inpainter(model_path=model)
    result = global_inpainter.inpaint(np.array(image), np.array(mask))

    # Save result
    result_image = Image.fromarray(result.astype(np.uint8))
    result_image.save("./sample/result.png")
    # get base64 of result
    buffered = io.BytesIO()
    result_image.save(buffered, format="PNG")
    result_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    # Processing output
    with open("./sample/result.b64", "w") as f:
        f.write("data:image/png;base64,")
        f.write(result_b64)  # save only base64 string
    global_inpainter.clear_memory_cache()

    end_time = time.time()
    print(f"Inpainting completed in {end_time - start_time:.2f} seconds")

    print("Worker started")
