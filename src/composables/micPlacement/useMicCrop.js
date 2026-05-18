import { ref, nextTick } from 'vue'
import { useToast } from 'vue-toastification'

/**
 * Background-image crop modal: maintains its own offscreen canvas state, lets
 * the user pull corner/edge handles, and pipes the cropped PNG back through
 * the background-image composable (`uploadBgToStorage` + `setBackgroundImage`).
 *
 * Caller provides:
 *   - `cropCanvasRef` - the modal's <canvas>
 *   - `bgImage` / `bgImageObj` refs (source pixels)
 *   - `uploadBgToStorage` / `setBackgroundImage` from the bg image composable
 */
export function useMicCrop({
  cropCanvasRef,
  bgImage,
  bgImageObj,
  uploadBgToStorage,
  setBackgroundImage
}) {
  const toast = useToast()

  const showCropModal = ref(false)
  const cropBusy = ref(false)
  const cropBox = ref({ x: 0, y: 0, width: 0, height: 0 })
  const cropImageObj = ref(null)
  const cropScale = ref(1)
  const cropOffsetX = ref(0)
  const cropOffsetY = ref(0)
  const cropDragging = ref(false)
  const cropDragType = ref(null)
  const cropDragStart = ref({ x: 0, y: 0 })
  const cropBoxStart = ref({ x: 0, y: 0, width: 0, height: 0 })

  function openCropModal() {
    if (!bgImageObj.value) {
      toast.error('No image to crop')
      return
    }
    showCropModal.value = true
    nextTick(() => initializeCropCanvas())
  }

  function closeCropModal() {
    showCropModal.value = false
    cropImageObj.value = null
    cropBox.value = { x: 0, y: 0, width: 0, height: 0 }
  }

  function initializeCropCanvas() {
    if (!cropCanvasRef.value || !bgImageObj.value) return

    const canvas = cropCanvasRef.value
    const img = bgImageObj.value
    const maxWidth = Math.min(800, window.innerWidth - 100)
    const maxHeight = Math.min(600, window.innerHeight - 200)

    const scaleX = maxWidth / img.width
    const scaleY = maxHeight / img.height
    cropScale.value = Math.min(scaleX, scaleY, 1)

    const displayWidth = img.width * cropScale.value
    const displayHeight = img.height * cropScale.value

    canvas.width = displayWidth
    canvas.height = displayHeight
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'

    cropOffsetX.value = 0
    cropOffsetY.value = 0

    cropBox.value = {
      x: 0,
      y: 0,
      width: displayWidth,
      height: displayHeight
    }

    cropImageObj.value = new Image()
    cropImageObj.value.crossOrigin = 'anonymous'
    cropImageObj.value.onload = () => drawCropCanvas()
    cropImageObj.value.src = bgImage.value
  }

  function drawCropCanvas() {
    if (!cropCanvasRef.value || !cropImageObj.value) return

    const ctx = cropCanvasRef.value.getContext('2d')
    const canvas = cropCanvasRef.value

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(cropImageObj.value, 0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillRect(cropBox.value.x, cropBox.value.y, cropBox.value.width, cropBox.value.height)
    ctx.restore()

    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.strokeRect(cropBox.value.x, cropBox.value.y, cropBox.value.width, cropBox.value.height)

    const handleSize = 12
    const handles = [
      { x: cropBox.value.x, y: cropBox.value.y },
      { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y },
      { x: cropBox.value.x, y: cropBox.value.y + cropBox.value.height },
      { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y + cropBox.value.height }
    ]

    ctx.fillStyle = '#007bff'
    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })

    const edgeHandles = [
      { x: cropBox.value.x + cropBox.value.width / 2, y: cropBox.value.y },
      { x: cropBox.value.x + cropBox.value.width / 2, y: cropBox.value.y + cropBox.value.height },
      { x: cropBox.value.x, y: cropBox.value.y + cropBox.value.height / 2 },
      { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y + cropBox.value.height / 2 }
    ]

    edgeHandles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
    })
  }

  function getCropCanvasCoords(e) {
    const rect = cropCanvasRef.value.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  function getCropDragType(x, y) {
    const box = cropBox.value
    const handleSize = 12
    const threshold = handleSize + 5

    if (Math.abs(x - box.x) < threshold && Math.abs(y - box.y) < threshold) return 'resize-nw'
    if (Math.abs(x - (box.x + box.width)) < threshold && Math.abs(y - box.y) < threshold) return 'resize-ne'
    if (Math.abs(x - box.x) < threshold && Math.abs(y - (box.y + box.height)) < threshold) return 'resize-sw'
    if (Math.abs(x - (box.x + box.width)) < threshold && Math.abs(y - (box.y + box.height)) < threshold) return 'resize-se'

    if (Math.abs(y - box.y) < threshold && x >= box.x && x <= box.x + box.width) return 'resize-n'
    if (Math.abs(y - (box.y + box.height)) < threshold && x >= box.x && x <= box.x + box.width) return 'resize-s'
    if (Math.abs(x - box.x) < threshold && y >= box.y && y <= box.y + box.height) return 'resize-w'
    if (Math.abs(x - (box.x + box.width)) < threshold && y >= box.y && y <= box.y + box.height) return 'resize-e'

    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return 'move'

    return null
  }

  function onCropMouseDown(e) {
    if (!cropCanvasRef.value) return
    e.preventDefault()

    const { x, y } = getCropCanvasCoords(e)
    cropDragType.value = getCropDragType(x, y)

    if (cropDragType.value) {
      cropDragging.value = true
      cropDragStart.value = { x, y }
      cropBoxStart.value = { ...cropBox.value }
      cropCanvasRef.value.style.cursor = getCropCursor(cropDragType.value)
    }
  }

  function onCropMouseMove(e) {
    if (!cropCanvasRef.value) return

    const { x, y } = getCropCanvasCoords(e)

    if (cropDragging.value && cropDragType.value) {
      const dx = x - cropDragStart.value.x
      const dy = y - cropDragStart.value.y

      let newBox = { ...cropBoxStart.value }

      switch (cropDragType.value) {
        case 'move':
          newBox.x = Math.max(0, Math.min(cropCanvasRef.value.width - newBox.width, cropBoxStart.value.x + dx))
          newBox.y = Math.max(0, Math.min(cropCanvasRef.value.height - newBox.height, cropBoxStart.value.y + dy))
          break
        case 'resize-nw':
          newBox.x = Math.max(0, cropBoxStart.value.x + dx)
          newBox.y = Math.max(0, cropBoxStart.value.y + dy)
          newBox.width = cropBoxStart.value.width - dx
          newBox.height = cropBoxStart.value.height - dy
          break
        case 'resize-ne':
          newBox.y = Math.max(0, cropBoxStart.value.y + dy)
          newBox.width = cropBoxStart.value.width + dx
          newBox.height = cropBoxStart.value.height - dy
          break
        case 'resize-sw':
          newBox.x = Math.max(0, cropBoxStart.value.x + dx)
          newBox.width = cropBoxStart.value.width - dx
          newBox.height = cropBoxStart.value.height + dy
          break
        case 'resize-se':
          newBox.width = cropBoxStart.value.width + dx
          newBox.height = cropBoxStart.value.height + dy
          break
        case 'resize-n':
          newBox.y = Math.max(0, cropBoxStart.value.y + dy)
          newBox.height = cropBoxStart.value.height - dy
          break
        case 'resize-s':
          newBox.height = cropBoxStart.value.height + dy
          break
        case 'resize-w':
          newBox.x = Math.max(0, cropBoxStart.value.x + dx)
          newBox.width = cropBoxStart.value.width - dx
          break
        case 'resize-e':
          newBox.width = cropBoxStart.value.width + dx
          break
      }

      if (newBox.width < 50) {
        newBox.width = 50
        if (cropDragType.value.includes('w')) newBox.x = cropBoxStart.value.x + cropBoxStart.value.width - 50
      }
      if (newBox.height < 50) {
        newBox.height = 50
        if (cropDragType.value.includes('n')) newBox.y = cropBoxStart.value.y + cropBoxStart.value.height - 50
      }

      newBox.x = Math.max(0, Math.min(cropCanvasRef.value.width - newBox.width, newBox.x))
      newBox.y = Math.max(0, Math.min(cropCanvasRef.value.height - newBox.height, newBox.y))
      newBox.width = Math.min(cropCanvasRef.value.width - newBox.x, newBox.width)
      newBox.height = Math.min(cropCanvasRef.value.height - newBox.y, newBox.height)

      cropBox.value = newBox
      drawCropCanvas()
    } else {
      const dragType = getCropDragType(x, y)
      cropCanvasRef.value.style.cursor = dragType ? getCropCursor(dragType) : 'default'
    }
  }

  function onCropMouseUp() {
    if (cropDragging.value) {
      cropDragging.value = false
      cropDragType.value = null
      if (cropCanvasRef.value) {
        cropCanvasRef.value.style.cursor = 'default'
      }
    }
  }

  function getCropCursor(dragType) {
    const cursors = {
      'move': 'move',
      'resize-nw': 'nw-resize',
      'resize-ne': 'ne-resize',
      'resize-sw': 'sw-resize',
      'resize-se': 'se-resize',
      'resize-n': 'n-resize',
      'resize-s': 's-resize',
      'resize-w': 'w-resize',
      'resize-e': 'e-resize'
    }
    return cursors[dragType] || 'default'
  }

  async function applyCrop() {
    if (!bgImageObj.value || !cropCanvasRef.value) return

    cropBusy.value = true

    try {
      const scale = bgImageObj.value.width / cropCanvasRef.value.width
      const cropX = cropBox.value.x * scale
      const cropY = cropBox.value.y * scale
      const cropW = cropBox.value.width * scale
      const cropH = cropBox.value.height * scale

      const offCanvas = document.createElement('canvas')
      offCanvas.width = cropW
      offCanvas.height = cropH
      const ctx = offCanvas.getContext('2d')

      ctx.drawImage(
        bgImageObj.value,
        cropX, cropY, cropW, cropH,
        0, 0, cropW, cropH
      )

      offCanvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to create cropped image')
          cropBusy.value = false
          return
        }

        try {
          const file = new File([blob], 'cropped-bg.png', { type: 'image/png' })
          const { url } = await uploadBgToStorage(file)
          await setBackgroundImage(url)
          toast.success('Image cropped and saved')
          closeCropModal()
        } catch (err) {
          console.error('Error saving cropped image:', err)
          toast.error(`Failed to save cropped image: ${err.message || err}`)
        } finally {
          cropBusy.value = false
        }
      }, 'image/png')
    } catch (err) {
      console.error('Error cropping image:', err)
      toast.error('Failed to crop image')
      cropBusy.value = false
    }
  }

  return {
    showCropModal,
    cropBusy,
    cropBox,
    cropImageObj,
    cropScale,
    cropOffsetX,
    cropOffsetY,
    cropDragging,
    cropDragType,
    cropDragStart,
    cropBoxStart,
    openCropModal,
    closeCropModal,
    initializeCropCanvas,
    drawCropCanvas,
    onCropMouseDown,
    onCropMouseMove,
    onCropMouseUp,
    applyCrop
  }
}
