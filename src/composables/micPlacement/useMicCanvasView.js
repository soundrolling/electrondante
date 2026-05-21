import { ref, computed } from 'vue'

const MIN_SCALE = 0.2
const MAX_SCALE = 5

/**
 * Canvas size, dpr, zoom level + coordinate transforms.
 *
 * The "view" here means everything that maps image coords <-> canvas pixels.
 * It owns:
 *   - `canvasWidth/canvasHeight`, `dpr`, `canvasStyle`
 *   - `nodeScaleFactor` - separate zoom level applied to mic nodes only
 *
 * Caller provides:
 *   - refs to the wrapper element + canvas (for resizing + DOMRect math)
 *   - the background-image composable so zoom-toward-pointer can adjust offsets
 *   - a `redraw()` action invoked after view changes
 */
export function useMicCanvasView({
  canvasWrapperRef,
  canvasRef,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  getProjectId,
  getLocationId,
  redraw
}) {
  const dpr = window.devicePixelRatio || 1
  const canvasWidth = ref(800)
  const canvasHeight = ref(600)
  const nodeScaleFactor = ref(1)

  const NODE_SCALE_MIN = 0.2
  const NODE_SCALE_MAX = 10

  function getNodeScaleKey() {
    if (!getProjectId) return null
    const projectId = getProjectId()
    if (!projectId) return null
    const scope = (getLocationId && getLocationId()) ?? 'default'
    return `mic-placement-node-scale-${projectId}-${scope}`
  }

  function loadNodeScale() {
    try {
      const key = getNodeScaleKey()
      if (!key) return
      const saved = localStorage.getItem(key)
      if (saved == null) return
      const parsed = parseFloat(saved)
      if (Number.isFinite(parsed) && parsed > 0) {
        nodeScaleFactor.value = clamp(parsed, NODE_SCALE_MIN, NODE_SCALE_MAX)
      }
    } catch (err) {
      console.error('Error loading node scale:', err)
    }
  }

  function saveNodeScale() {
    try {
      const key = getNodeScaleKey()
      if (!key) return
      localStorage.setItem(key, String(nodeScaleFactor.value))
    } catch (err) {
      console.error('Error saving node scale:', err)
    }
  }

  const canvasStyle = computed(() =>
    `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; display: block; margin: 0 auto; background: var(--bg-primary); border-radius: 8px; border: 1px solid #e9ecef; touch-action: none;`
  )

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val))
  }

  // Coordinate transforms
  function canvasToImageCoords(canvasX, canvasY) {
    if (!bgImageObj.value) {
      return { imgX: canvasX / canvasWidth.value, imgY: canvasY / canvasHeight.value }
    }
    const imgW = bgImageObj.value.width
    const imgH = bgImageObj.value.height
    return {
      imgX: (canvasX - imageOffsetX.value) / (imgW * scaleFactor.value),
      imgY: (canvasY - imageOffsetY.value) / (imgH * scaleFactor.value)
    }
  }

  function imageToCanvasCoords(imgX, imgY) {
    if (!bgImageObj.value) {
      return { x: imgX * canvasWidth.value, y: imgY * canvasHeight.value }
    }
    const imgW = bgImageObj.value.width
    const imgH = bgImageObj.value.height
    return {
      x: imgX * (imgW * scaleFactor.value) + imageOffsetX.value,
      y: imgY * (imgH * scaleFactor.value) + imageOffsetY.value
    }
  }

  function getCanvasCoords(e) {
    const c = canvasRef.value
    if (!c) return { x: 0, y: 0 }
    const rect = c.getBoundingClientRect()
    const scaleX = c.width / rect.width
    const scaleY = c.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX / dpr,
      y: (e.clientY - rect.top) * scaleY / dpr
    }
  }

  function zoomIn() {
    nodeScaleFactor.value = clamp(nodeScaleFactor.value * 1.1, NODE_SCALE_MIN, NODE_SCALE_MAX)
    saveNodeScale()
    redraw && redraw()
  }
  function zoomOut() {
    nodeScaleFactor.value = clamp(nodeScaleFactor.value / 1.1, NODE_SCALE_MIN, NODE_SCALE_MAX)
    saveNodeScale()
    redraw && redraw()
  }

  function applyZoom(zoomFactor, centerX, centerY) {
    const prevScale = scaleFactor.value
    const newScale = clamp(prevScale * zoomFactor, MIN_SCALE, MAX_SCALE)
    if (newScale === prevScale) return
    const imgXBefore = (centerX - imageOffsetX.value) / prevScale
    const imgYBefore = (centerY - imageOffsetY.value) / prevScale
    scaleFactor.value = newScale
    imageOffsetX.value = centerX - imgXBefore * newScale
    imageOffsetY.value = centerY - imgYBefore * newScale
    redraw && redraw()
  }

  function updateCanvasSize() {
    const el = canvasWrapperRef.value
    const maxW = el ? el.clientWidth : window.innerWidth
    // 12px padding each side; max raised to 1800
    const inner = Math.min(1800, Math.max(280, maxW - 24))
    canvasWidth.value = inner
    canvasHeight.value = Math.round(inner * 0.75)
    if (canvasRef.value) {
      canvasRef.value.width = canvasWidth.value * dpr
      canvasRef.value.height = canvasHeight.value * dpr
    }
    redraw && redraw()
  }

  /**
   * Reset view to frame all content (background image + every mic + its label).
   * `getNodes()` and `fitImageToCanvas` are deferred so this composable doesn't
   * import the full mic-state machine.
   */
  function resetImageView({ getNodes, fitImageToCanvas }) {
    const PADDING = 20
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    if (bgImageObj.value) {
      const bx = imageOffsetX.value
      const by = imageOffsetY.value
      const bw = bgImageObj.value.width * scaleFactor.value
      const bh = bgImageObj.value.height * scaleFactor.value
      minX = Math.min(minX, bx)
      minY = Math.min(minY, by)
      maxX = Math.max(maxX, bx + bw)
      maxY = Math.max(maxY, by + bh)
    }

    const nodes = getNodes() || []
    const circleRadius = 30 * nodeScaleFactor.value
    const measure = document.createElement('canvas').getContext('2d')
    if (measure) {
      measure.font = `bold ${12 * nodeScaleFactor.value}px sans-serif`
    }

    nodes.forEach(mic => {
      const { x, y } = imageToCanvasCoords(mic.x, mic.y)
      minX = Math.min(minX, x - circleRadius)
      minY = Math.min(minY, y - circleRadius)
      maxX = Math.max(maxX, x + circleRadius)
      maxY = Math.max(maxY, y + circleRadius)

      const labelText = mic.track_name || mic.label || ''
      const textMetrics = measure ? measure.measureText(labelText) : null
      const padX = 6 * nodeScaleFactor.value
      const padY = 4 * nodeScaleFactor.value
      const bgW = textMetrics ? Math.ceil(textMetrics.width) + padX * 2 : (labelText.length * 7 * nodeScaleFactor.value) + padX * 2
      const bgH = (18 * nodeScaleFactor.value) + padY * 2
      const rotation = mic.rotation || 0
      const labelAngle = (rotation + 180) * (Math.PI / 180)
      const labelDistance = 40 * nodeScaleFactor.value
      const labelX = x + Math.sin(labelAngle) * labelDistance
      const labelY = y - Math.cos(labelAngle) * labelDistance
      const lx = labelX - bgW / 2
      const ly = labelY - bgH / 2
      minX = Math.min(minX, lx)
      minY = Math.min(minY, ly)
      maxX = Math.max(maxX, lx + bgW)
      maxY = Math.max(maxY, ly + bgH)
    })

    if (!isFinite(minX) || !isFinite(minY)) {
      if (bgImageObj.value) {
        const fit = fitImageToCanvas(bgImageObj.value)
        scaleFactor.value = fit.scale
        imageOffsetX.value = fit.offsetX
        imageOffsetY.value = fit.offsetY
        redraw && redraw()
      }
      return
    }

    if (bgImageObj.value) {
      const targetWidth = canvasWidth.value - PADDING * 2
      const targetHeight = canvasHeight.value - PADDING * 2
      const targetCenterX = canvasWidth.value / 2
      const targetCenterY = canvasHeight.value / 2

      let imgMinX = 0, imgMinY = 0, imgMaxX = 1, imgMaxY = 1
      nodes.forEach(mic => {
        imgMinX = Math.min(imgMinX, mic.x)
        imgMinY = Math.min(imgMinY, mic.y)
        imgMaxX = Math.max(imgMaxX, mic.x)
        imgMaxY = Math.max(imgMaxY, mic.y)
      })

      const imgContentWidth = Math.max(imgMaxX - imgMinX, 0.1)
      const imgContentHeight = Math.max(imgMaxY - imgMinY, 0.1)

      const imgScaleX = targetWidth / (imgContentWidth * bgImageObj.value.width)
      const imgScaleY = targetHeight / (imgContentHeight * bgImageObj.value.height)
      const newImageScale = Math.min(imgScaleX, imgScaleY)

      const imgContentCenterX = (imgMinX + imgMaxX) / 2
      const imgContentCenterY = (imgMinY + imgMaxY) / 2

      const newOffsetX = targetCenterX - imgContentCenterX * bgImageObj.value.width * newImageScale
      const newOffsetY = targetCenterY - imgContentCenterY * bgImageObj.value.height * newImageScale

      scaleFactor.value = newImageScale
      imageOffsetX.value = newOffsetX
      imageOffsetY.value = newOffsetY
    }

    nodeScaleFactor.value = 1
    saveNodeScale()
    redraw && redraw()
  }

  return {
    dpr,
    canvasWidth,
    canvasHeight,
    nodeScaleFactor,
    canvasStyle,
    clamp,
    canvasToImageCoords,
    imageToCanvasCoords,
    getCanvasCoords,
    zoomIn,
    zoomOut,
    applyZoom,
    updateCanvasSize,
    resetImageView,
    loadNodeScale,
    saveNodeScale,
    MIN_SCALE,
    MAX_SCALE
  }
}
