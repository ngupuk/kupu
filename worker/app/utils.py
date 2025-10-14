

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

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
