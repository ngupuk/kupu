import os

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Kupu Inpainting Worker", version="0.1.0"
)


class InputData(BaseModel):
    image: str  # base64 encoded image
    mask: str   # base64 encoded mask


@app.post("/inpaint")
async def inpaint_endpoint(request: InputData):
    import base64
    import io
    import time

    import numpy as np
    from main import global_inpainter
    from PIL import Image

    start_time = time.time()

    image_b64 = request["image"].split(",")[-1]
    mask_b64 = request["mask"].split(",")[-1]

    image = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert('RGB')
    mask = Image.open(io.BytesIO(base64.b64decode(mask_b64))).convert('L')

    result = global_inpainter.inpaint(np.array(image), np.array(mask))

    # Save result
    result_image = Image.fromarray(result.astype(np.uint8))
    buffered = io.BytesIO()
    result_image.save(buffered, format="PNG")
    result_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    end_time = time.time()
    print(f"Inpainting completed in {end_time - start_time:.2f} seconds")

    return {
        "result": "data:image/png;base64," + result_b64,
        "time_taken": end_time - start_time
    }
