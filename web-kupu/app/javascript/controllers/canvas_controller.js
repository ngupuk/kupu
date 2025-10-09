import { Controller } from "@hotwired/stimulus"



export default class extends Controller {
    connect() {
        // console.log = console.error = () => {};
        console.log('Canvas controller connected')
        this.canvas = this.element.querySelector('canvas')
        this.canvas.width = this.canvas.offsetWidth
        this.canvas.height = this.canvas.offsetHeight
        this.canvas.oriWidth = this.canvas.offsetWidth
        this.canvas.oriHeight = this.canvas.offsetHeight
        this.ctx = this.canvas.getContext('2d')
        this.isDrawing = false
        this.path = []
        this.masks = []
        this.redoMasks = []
        this.imagePreps = []
        this.redoImagePreps = []
        this.zoom = 1
        this.panX = 0
        this.panY = 0
        this.isDrawMode = false
        this.image = null
        this.imageScale = 1
        this.imageX = 0
        this.imageY = 0
        this.isDragging = false
        this.maxFileSize = 6 * 1024 * 1024
        this.maxDimSize = 1080
        // Touch zoom properties
        this.initialDistance = null
        this.initialZoom = null
        this.initialPanX = null
        this.initialPanY = null
        // Processing timer
        this.processingStartTime = null
        this.processingInterval = null
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this))
        this.canvas.addEventListener('mousemove', this.draw.bind(this))
        this.canvas.addEventListener('mouseup', this.endDrawing.bind(this))
        this.canvas.addEventListener('wheel', this.handleZoom.bind(this))
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.startDrawingTouch.bind(this))
        this.canvas.addEventListener('touchmove', this.drawTouch.bind(this))
        this.canvas.addEventListener('touchend', this.endDrawingTouch.bind(this))
        // Touch hover simulation for buttons
        this.element.addEventListener('touchstart', (e) => {
          const button = e.target.closest('button')
          if (button) {
            button.classList.add('touch-hover')
          }
        }, { passive: true })
        this.element.addEventListener('touchend', (e) => {
          const button = e.target.closest('button')
          if (button) {
            button.classList.remove('touch-hover')
          }
        }, { passive: true })
         const meta = document.querySelector('meta[name="rails-env"]')
         this.railsEnv = meta ? meta.content : 'development'

        const urlParams = new URLSearchParams(window.location.search)
   }

  startDrawing(event) {
    if (this.isDrawMode) {
      this.isDrawing = true
      this.path = []
      const rect = this.canvas.getBoundingClientRect()
      let x = event.clientX - rect.left
      let y = event.clientY - rect.top
      x = (x - this.panX) / this.zoom
      y = (y - this.panY) / this.zoom
      this.path.push({ x, y })
    } else {
      this.isDragging = true
      this.lastX = event.clientX
      this.lastY = event.clientY
    }
  }

  draw(event) {
    if (this.isDrawing) {
      const rect = this.canvas.getBoundingClientRect()
      let x = event.clientX - rect.left
      let y = event.clientY - rect.top
      x = (x - this.panX) / this.zoom
      y = (y - this.panY) / this.zoom
      this.path.push({ x, y })
      this.redraw()
    } else if (this.isDragging) {
      const dx = event.clientX - this.lastX
      const dy = event.clientY - this.lastY
      this.panX += dx
      this.panY += dy
      this.lastX = event.clientX
      this.lastY = event.clientY
      this.redraw()
    }
  }

  endDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false
      if (this.path.length > 0) {
        this.masks.push([...this.path])
        this.redoMasks = []
        this.path = []
      }
      this.redraw()
      // Here you can process the mask, e.g., send to server
    }
    this.isDragging = false
  }

  startDrawingTouch(event) {
    event.preventDefault()
    if (event.touches.length === 2) {
      // Pinch to zoom
      this.initialDistance = this.getTouchDistance(event.touches[0], event.touches[1])
      this.initialZoom = this.zoom
      this.initialPanX = this.panX
      this.initialPanY = this.panY
      const center = this.getTouchCenter(event.touches[0], event.touches[1])
      this.zoomCenterX = center.x
      this.zoomCenterY = center.y
    } else if (this.isDrawMode) {
      this.isDrawing = true
      this.path = []
      const rect = this.canvas.getBoundingClientRect()
      const touch = event.touches[0]
      let x = touch.clientX - rect.left
      let y = touch.clientY - rect.top
      x = (x - this.panX) / this.zoom
      y = (y - this.panY) / this.zoom
      this.path.push({ x, y })
    } else {
      this.isDragging = true
      const touch = event.touches[0]
      this.lastX = touch.clientX
      this.lastY = touch.clientY
    }
  }

  drawTouch(event) {
    event.preventDefault()
    if (event.touches.length === 2 && this.initialDistance !== null) {
      // Handle pinch zoom
      const currentDistance = this.getTouchDistance(event.touches[0], event.touches[1])
      const scale = currentDistance / this.initialDistance
      const newZoom = Math.max(0.1, Math.min(5, this.initialZoom * scale))

      // Calculate zoom center relative to canvas
      const rect = this.canvas.getBoundingClientRect()
      const centerX = (this.zoomCenterX - rect.left - this.initialPanX) / this.initialZoom
      const centerY = (this.zoomCenterY - rect.top - this.initialPanY) / this.initialZoom

      // Update pan to zoom towards the center point
      this.panX = this.zoomCenterX - rect.left - centerX * newZoom
      this.panY = this.zoomCenterY - rect.top - centerY * newZoom
      this.zoom = newZoom
      this.redraw()
    } else if (this.isDrawing) {
      const rect = this.canvas.getBoundingClientRect()
      const touch = event.touches[0]
      let x = touch.clientX - rect.left
      let y = touch.clientY - rect.top
      x = (x - this.panX) / this.zoom
      y = (y - this.panY) / this.zoom
      this.path.push({ x, y })
      this.redraw()
    } else if (this.isDragging && event.touches.length === 1) {
      const touch = event.touches[0]
      const dx = touch.clientX - this.lastX
      const dy = touch.clientY - this.lastY
      this.panX += dx
      this.panY += dy
      this.lastX = touch.clientX
      this.lastY = touch.clientY
      this.redraw()
    }
  }

  endDrawingTouch(event) {
    event.preventDefault()
    if (event.touches.length === 0) {
      // Reset zoom variables when all touches end
      this.initialDistance = null
      this.initialZoom = null
      this.initialPanX = null
      this.initialPanY = null
    }
    this.endDrawing()
  }

  handleZoom(event) {
    if (this.isDrawMode) return
    event.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor))
    const scaleChange = newZoom / this.zoom
    this.panX = mouseX - (mouseX - this.panX) * scaleChange
    this.panY = mouseY - (mouseY - this.panY) * scaleChange
    this.zoom = newZoom
    this.redraw()
  }

  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  getTouchCenter(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.save()
    this.ctx.translate(this.panX, this.panY)
    this.ctx.scale(this.zoom, this.zoom)
    // Draw image if loaded
    if (this.image) {
      this.ctx.drawImage(this.image, this.imageX, this.imageY, this.image.width * this.imageScale, this.image.height * this.imageScale)
    }
    if (this.isDrawMode) {
      // Draw completed masks
       for (let mask of this.masks) {
         if (mask.length > 1) {
           this.ctx.beginPath()
           this.ctx.moveTo(mask[0].x, mask[0].y)
           for (let i = 1; i < mask.length; i++) {
             this.ctx.lineTo(mask[i].x, mask[i].y)
           }
           this.ctx.closePath()
           this.ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'
           this.ctx.fill()
           this.ctx.strokeStyle = 'rgb(34, 197, 94)'
           this.ctx.lineWidth = 2 / this.zoom
           this.ctx.stroke()
         }
       }
       // Draw current path
       if (this.path.length > 1) {
         this.ctx.beginPath()
         this.ctx.moveTo(this.path[0].x, this.path[0].y)
         for (let i = 1; i < this.path.length; i++) {
           this.ctx.lineTo(this.path[i].x, this.path[i].y)
         }
         if (!this.isDrawing) {
           this.ctx.closePath()
           this.ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'
           this.ctx.fill()
         }
         this.ctx.strokeStyle = 'rgb(34, 197, 94)'
         this.ctx.lineWidth = 2 / this.zoom
         this.ctx.stroke()
       }
    }
    this.ctx.restore()
  }

  getMask() {
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = this.canvas.width
    maskCanvas.height = this.canvas.height
    const maskCtx = maskCanvas.getContext('2d')
    maskCtx.fillStyle = 'black'
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    maskCtx.fillStyle = 'white'
    for (let mask of this.masks) {
      if (mask.length > 1) {
        maskCtx.beginPath()
        maskCtx.moveTo(mask[0].x, mask[0].y)
        for (let i = 1; i < mask.length; i++) {
          maskCtx.lineTo(mask[i].x, mask[i].y)
        }
        maskCtx.closePath()
        maskCtx.fill()
      }
    }
    return maskCanvas
  }

  undo() {
    if (this.isDrawMode) {
      if (this.masks.length > 0) {
        this.redoMasks.push(this.masks.pop())
        this.redraw()
      }
    } else {
      if (this.imagePreps.length > 1) {
        this.redoImagePreps.push(this.imagePreps.pop())
        const prevImagePrep = this.imagePreps[this.imagePreps.length - 1]
        this.imagePrep = prevImagePrep
        this.imagePrepUrl = prevImagePrep.toDataURL('image/png')
        const img = new Image()
        img.onload = () => {
          this.image = img
          this.redraw()
        }
        img.src = this.imagePrepUrl
      }
    }

  }

  redo() {
    if (this.isDrawMode){
      if (this.redoMasks.length > 0) {
        this.masks.push(this.redoMasks.pop())
        this.redraw()
      }
    } else {
      if (this.redoImagePreps.length > 0) {
        const nextImagePrep = this.redoImagePreps.pop()
        this.imagePreps.push(nextImagePrep)
        this.imagePrep = nextImagePrep
        this.imagePrepUrl = nextImagePrep.toDataURL('image/png')
        const img = new Image()
        img.onload = () => {
          this.image = img
          this.redraw()
        }
        img.src = this.imagePrepUrl
      }
    }
  }

  upload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png'
    input.onchange = (event) => {
      const file = event.target.files[0]
      if (!file) return
      if (!this.validateFile(file)) return
      this.loadImage(file)
    }
    input.click()
  }

  validateFile(file) {
    if (file.size > this.maxFileSize) {
      alert('File size too large. Please select an image smaller than 6MB.')
      return false
    }
    return true
  }

   loadImage(file) {
     const imageUrl = URL.createObjectURL(file)
     const img = new Image()
      img.onload = () => {
        this.imageOriWidth = img.width
        this.imageOriHeight = img.height
        // Reset zoom and pan
        this.zoom = 1
        this.panX = 0
        this.panY = 0
        // Clear masks
        this.masks = []
        this.redoMasks = []
        this.path = []
        this.canvas.width = this.canvas.oriWidth
        this.canvas.height = this.canvas.oriHeight
       // Calculate scale to fit
       this.imageScale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height)
       // Scale the canvas to fit the scaled image size
       const scaledWidth = img.width * this.imageScale
       const scaledHeight = img.height * this.imageScale
       this.canvas.width = scaledWidth
       this.canvas.height = scaledHeight
       this.canvas.style.width = scaledWidth + 'px'
       this.canvas.style.height = scaledHeight + 'px'
       // Position zoom-mode to follow the canvas
       const modeElement = this.element.querySelector('.zoom-mode')
       if (modeElement) {
         modeElement.style.left = `calc(50% - ${scaledWidth / 2}px + 10px)`
         modeElement.style.top = `calc(50% - ${scaledHeight / 2}px + 10px)`
       }
          this.imageX = 0
          this.imageY = 0
          this.image = img
          this.imageOri = img

          const { newWidth, newHeight } = this.calculateScaledDimensions(img.width, img.height)
          this.imagePrep = this.resizeImage(img, newWidth, newHeight)
          this.imagePrepUrl = this.imagePrep.toDataURL('image/png')

          this.imagePreps.push(this.imagePrep)
          this.redoImagePreps = []
        this.redraw()
     }
     img.src = imageUrl
   }

  imageToDataURL(img, type = 'image/png') {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL(type)
  }

  mode() {
    this.isDrawMode = !this.isDrawMode
    const modeElement = this.element.querySelector('.zoom-mode')
    if (modeElement) {
      modeElement.textContent = this.isDrawMode ? 'draw mode' : 'zoom mode'
      modeElement.style.backgroundColor = this.isDrawMode ? 'rgb(34, 197, 94)' : 'rgb(101, 101, 243)'
    }
    this.canvas.style.borderColor = this.isDrawMode ? 'rgb(34, 197, 94)' : 'rgb(101, 101, 243)'
    const modeButton = this.element.querySelector('[data-action="click->canvas#mode"]')
    if (modeButton) {
      if (this.isDrawMode) {
        modeButton.classList.remove('bg-black', 'border-black')
        modeButton.classList.add('bg-green-500', 'border-green-500')
      } else {
        modeButton.classList.remove('bg-green-500', 'border-green-500')
        modeButton.classList.add('bg-black', 'border-black')
      }
    }
    this.redraw()
  }
    
    async erase(){
         const eraseButton = this.element.querySelector('[data-action="click->canvas#erase"]')
         if (eraseButton) {
           eraseButton.disabled = true;
           eraseButton.classList.add('opacity-50', 'pointer-events-none');
         }

      // Start processing timer
      this.startProcessingTimer();

     this.mask = this.resizeImage(this.getMask(),
                                   this.imagePrep.width,
                                   this.imagePrep.height)
     this.maskUrl = this.mask.toDataURL()
     // console.log("ERASE GUEST")
     // console.log('this.mask size:', this.mask.width, this.mask.height)
     // console.log('this.imagePrepSize:', this.imagePrep.width, this.imagePrep.height)

       const result = {
         image: this.imagePrepUrl,
         mask: this.maskUrl,
       }
       // console.log(result)
       try {
          const controller = new AbortController();
           const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
          await this.inpaint(controller.signal)
          clearTimeout(timeoutId);
           this.stopProcessingTimer()
           this.showProcessingStatus('Done')
           this.hideProcessingStatus()
           this.redraw()
           if (eraseButton) {
             eraseButton.disabled = false;
             eraseButton.classList.remove('opacity-50', 'pointer-events-none');
           }
          // Switch to zoom mode after successful erase_guest
          this.isDrawMode = false
          const modeElement = this.element.querySelector('.zoom-mode')
          if (modeElement) {
            modeElement.textContent = 'zoom mode'
            modeElement.style.backgroundColor = 'rgb(101, 101, 243)'
          }
          this.canvas.style.borderColor = 'rgb(101, 101, 243)'
          const modeButton = this.element.querySelector('[data-action="click->canvas#mode"]')
          if (modeButton) {
            modeButton.classList.remove('bg-green-500', 'border-green-500')
            modeButton.classList.add('bg-black', 'border-black')
          }
        } catch (error) {
          // // console.error('Inpaint failed:', error)
          if (error.name === 'AbortError') {
            this.showProcessingStatus('Inpainting error, try again')
            this.stopProcessingTimer()
            this.hideProcessingStatus()
          } else if (error.message.includes('Rate limit exceeded')) {
            this.showProcessingStatus('The demo trial limit has been reached.')
            this.stopProcessingTimer()
            await new Promise(resolve => setTimeout(resolve, 2000))
            this.hideProcessingStatus()
          } else {
            this.showProcessingStatus('Error: ' + error.message)
            this.stopProcessingTimer()
            this.hideProcessingStatus()
          }
          if (eraseButton) {
            eraseButton.disabled = false;
            eraseButton.classList.remove('opacity-50', 'pointer-events-none');
          }

        }

    return result
  }

   async inpaint(signal = null) {
   return new Promise((resolve, reject) => {
     let postURL, headers;
     postURL = 'http://localhost:8003/inpaint'
     headers = {
      'Content-Type': 'application/json'
      }

     fetch(postURL, {
       method: 'POST',
       headers: headers,
       body: JSON.stringify({
         image: this.imagePrepUrl,
         mask: this.maskUrl
       }),
       signal: signal
     })

    .then(response => response.json())
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        // console.log('Inpaint response:', data);

        // Handle response format: either "data:image/jpeg;base64,..." or {result: "data:image/jpeg;base64,..."}
        const imageData = typeof data === 'string' ? data : data.result;
        if (imageData && typeof imageData === 'string') {
          const img = new Image();
          img.onload = () => {
            // console.log('New image loaded:', img.width, 'x', img.height);

            // Reset positioning
            this.imageX = 0;
            this.imageY = 0;

            // Recalculate scale to fit canvas
            this.imageScale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);

            // Update the image
            this.image = img
            this.imageInpainted = img;

            // Update 1080 version for future operations
            const { newWidth, newHeight } = this.calculateScaledDimensions(img.width, img.height, this.maxDimSize)
            this.imagePrep= this.resizeImage(img, newWidth, newHeight);
            this.imagePrepUrl = this.imagePrep.toDataURL('image/png');

            this.imagePreps.push(this.imagePrep)
            this.redoImagePreps = []

              // Clear masks since image has changed
              this.masks = [];
              this.redoMasks = [];
              this.path = [];

              // console.log('Image updated and redrawn');
              resolve();
          };
          img.onerror = (e) => {
            // console.error('Failed to load inpainted image:', e);
            reject(e);
          };
          // Handle data URL format or add prefix if needed
          if (imageData.startsWith('data:')) {
            img.src = imageData;
          } else {
            img.src = "data:image/jpeg;base64," + imageData;
          }
        } else {
          // console.error('No image data in response');
          reject(new Error('No image data in response'));
        }
      })
    .catch(error => {
      // console.error('Error:', error);
      reject(error);
    });
  });
}

  calculateScaledDimensions(width, height, maxDim = this.maxDimSize) {
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const newWidth = Math.floor(width * scale)
    const newHeight = Math.floor(height * scale)
    return { scale, newWidth, newHeight }
  }

  resizeImage(image, targetWidth, targetHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  guide() {
    const popup = document.getElementById('tutorial-popup')
    if (popup) {
      popup.classList.remove('hidden')
    }
  }

  closeTutorial() {
    const popup = document.getElementById('tutorial-popup')
    if (popup) {
      popup.classList.add('hidden')
    }
  }

  save(){
    // console.log('save() called')
    if (!this.imageInpainted) {
      alert('No inpainted image to save')
      return
    }
    // console.log('imageOri:', this.imageOri.width, 'x', this.imageOri.height)
    // console.log('imageInpainted:', this.imageInpainted.width, 'x', this.imageInpainted.height)
    // console.log('maskCanvas:', this.mask.width, 'x', this.mask.height)
    const canvas = document.createElement('canvas')
    const overlayedImage = this.postprocess(this.imageOri, this.imageInpainted, this.mask)
    // console.log("overlayedImage:", overlayedImage.width, 'x', overlayedImage.height)
    canvas.width = overlayedImage.width
    canvas.height = overlayedImage.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(overlayedImage, 0, 0)
    canvas.toBlob((blob) => {
      // console.log('Blob created, size:', blob.size)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kupu-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/jpeg', 0.95)
  }


  overlayMask(image, mask) {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = mask.width
    maskCanvas.height = mask.height
    const maskCtx = maskCanvas.getContext('2d')
    maskCtx.drawImage(mask, 0, 0)
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    const maskPixels = maskData.data

    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const imagePixels = imageData.data

    for (let i = 0; i < imagePixels.length; i += 4) {
      const maskValue = maskPixels[i]
      if (maskValue < 128) {
        imagePixels[i + 3] = 0
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }

  overlayInpaint(imageOri, overlayedInpainted) {
    // console.log('overlayInpaint() called')
    // console.log('imageOri:', imageOri.width, 'x', imageOri.height)
    // console.log('overlayedInpainted:', overlayedInpainted.width, 'x', overlayedInpainted.height)

    const canvas = document.createElement('canvas')
    canvas.width = imageOri.width
    canvas.height = imageOri.height
    const ctx = canvas.getContext('2d')

    ctx.drawImage(imageOri, 0, 0)
    ctx.globalCompositeOperation = 'source-over'

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = overlayedInpainted.width
    tempCanvas.height = overlayedInpainted.height
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.drawImage(overlayedInpainted, 0, 0)

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const pixels = imageData.data

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0) {
        pixels[i + 3] = 0
      }
    }

    tempCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(tempCanvas, 0, 0)

    // console.log('overlayInpaint result:', canvas.width, 'x', canvas.height)
    return canvas
  }

  postprocess(imageOri, imageInpainted, mask) {
    // console.log('postprocess() called')
    // console.log('imageOri:', imageOri.width, 'x', imageOri.height)
    // console.log('imageInpainted:', imageInpainted.width, 'x', imageInpainted.height)
    // console.log('mask:', mask.width, 'x', mask.height)

    const targetWidth = imageOri.width
    const targetHeight = imageOri.height

    const resizedImage = this.resizeImage(imageInpainted, targetWidth, targetHeight)
    // console.log('resizedImage:', resizedImage.width, 'x', resizedImage.height)

    const resizedMask = this.resizeImage(mask, targetWidth, targetHeight)
    // console.log('resizedMask:', resizedMask.width, 'x', resizedMask.height)

    const overlayedInpainted = this.overlayMask(resizedImage, resizedMask)
    // console.log('overlayedInpainted:', overlayedInpainted.width, 'x', overlayedInpainted.height)

    const overlayedImage = this.overlayInpaint(imageOri, overlayedInpainted)
    // console.log('overlayedImage:', overlayedImage.width, 'x', overlayedImage.height)

    return overlayedImage
  }

  startProcessingTimer() {
    this.processingStartTime = Date.now()
    this.showProcessingStatus('Processing: 0 s')
    this.processingInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.processingStartTime) / 1000)
      this.showProcessingStatus(`Processing: ${elapsed} s`)
    }, 1000)
  }

  stopProcessingTimer() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
  }

  showProcessingStatus(text) {
    const statusEl = this.element.querySelector('#processing-status')
    if (statusEl) {
      statusEl.textContent = text
      statusEl.classList.remove('hidden')
    }
  }

  hideProcessingStatus() {
    const statusEl = this.element.querySelector('#processing-status')
    if (statusEl) {
      statusEl.classList.add('hidden')
    }
    this.stopProcessingTimer()
  }
}
