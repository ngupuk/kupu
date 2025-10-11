# Based on:
# https://github.com/advimman/lama
# https://github.com/Sanster/IOPaint

import gc
import os
import time
import traceback
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F
from loguru import logger

logger.remove()


class Inpainter:
    """Core inpainting functionality class"""

    def __init__(self, model_path, device=None, ):
        logger.info("Initializing Inpainter class")

        # Set device based on parameter or auto-detect
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() \
                else "mps" if torch.backends.mps.is_available() \
                else "cpu"
            logger.info(f"Auto-detected device: {self.device}")
        else:
            # Validate device parameter
            valid_devices = ["cpu", "cuda", "mps"]
            if device not in valid_devices:
                logger.error(
                    f"Invalid device '{device}'. Must be one of: {valid_devices}")
                raise ValueError(
                    f"Invalid device '{device}'. Must be one of: {valid_devices}")

            # Check if requested device is available
            if device == "cuda" and not torch.cuda.is_available():
                logger.error("CUDA device requested but CUDA is not available")
                raise RuntimeError(
                    "CUDA device requested but CUDA is not available")
            elif device == "mps" and not torch.backends.mps.is_available():
                logger.error("MPS device requested but MPS is not available")
                raise RuntimeError(
                    "MPS device requested but MPS is not available")

            self.device = device
            logger.info(f"Using specified device: {self.device}")

        try:
            logger.info(f"Loading model from checkpoint: {model_path}")
            self.model = torch.jit.load(model_path, map_location=self.device)
            self.model.eval().to(self.device)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            raise

        # Preallocation constants from config
        self.pad_to_square = False
        self.min_size = None
        self.pad_mod = 8

        # Preallocate lookup table for histogram matching
        self._lookup_table = np.zeros(256, dtype=np.uint8)

        # Memory management settings
        self.max_image_size = 1080

        logger.info(f"Inpainter initialized with device: {self.device},\
                      max_image_size: {self.max_image_size}")

    def inpaint(self, image_np: np.ndarray, mask_np: np.ndarray) -> np.ndarray:
        """
        Simplified inpaint method that only performs core AI inference
        Args:
            image_np: RGB image as numpy array (H, W, 3)
            mask_np: Binary mask as numpy array (H, W) with 255 for inpaint areas
        Returns:
            Inpainted result as numpy array (H, W, 3)
        """
        logger.info("Starting simplified inpaint process")
        logger.info(
            f"Input image shape: {image_np.shape}, mask shape: {mask_np.shape}")

        start_time = time.time()

        try:
            # Ensure mask is binary
            mask_np = (mask_np > 128).astype(np.uint8) * 255

            # Perform core inpainting
            result = self._pad_forward(image_np, mask_np)

            # Fast unmasked restore
            mask_indices = mask_np < 127
            if len(mask_np.shape) == 2 and len(result.shape) == 3:
                for c in range(result.shape[2]):
                    result[:, :, c][mask_indices] = image_np[:,
                                                             :, c][mask_indices]
            else:
                result[mask_indices] = image_np[mask_indices]

            # Clear memory
            self.clear_memory_cache()

            total_time = time.time() - start_time
            logger.info(f"Simplified inpaint completed in {total_time:.3f}s")
            logger.info(f"Result shape: {result.shape}")

            return result

        except Exception as e:
            logger.error(f"Error in inpaint: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    def _pad_forward(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Forward pass with padding"""
        h, w = image.shape[:2]

        result = self._forward(
            self._pad_img_to_modulo(
                image, self.pad_mod, self.pad_to_square, self.min_size),
            self._pad_img_to_modulo(
                mask, self.pad_mod, self.pad_to_square, self.min_size)
        )[:h, :w]

        result = self._fast_unmasked_restore(result, image, mask)

        return result

    def _forward(self, image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Core model forward pass"""
        logger.info(
            f"Starting forward pass with image shape: {image.shape}, mask shape: {mask.shape}")

        try:
            logger.info("Normalizing input images")
            image = self._norm_img(image)
            mask = (self._norm_img(mask) > 0).astype(np.float32)
            logger.info(
                f"After normalization - image shape: {image.shape}, mask shape: {mask.shape}")

            with torch.no_grad():
                logger.info("Creating tensors and moving to device")
                # Create tensors
                image_tensor = torch.from_numpy(
                    image).unsqueeze(0).to(self.device)
                mask_tensor = torch.from_numpy(
                    mask).unsqueeze(0).to(self.device)
                logger.info(f"Tensors created - image_tensor shape: {image_tensor.shape},\
                              mask_tensor shape: {mask_tensor.shape}")
                logger.info(
                    f"Tensors on device: {image_tensor.device}, {mask_tensor.device}")

                # Run inference
                logger.info("Running model inference")
                result_tensor = self.model(image_tensor, mask_tensor)[0]
                logger.info(
                    f"Model inference completed, result shape: {result_tensor.shape}")

                # Move to CPU immediately
                logger.info("Moving result to CPU")
                image = result_tensor.permute(1, 2, 0).cpu().numpy()
                logger.info(
                    f"Result moved to CPU, numpy array shape: {image.shape}")

                # Explicitly delete GPU tensors
                logger.info("Cleaning up tensors")
                del image_tensor, mask_tensor, result_tensor

            # Aggressive GPU cache clearing after inference
            logger.info("Clearing GPU cache")
            if self.device == "mps":
                torch.mps.empty_cache()
                logger.info("MPS cache cleared")
            elif self.device == "cuda":
                torch.cuda.empty_cache()
                logger.info("CUDA cache cleared")

            # Always force garbage collection
            logger.info("Running garbage collection")
            gc.collect()

            final_result = np.clip(image * 255, 0, 255).astype(np.uint8)
            logger.info(
                f"Final result shape: {final_result.shape}, dtype: {final_result.dtype}")
            return final_result

        except Exception as e:
            logger.error(f"Error in _forward method: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Image shape: {getattr(image, 'shape', 'unknown')}")
            logger.error(f"Mask shape: {getattr(mask, 'shape', 'unknown')}")
            logger.error(f"Device: {self.device}")

            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    # ============= PREPROCESSING UTILITY FUNCTIONS =============

    def _norm_img(self, img: np.ndarray) -> np.ndarray:
        """Normalize image to [0,1] and transpose to CHW format"""
        if len(img.shape) == 2:
            img = img[:, :, np.newaxis]
        return np.transpose(img, (2, 0, 1)).astype(np.float32) / 255

    def _pad_img_to_modulo(self,
                           img: np.ndarray,
                           mod: int,
                           square: bool = False,
                           min_size: Optional[int] = None) -> np.ndarray:
        """Pad image to be divisible by modulo"""
        if len(img.shape) == 2:
            img = img[:, :, np.newaxis]
        h, w = img.shape[:2]
        out_h, out_w = self._ceil_modulo(h, mod), self._ceil_modulo(w, mod)

        if min_size is not None:
            out_w, out_h = max(min_size, out_w), max(min_size, out_h)

        if square:
            out_h = out_w = max(out_h, out_w)

        return np.pad(img, ((0, out_h - h), (0, out_w - w), (0, 0)), mode="symmetric")

    def _ceil_modulo(self, x: int, mod: int) -> int:
        """Round up to nearest multiple"""
        return x if x % mod == 0 else (x // mod + 1) * mod

    def _fast_unmasked_restore(self, result: np.ndarray,
                               image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Fast unmasked area restoration using boolean indexing"""
        mask = mask < 127
        result = np.array(result)

        if len(mask.shape) == 2 and len(result.shape) == 3:
            for c in range(result.shape[2]):
                result[:, :, c][mask] = image[:, :, c][mask]
        else:
            result[mask] = image[mask]

        return result

    def clear_memory_cache(self):
        """Explicitly clear GPU memory cache"""
        if self.device == "mps":
            torch.mps.empty_cache()
        elif self.device == "cuda":
            torch.cuda.empty_cache()
        # Always clear Python garbage collection
        gc.collect()
