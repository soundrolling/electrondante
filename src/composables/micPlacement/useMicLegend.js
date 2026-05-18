import { ref, watch } from 'vue'

/**
 * Floating colour-legend behaviour: visibility, draggable position with
 * localStorage persistence, and a `drawLegend` helper that renders the same
 * grouped entries onto an export canvas.
 *
 * Caller provides:
 *   - refs to legend element + canvas wrapper
 *   - `legendEntriesByMic` computed (from the colour-buttons composable)
 *   - getters for projectId/locationId/stageName (for storage key + header)
 *   - canvas width/height refs + transforms so the export drawer matches the
 *     interactive view
 */
export function useMicLegend({
  legendElRef,
  canvasWrapperRef,
  legendEntriesByMic,
  getProjectId,
  getLocationId,
  getStageName,
  getNodes,
  canvasWidth,
  canvasHeight,
  nodeScaleFactor,
  imageToCanvasCoords,
  rectangleCircleOverlap
}) {
  const showLegend = ref(false)
  const showMobileLegend = ref(false)
  const colorLegendMap = ref({})

  const legendStyle = ref({})
  const legendPosition = ref({ x: null, y: null })
  const legendDragging = ref(false)
  const legendDragStart = ref({ x: 0, y: 0 })

  function getLegendPositionKey() {
    const scope = getLocationId() ?? 'default'
    return `mic-placement-legend-pos-${getProjectId()}-${scope}`
  }

  function loadLegendPosition() {
    try {
      const key = getLegendPositionKey()
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        legendPosition.value = { x: parsed.x, y: parsed.y }
        updateLegendStyle()
        return true
      }
    } catch (err) {
      console.error('Error loading legend position:', err)
    }
    return false
  }

  function saveLegendPosition() {
    try {
      const key = getLegendPositionKey()
      if (legendPosition.value.x !== null && legendPosition.value.y !== null) {
        localStorage.setItem(key, JSON.stringify(legendPosition.value))
      }
    } catch (err) {
      console.error('Error saving legend position:', err)
    }
  }

  function updateLegendStyle() {
    if (!showLegend.value || Object.keys(colorLegendMap.value).length === 0) {
      legendStyle.value = {}
      return
    }

    if (legendPosition.value.x === null || legendPosition.value.y === null) {
      if (Object.keys(colorLegendMap.value).length === 0) {
        legendStyle.value = {}
        return
      }
      const EDGE_MARGIN = 20
      const lw = legendElRef.value?.offsetWidth || 220
      const lh = legendElRef.value?.offsetHeight || 120
      const wrapperWidth = canvasWrapperRef.value ? canvasWrapperRef.value.clientWidth : canvasWidth.value
      const canvasOffsetX = (wrapperWidth - canvasWidth.value) / 2
      legendPosition.value = {
        x: canvasOffsetX + canvasWidth.value - lw - EDGE_MARGIN,
        y: canvasHeight.value - lh - EDGE_MARGIN
      }
      saveLegendPosition()
    }

    legendStyle.value = {
      left: '0',
      top: '0',
      bottom: 'auto',
      right: 'auto',
      transform: `translate(${legendPosition.value.x}px, ${legendPosition.value.y}px)`,
      cursor: legendDragging.value ? 'grabbing' : 'grab'
    }
  }

  function clampLegendPosition(x, y) {
    const wrapperRect = canvasWrapperRef.value?.getBoundingClientRect()
    const lw = legendElRef.value?.offsetWidth || 200
    const lh = legendElRef.value?.offsetHeight || 100
    const wrapperWidth = wrapperRect?.width || canvasWidth.value
    const canvasOffsetX = (wrapperWidth - canvasWidth.value) / 2
    return {
      x: Math.max(canvasOffsetX, Math.min(x, canvasOffsetX + canvasWidth.value - lw)),
      y: Math.max(0, Math.min(y, canvasHeight.value - lh))
    }
  }

  function onLegendDragStart(e) {
    if (e.target.closest('.legend-close-btn')) return

    e.preventDefault()
    e.stopPropagation()

    const legendElement = e.target.closest('.color-legend')
    if (legendElement) legendElement.setPointerCapture(e.pointerId)

    legendDragging.value = true
    const rect = canvasWrapperRef.value.getBoundingClientRect()
    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top

    legendDragStart.value = {
      x: startX - legendPosition.value.x,
      y: startY - legendPosition.value.y
    }

    legendPosition.value = clampLegendPosition(
      startX - legendDragStart.value.x,
      startY - legendDragStart.value.y
    )
    updateLegendStyle()

    window.addEventListener('pointermove', onLegendDragMove)
    window.addEventListener('pointerup', onLegendDragEnd)
  }

  function onLegendDragMove(e) {
    if (!legendDragging.value) return
    e.preventDefault()
    const rect = canvasWrapperRef.value.getBoundingClientRect()
    legendPosition.value = clampLegendPosition(
      e.clientX - rect.left - legendDragStart.value.x,
      e.clientY - rect.top - legendDragStart.value.y
    )
    updateLegendStyle()
  }

  function onLegendDragEnd(e) {
    if (!legendDragging.value) return
    legendDragging.value = false

    if (e.target && e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId)
      } catch (err) {
        // ignore - pointer capture wasn't set
      }
    }

    saveLegendPosition()
    window.removeEventListener('pointermove', onLegendDragMove)
    window.removeEventListener('pointerup', onLegendDragEnd)
    updateLegendStyle()
  }

  function cleanup() {
    window.removeEventListener('pointermove', onLegendDragMove)
    window.removeEventListener('pointerup', onLegendDragEnd)
  }

  // Refresh `colorLegendMap` / `showLegend` based on which colour buttons
  // are actually in use by placed nodes. `colorButtons` comes in as a ref
  // so the caller can pass the same array used by the buttons composable.
  function updateColorLegend(colorButtonsRef) {
    const usedButtonIds = new Set()
    const nodes = getNodes() || []
    nodes.forEach(mic => {
      if (mic.color_button_id) usedButtonIds.add(mic.color_button_id)
    })

    const newLegendMap = {}
    const buttons = colorButtonsRef?.value || []
    buttons.forEach(btn => {
      if (usedButtonIds.has(btn.id)) newLegendMap[btn.id] = btn.name
    })

    colorLegendMap.value = newLegendMap
    showLegend.value = Object.keys(colorLegendMap.value).length > 0
  }

  // ── Canvas legend (used during PNG export) ───────────────
  function calculateLegendPosition(legendWidth, legendHeight, canvasW, canvasH, cornerPreference = 0) {
    const EDGE_MARGIN = 20
    const micNodeRadius = 20 * nodeScaleFactor.value

    const corners = [
      [canvasW - legendWidth - EDGE_MARGIN, canvasH - legendHeight - EDGE_MARGIN, 'bottom-right'],
      [EDGE_MARGIN, canvasH - legendHeight - EDGE_MARGIN, 'bottom-left'],
      [canvasW - legendWidth - EDGE_MARGIN, EDGE_MARGIN, 'top-right'],
      [EDGE_MARGIN, EDGE_MARGIN, 'top-left']
    ]

    const sides = [
      [(canvasW - legendWidth) / 2, canvasH - legendHeight - EDGE_MARGIN, 'bottom-center'],
      [(canvasW - legendWidth) / 2, EDGE_MARGIN, 'top-center'],
      [EDGE_MARGIN, (canvasH - legendHeight) / 2, 'left-center'],
      [canvasW - legendWidth - EDGE_MARGIN, (canvasH - legendHeight) / 2, 'right-center']
    ]

    const reorderedCorners = [
      ...corners.slice(cornerPreference),
      ...corners.slice(0, cornerPreference)
    ]

    const positions = [...reorderedCorners, ...sides]
    const nodes = getNodes() || []

    for (const [x, y] of positions) {
      if (x < 0 || y < 0 || x + legendWidth > canvasW || y + legendHeight > canvasH) {
        continue
      }
      let hasCollision = false
      for (const mic of nodes) {
        const { x: micX, y: micY } = imageToCanvasCoords(mic.x, mic.y)
        if (rectangleCircleOverlap(
          x, y, legendWidth, legendHeight,
          micX, micY, micNodeRadius
        )) {
          hasCollision = true
          break
        }
      }
      if (!hasCollision) return { x, y }
    }

    return {
      x: canvasW - legendWidth - EDGE_MARGIN,
      y: canvasH - legendHeight - EDGE_MARGIN
    }
  }

  function drawLegend(ctx, canvasW = null, canvasH = null) {
    const entries = legendEntriesByMic.value
    if (entries.length === 0) return

    const w = canvasW ?? canvasWidth.value
    const h = canvasH ?? canvasHeight.value

    const LEGEND_PADDING = 12
    const LEGEND_ITEM_HEIGHT = 24
    const LEGEND_ITEM_GAP = 8
    const SWATCH_SIZE = 16
    const SWATCH_MARGIN = 8
    const COUNT_GAP = 8

    ctx.font = '12px sans-serif'
    let maxTextWidth = 0
    entries.forEach(entry => {
      const countText = `x${entry.count}`
      const nameMetrics = ctx.measureText(entry.gearName)
      const countMetrics = ctx.measureText(countText)
      maxTextWidth = Math.max(maxTextWidth, nameMetrics.width + COUNT_GAP + countMetrics.width)
    })

    const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + maxTextWidth + LEGEND_PADDING * 2
    const legendHeight = (LEGEND_ITEM_HEIGHT * entries.length) + (LEGEND_ITEM_GAP * (entries.length - 1)) + LEGEND_PADDING * 2 + 20

    const { x: legendX, y: legendY } = calculateLegendPosition(legendWidth, legendHeight, w, h, 0)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = 1
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 8)
      ctx.fill()
      ctx.stroke()
    } else {
      const r = 8
      ctx.beginPath()
      ctx.moveTo(legendX + r, legendY)
      ctx.lineTo(legendX + legendWidth - r, legendY)
      ctx.quadraticCurveTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + r)
      ctx.lineTo(legendX + legendWidth, legendY + legendHeight - r)
      ctx.quadraticCurveTo(legendX + legendWidth, legendY + legendHeight, legendX + legendWidth - r, legendY + legendHeight)
      ctx.lineTo(legendX + r, legendY + legendHeight)
      ctx.quadraticCurveTo(legendX, legendY + legendHeight, legendX, legendY + legendHeight - r)
      ctx.lineTo(legendX, legendY + r)
      ctx.quadraticCurveTo(legendX, legendY, legendX + r, legendY)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    ctx.fillStyle = '#333'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(getStageName() || 'Color Legend', legendX + LEGEND_PADDING, legendY + LEGEND_PADDING)

    let itemY = legendY + LEGEND_PADDING + 20
    entries.forEach(entry => {
      const swatchX = legendX + LEGEND_PADDING
      const textX = swatchX + SWATCH_SIZE + SWATCH_MARGIN
      const midY = itemY + SWATCH_SIZE / 2

      ctx.fillStyle = entry.color || '#ccc'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.rect(swatchX, itemY, SWATCH_SIZE, SWATCH_SIZE)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#222'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(entry.gearName, textX, midY)

      const countText = `x${entry.count}`
      ctx.fillStyle = '#888'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(countText, legendX + legendWidth - LEGEND_PADDING, midY)

      itemY += LEGEND_ITEM_HEIGHT + LEGEND_ITEM_GAP
    })
  }

  // Recompute legend style whenever the visibility / contents / canvas
  // dimensions change.
  watch([showLegend, colorLegendMap, canvasWidth, canvasHeight], () => {
    updateLegendStyle()
  }, { deep: true })

  return {
    showLegend,
    showMobileLegend,
    colorLegendMap,
    legendStyle,
    legendPosition,
    legendDragging,
    legendDragStart,
    loadLegendPosition,
    saveLegendPosition,
    updateLegendStyle,
    clampLegendPosition,
    onLegendDragStart,
    onLegendDragMove,
    onLegendDragEnd,
    cleanup,
    updateColorLegend,
    calculateLegendPosition,
    drawLegend
  }
}
