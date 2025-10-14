# Pil image from base64
import base64
import io

import numpy as np
import uvicorn
from inpainter import Inpainter
from PIL import Image
from utils import download_model_if_missing

model_path = "./model/big-lama.pt"
global_inpainter = None


if __name__ == "__main__":
    model = download_model_if_missing()
    uvicorn.run("server:app", host="0.0.0.0", port=8000,
                log_level="info", reload=True)

    print("Worker started")
