import { ref, watch, nextTick } from 'vue'

const DRAG_THRESHOLD = 5 // pixels - minimum movement to consider a drag
const TAP_TIMEOUT = 300 // ms - max delay between taps for double-tap

/**
 * Canvas pointer interactions: tap-to-select, drag-to-move (multi-select
 * aware), rotate-on-drag, two-finger pan/zoom for iPad/touch, plus the
 * double-tap heuristic that opens the context menu on touch/pen input.
 *
 * Selection state lives here so the same `selectedMic` / `selectedMics` refs
 * can be consumed by other composables (draw loop, context menu) via the
 * accessors returned below.
 */
export function useMicPointerInteraction({
  canvasRef,
  panImageMode,
  rotateMode,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  showContextMenu,
  isMobile,
  getCanvasCoords,
  canvasToImageCoords,
  applyZoom,
  drawCanvas,
  getMicAt,
  saveMicUpdate,
  openContextMenu,
  saveImageState
}) {
  // Selection
  const selectedMic = ref(null)
  const selectedMics = ref(new Set())

  // Drag tracking
  const draggingMic = ref(null)
  const draggingMics = ref(new Set())
  const dragStartPositions = new Map()
  let dragStart = null
  let dragStartPos = null

  // Rotate-on-drag state
  const rotatingMic = ref(null)
  let rotatePointerId = null
  let rotateStartPointerAngle = 0
  let rotateStartMicRotation = 0

  function angleFromMicToImgPt(mic, imgX, imgY) {
    return Math.atan2(imgY - mic.y, imgX - mic.x) * 180 / Math.PI
  }

  // Pan and Rotate are mutually exclusive.
  watch(rotateMode, (on) => { if (on) panImageMode.value = false })
  watch(panImageMode, (on) => { if (on) rotateMode.value = false })

  // Pinch / multi-finger helpers
  const activePointers = new Map()
  const pointerTypes = new Map()
  let lastPinchDistance = null
  const gestureState = ref({
    isTwoFingerPan: false,
    isTwoFingerZoom: false,
    panStart: null,
    panStartImageOffset: null
  })
  let lastTapTime = 0
  let lastTapPoint = null

  function onPointerDown(e) {
    e.preventDefault()
    if (e.button !== 0 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return

    canvasRef.value.setPointerCapture(e.pointerId)

    const { x, y } = getCanvasCoords(e)
    const pointerInfo = {
      x, y,
      initialX: x, initialY: y,
      type: e.pointerType || 'mouse',
      timestamp: Date.now()
    }
    activePointers.set(e.pointerId, pointerInfo)
    pointerTypes.set(e.pointerId, e.pointerType || 'mouse')

    const activePointerIds = Array.from(activePointers.keys())
    const touchPointers = activePointerIds.filter(id => pointerTypes.get(id) === 'touch')

    // Two-finger touch detected - enable gesture mode
    if (activePointers.size === 2 && touchPointers.length === 2) {
      gestureState.value.isTwoFingerPan = true
      gestureState.value.isTwoFingerZoom = false
      const pts = Array.from(activePointers.values())
      gestureState.value.panStart = {
        centerX: (pts[0].x + pts[1].x) / 2,
        centerY: (pts[0].y + pts[1].y) / 2,
        pointers: [...pts]
      }
      gestureState.value.panStartImageOffset = {
        x: imageOffsetX.value,
        y: imageOffsetY.value
      }
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      lastPinchDistance = Math.sqrt(dx * dx + dy * dy)
      return
    }

    // Pan-image mode (explicit toggle)
    if (panImageMode.value && bgImageObj.value) {
      dragStart = { x, y }
      dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
      return
    }

    const imgPt = canvasToImageCoords(x, y)
    const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)

    // Rotate-on-drag: tapping a mic begins a rotation drag session.
    if (rotateMode.value && clickedMic) {
      rotatingMic.value = clickedMic
      rotatePointerId = e.pointerId
      rotateStartPointerAngle = angleFromMicToImgPt(clickedMic, imgPt.imgX, imgPt.imgY)
      rotateStartMicRotation = Number(clickedMic.rotation) || 0
      selectedMics.value.clear()
      selectedMics.value.add(clickedMic)
      selectedMic.value = clickedMic
      drawCanvas()
      return
    }

    // For touch/pen: multi-finger tap = multi-select. For mouse: Ctrl/Cmd.
    const isMultiSelect = e.ctrlKey || e.metaKey ||
      (e.pointerType === 'touch' && activePointers.size > 1)

    if (clickedMic) {
      if (isMultiSelect) {
        if (selectedMics.value.has(clickedMic)) {
          selectedMics.value.delete(clickedMic)
        } else {
          selectedMics.value.add(clickedMic)
        }
        selectedMic.value = selectedMics.value.size > 0 ? Array.from(selectedMics.value)[0] : null
      } else {
        if (selectedMics.value.has(clickedMic) && selectedMics.value.size === 1) {
          // Already selected; keep it for dragging
        } else {
          selectedMics.value.clear()
          selectedMics.value.add(clickedMic)
        }
      }

      selectedMic.value = selectedMics.value.size > 0 ? Array.from(selectedMics.value)[0] : null

      draggingMics.value.clear()
      selectedMics.value.forEach(mic => {
        draggingMics.value.add(mic)
        dragStartPositions.set(mic, { x: mic.x, y: mic.y })
      })
      dragStart = { x: imgPt.imgX, y: imgPt.imgY }

      drawCanvas()
    } else {
      if (!showContextMenu.value) {
        if (!isMultiSelect) {
          selectedMics.value.clear()
          selectedMic.value = null
          drawCanvas()
        }
      }
    }
  }

  function onPointerMove(e) {
    e.preventDefault()
    const { x, y } = getCanvasCoords(e)
    if (activePointers.has(e.pointerId)) {
      const pointerInfo = activePointers.get(e.pointerId)
      pointerInfo.x = x
      pointerInfo.y = y
      activePointers.set(e.pointerId, pointerInfo)
    }

    if (activePointers.size >= 2 && bgImageObj.value) {
      const pts = Array.from(activePointers.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const centerX = (pts[0].x + pts[1].x) / 2
      const centerY = (pts[0].y + pts[1].y) / 2

      if (lastPinchDistance != null) {
        const distanceChange = Math.abs(dist - lastPinchDistance)
        const panThreshold = 10

        if (distanceChange > panThreshold) {
          gestureState.value.isTwoFingerZoom = true
          gestureState.value.isTwoFingerPan = false
          applyZoom(dist / lastPinchDistance, centerX, centerY)
          lastPinchDistance = dist
        } else if (gestureState.value.isTwoFingerPan && gestureState.value.panStart) {
          gestureState.value.isTwoFingerZoom = false
          const panDx = centerX - gestureState.value.panStart.centerX
          const panDy = centerY - gestureState.value.panStart.centerY
          imageOffsetX.value = gestureState.value.panStartImageOffset.x + panDx
          imageOffsetY.value = gestureState.value.panStartImageOffset.y + panDy
          drawCanvas()
        }
      } else {
        lastPinchDistance = dist
      }
      return
    }

    // Rotate-on-drag
    if (rotatingMic.value && e.pointerId === rotatePointerId) {
      const imgPt = canvasToImageCoords(x, y)
      const currentAngle = angleFromMicToImgPt(rotatingMic.value, imgPt.imgX, imgPt.imgY)
      const delta = currentAngle - rotateStartPointerAngle
      let next = rotateStartMicRotation + delta
      next = ((next % 360) + 360) % 360
      rotatingMic.value.rotation = Math.round(next)
      drawCanvas()
      return
    }

    if (panImageMode.value && dragStart && bgImageObj.value) {
      const dx = x - dragStart.x
      const dy = y - dragStart.y
      imageOffsetX.value = dragStartPos.x + dx
      imageOffsetY.value = dragStartPos.y + dy
      drawCanvas()
      return
    }

    if (draggingMics.value.size > 0 && dragStart) {
      const pointerType = pointerTypes.get(e.pointerId) || 'mouse'

      if (pointerType === 'touch' || pointerType === 'pen') {
        const pointerInfo = activePointers.get(e.pointerId)
        if (pointerInfo && pointerInfo.initialX !== undefined) {
          const moveDistance = Math.sqrt(
            Math.pow(x - pointerInfo.initialX, 2) + Math.pow(y - pointerInfo.initialY, 2)
          )
          if (moveDistance < DRAG_THRESHOLD) return
        }
      }

      const imgPt = canvasToImageCoords(x, y)
      const offsetX = imgPt.imgX - dragStart.x
      const offsetY = imgPt.imgY - dragStart.y

      draggingMics.value.forEach(mic => {
        const startPos = dragStartPositions.get(mic)
        if (startPos) {
          mic.x = startPos.x + offsetX
          mic.y = startPos.y + offsetY
        }
      })

      drawCanvas()
    }
  }

  async function onPointerUp(e) {
    e.preventDefault()
    const pointerType = pointerTypes.get(e.pointerId) || 'mouse'
    activePointers.delete(e.pointerId)
    pointerTypes.delete(e.pointerId)

    if (activePointers.size < 2) {
      lastPinchDistance = null
      gestureState.value.isTwoFingerPan = false
      gestureState.value.isTwoFingerZoom = false
      gestureState.value.panStart = null
      gestureState.value.panStartImageOffset = null
    }

    if (panImageMode.value) {
      dragStart = null
      dragStartPos = null
      saveImageState && saveImageState()
      return
    }

    if (rotatingMic.value && e.pointerId === rotatePointerId) {
      const mic = rotatingMic.value
      rotatingMic.value = null
      rotatePointerId = null
      try { await saveMicUpdate(mic) } catch {}
      drawCanvas()
      return
    }

    // Double-tap detection for pen / touch
    if (pointerType === 'pen' || pointerType === 'touch') {
      const { x, y } = getCanvasCoords(e)
      const currentTime = Date.now()
      const timeSinceLastTap = currentTime - lastTapTime
      const currentPoint = { x, y }

      if (lastTapPoint && timeSinceLastTap < TAP_TIMEOUT) {
        const distance = Math.sqrt(
          Math.pow(currentPoint.x - lastTapPoint.x, 2) +
          Math.pow(currentPoint.y - lastTapPoint.y, 2)
        )
        if (distance < 20) {
          const imgPt = canvasToImageCoords(x, y)
          const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)
          if (clickedMic) {
            selectedMics.value.clear()
            selectedMics.value.add(clickedMic)
            selectedMic.value = clickedMic
            drawCanvas()
            nextTick(() => openContextMenu(e))
          }
          lastTapTime = 0
          lastTapPoint = null
          return
        }
      }

      lastTapTime = currentTime
      lastTapPoint = currentPoint
    }

    // Check if dragging actually moved anything (vs a click)
    let wasDrag = false
    if (draggingMics.value.size > 0 && dragStart) {
      for (const mic of draggingMics.value) {
        const startPos = dragStartPositions.get(mic)
        if (startPos && (
          Math.abs(mic.x - startPos.x) > 0.001 ||
          Math.abs(mic.y - startPos.y) > 0.001
        )) {
          wasDrag = true
          break
        }
      }
    }

    if (wasDrag && draggingMics.value.size > 0) {
      await Promise.all(
        Array.from(draggingMics.value).map(mic => saveMicUpdate(mic))
      )
    }

    draggingMics.value.clear()
    dragStartPositions.clear()
    dragStart = null
    dragStartPos = null

    if (selectedMics.value.size > 0) drawCanvas()
  }

  function onWheel() {
    // Allow normal page scrolling - zoom is via buttons only.
  }

  function onDoubleClick(e) {
    const { x, y } = getCanvasCoords(e)
    const imgPt = canvasToImageCoords(x, y)
    const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)

    if (clickedMic) {
      selectedMics.value.clear()
      selectedMics.value.add(clickedMic)
      selectedMic.value = clickedMic
      drawCanvas()
      nextTick(() => openContextMenu(e))
    }
  }

  return {
    selectedMic,
    selectedMics,
    draggingMic,
    draggingMics,
    rotatingMic,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onDoubleClick,
    // Accessors for other composables
    getSelectedMic: () => selectedMic.value,
    getSelectedMics: () => selectedMics.value
  }
}
