#!/usr/bin/env python3
"""
FastAPI Server for React Inpainter Application

This server provides API endpoints for image inpainting functionality
using the existing Inpainter model from the parent directory.
"""

import argparse
import base64
import io
import sys
import torch
import numpy as np
import uvicorn
import traceback
import psutil
import os
import shutil
import sys

from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
from loguru import logger
from huggingface_hub import hf_hub_download

from inpainter import Inpainter

logger.remove()

# Add current directory to path to import inpainter and config
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

def download_model_if_missing():
    """Download the LaMa model from Hugging Face if it doesn't exist locally"""
    checkpoint_path = "./checkpoints/big-lama.pt"

    # Convert relative path to absolute path
    if not os.path.isabs(checkpoint_path):
        # Remove leading "./" if present
        clean_path = checkpoint_path.lstrip("./")
        checkpoint_path = os.path.join(current_dir, clean_path)

    checkpoint_file = Path(checkpoint_path)

    # Check if model file exists and is a valid file (not a directory)
    if checkpoint_file.exists() and checkpoint_file.is_file() and checkpoint_file.stat().st_size > 0:
        logger.info(f"✅ Model found at: {checkpoint_path}")
        return

    # Create checkpoints directory if it doesn't exist
    checkpoint_file.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"📥 Model not found. Downloading from Hugging Face...")
    logger.info(f"📁 Saving to: {checkpoint_path}")

    # Download model using huggingface_hub
    downloaded_path = hf_hub_download(
        repo_id="ardiantovn/big-lama",
        filename="big-lama.pt",
        cache_dir=None,  # Use default cache
        local_dir=None   # Download to cache first
    )

    # Copy from cache to our target location
    
    shutil.copy2(downloaded_path, checkpoint_path)

    logger.info(f"✅ Model downloaded successfully to: {checkpoint_path}")


# Initialize global inpainter immediately at module level
logger.info("🔄 Initializing global inpainter at module level...")
try:
    download_model_if_missing()
    global_inpainter = Inpainter()
    # logger.info(f"🎨 Global inpainter initialized with device: {global_inpainter.device}")
except Exception as e:
    logger.error(f"❌ Failed to initialize global inpainter: {e}")
    global_inpainter = None


app = FastAPI(
    title="Kupu Server",
    description="AI inpainter",
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Configure CORS for production security
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
            "http://localhost:3000",  # Configured frontend port
        ],
    allow_credentials=False,  # Changed to False for security
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],  # Restricted headers
    expose_headers=["Cache-Control", "Pragma", "Expires"],
)

# Trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "0.0.0.0", "*"]  # Configure for your deployment
)

# Inpainter will be initialized per request or globally as needed

# Pydantic models for API contracts
class InpaintRequest(BaseModel):
    image: str  # base64 encoded resized image data for processing
    original_image: Optional[str] = None  # base64 encoded original image data for overlay
    mask: str   # base64 encoded mask data
    original_width: Optional[int] = None  # original image width for upscaling
    original_height: Optional[int] = None  # original image height for upscaling

class SimplifiedInpaintRequest(BaseModel):
    image: str  # base64 encoded image data
    mask: str   # base64 encoded mask data


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str = "1.0.0"

class MemoryResponse(BaseModel):
    system_memory_mb: float
    system_memory_percent: float
    device_type: str
    mps_memory_mb: Optional[float] = None
    cuda_memory_mb: Optional[float] = None
    config_max_image_size: int

@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - only used when React build is not available"""
    return {
        "message": "Kupu Server",
        "api_docs": "/docs",
        "health_check": "/health",
        "memory_check": "/memory"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint to verify server and model status"""
    model_loaded = global_inpainter is not None

    return HealthResponse(
        status="healthy",
        model_loaded=model_loaded
    )

@app.get("/memory", response_model=MemoryResponse)
async def memory_status():
    """Memory status endpoint for debugging memory issues"""

    # System memory with psutil
    memory = psutil.virtual_memory()
    system_memory_mb = memory.used / 1024 / 1024
    system_memory_percent = memory.percent

    device_type = "none"
    cuda_memory_mb = None
    mps_memory_mb = None

    if global_inpainter:
        device_type = global_inpainter.device

        # GPU memory if available
        if global_inpainter.device == "cuda" and torch.cuda.is_available():
            cuda_memory_mb = torch.cuda.memory_allocated() / 1024 / 1024
        elif global_inpainter.device == "mps" and torch.backends.mps.is_available():
            # MPS doesn't have direct memory query, so we estimate
            mps_memory_mb = None
    else:
        device_type = "error"

    response_data = {
        "system_memory_mb": system_memory_mb,
        "system_memory_percent": system_memory_percent,
        "device_type": device_type,
        "config_max_image_size": 1080,
        "cuda_memory_mb": cuda_memory_mb,
        "mps_memory_mb": mps_memory_mb
    }

    return MemoryResponse(**response_data)


@app.post("/inpaint")
async def inpaint(request: SimplifiedInpaintRequest):
    """
    Simplified inpaint endpoint that only performs core AI inference

    Args:
        request: SimplifiedInpaintRequest containing base64 encoded image and mask

    Returns:
        Base64 encoded result image
    """
    logger.info("=== Starting simplified inpaint request ===")

    try:
        # Extract and validate image data
        logger.info("Validating input data formats")
        if not request.image.startswith('data:image/'):
            logger.error("Invalid image data format")
            raise HTTPException(status_code=400, detail="Invalid image data format")

        if not request.mask or not request.mask.startswith('data:image/'):
            logger.error("Invalid mask data format")
            raise HTTPException(status_code=400, detail="Invalid mask data format")

        # Convert base64 to PIL Images
        logger.info("Converting base64 to image data")
        image_b64 = request.image.split(',')[1]
        mask_b64 = request.mask.split(',')[1]

        try:
            logger.info("Decoding base64 data")
            image_bytes = base64.b64decode(image_b64)
            mask_bytes = base64.b64decode(mask_b64)
            logger.info("Base64 decode successful")
        except Exception as e:
            logger.error(f"Base64 decode error: {e}")
            raise HTTPException(status_code=400, detail=f"Base64 decode error: {e}")

        # Load images
        try:
            logger.info("Loading images from bytes")
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            mask = Image.open(io.BytesIO(mask_bytes)).convert('L')
            logger.info(f"Images loaded - image size: {image.size}, mask size: {mask.size}")
        except Exception as e:
            logger.error(f"Image load error: {e}")
            raise HTTPException(status_code=400, detail=f"Image load error: {e}")

        # Convert to numpy arrays
        logger.info("Converting to numpy arrays")
        image_np = np.array(image)
        mask_np = np.array(mask)
        logger.info(f"NumPy arrays created - image shape: {image_np.shape}, mask shape: {mask_np.shape}")

        # Check if global inpainter is available
        if global_inpainter is None:
            logger.error("Global inpainter not available")
            raise HTTPException(
                status_code=503,
                detail="Inpainting model not available."
            )

        logger.info("Calling global inpainter.inpaint method")
        try:
            # Use simplified inpainting method
            result = global_inpainter.inpaint(image_np, mask_np)
            logger.info(f"Simplified inpainting completed - result shape: {result.shape}")
        except Exception as e:
            logger.error(f"Error during simplified inpainting: {e}")
            raise
        finally:
            # Explicit memory cleanup after inference
            logger.info("Clearing memory cache")
            if global_inpainter:
                global_inpainter.clear_memory_cache()

        # Convert result back to base64
        logger.info("Converting result to base64")
        result_image = Image.fromarray(result.astype(np.uint8))
        buffer = io.BytesIO()
        result_image.save(buffer, format='JPEG', quality=95)
        result_b64 = base64.b64encode(buffer.getvalue()).decode()
        logger.info(f"Result converted to base64 - size: {len(result_b64)} characters")

        # Return the result as base64 data URL with security headers
        logger.info("=== Simplified inpaint request completed successfully ===")
        response = Response(
            content=f'"data:image/jpeg;base64,{result_b64}"',
            media_type="application/json",
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, private",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        return response

    except HTTPException:
        logger.warning("HTTPException raised - re-raising")
        raise
    except Exception as e:
        logger.error(f"=== CRITICAL ERROR in simplified inpaint endpoint ===")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())

        raise HTTPException(status_code=500, detail=f"Simplified inpainting failed: {str(e)}")

def setup_static_files():
    """Setup static file serving for production mode"""
    react_build_path = current_dir.parent / "dashboard" / "dist"
    if react_build_path.exists():
        # Remove the root endpoint if we're serving static files
        for route in app.routes:
            if hasattr(route, 'path') and route.path == '/' and hasattr(route, 'endpoint'):
                app.routes.remove(route)
                break
        
        app.mount("/", StaticFiles(directory=str(react_build_path), html=True), name="static")
        return True
    else:
        return False

def run_server(host: str = None, port: int = None, production: bool = False):
    if host is None:
        host = "0.0.0.0"
    if port is None:
        port = 8003

    # Check if global inpainter is available
    if global_inpainter is None:
        logger.error("Global inpainter not available")
        raise RuntimeError("Failed to initialize inpainter at module level")

    """Run the FastAPI server"""
    logger.info(f"📡 Server will be available at: http://{host}:{port}")

    # Setup static files for production
    if production:
        setup_static_files()

    logger.info(f"📋 API docs available at: http://{host}:{port}/docs")
    logger.info(f"📊 Health check: http://{host}:{port}/health")

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        reload=False  # Set to True during development
    )

if __name__ == "__main__":
    
    parser = argparse.ArgumentParser(description='Kupu Server')
    parser.add_argument('--host', type=str, default="0.0.0.0",
                        help=f'Host to bind the server to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8003,
                        help=f'Port to run the server on (default: 8003)')
    parser.add_argument('--reload', action='store_true',
                        help='Enable auto-reload for development')
    parser.add_argument('--production', action='store_true',
                        help='Run in production mode')

    args = parser.parse_args()

    if args.reload:
        # Check if global inpainter is available for reload mode
        if global_inpainter is None:
            logger.error("Global inpainter not available for reload mode")
            raise RuntimeError("Failed to initialize inpainter at module level")

        # Development mode with auto-reload
        logger.info(f"🌐 Server will bind to: {args.host}:{args.port}")
        uvicorn.run(
            "server:app",
            host=args.host,
            port=args.port,
            reload=True,
            reload_dirs=[str(current_dir)]
        )
    else:
        run_server(args.host, args.port, args.production)