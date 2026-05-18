import { getContrastColor } from './colorHelpers'

/**
 * The canvas-drawing pipeline: full-frame redraw, per-mic drawing, label
 * collision avoidance.
 *
 * Returns plain functions; the caller wires them up to lifecycle / watchers.
 * State (bg image, transforms, selection, nodes) is passed in by reference so
 * the draw loop sees the same reactive values the rest of the UI uses.
 */
export function useMicCanvasDrawing({
  canvasRef,
  dpr,
  canvasWidth,
  canvasHeight,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  nodeScaleFactor,
  getNodes,
  getSelectedMics,
  imageToCanvasCoords,
  getColorButtonForMic
}) {
  // ── Rectangle / circle math ──────────────────────────────
  function rectangleCircleOverlap(rectX, rectY, rectW, rectH, circleX, circleY, circleRadius) {
    const closestX = Math.max(rectX, Math.min(circleX, rectX + rectW))
    const closestY = Math.max(rectY, Math.min(circleY, rectY + rectH))
    const dx = circleX - closestX
    const dy = circleY - closestY
    const distanceSquared = dx * dx + dy * dy
    return distanceSquared < (circleRadius * circleRadius)
  }

  function rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
  }

  // ── Label positioning ────────────────────────────────────
  function checkLabelCollision(labelX, labelY, labelW, labelH, ownMicX, ownMicY, micRadius, labelRects, labelPositions, currentIdx) {
    const nodes = getNodes() || []
    for (let i = 0; i < nodes.length; i++) {
      if (i === currentIdx) continue
      const { x: micX, y: micY } = imageToCanvasCoords(nodes[i].x, nodes[i].y)
      if (rectangleCircleOverlap(
        labelX - labelW / 2, labelY - labelH / 2, labelW, labelH,
        micX, micY, micRadius
      )) {
        return true
      }
    }
    for (let i = 0; i < currentIdx; i++) {
      const other = labelRects[i]
      const otherPos = labelPositions[i]
      if (rectanglesOverlap(
        labelX - labelW / 2, labelY - labelH / 2, labelW, labelH,
        otherPos.x - other.width / 2, otherPos.y - other.height / 2, other.width, other.height
      )) {
        return true
      }
    }
    return false
  }

  function findAlternativeLabelPosition(rect, allRects, existingPositions, currentIdx, scale, micRadius) {
    const baseDistance = 40 * scale
    const maxDistance = 100 * scale
    const angleStep = 15

    const angleOffsets = [0]
    for (let step = angleStep; step <= 180; step += angleStep) {
      angleOffsets.push(step, -step)
    }

    for (let distance = baseDistance + 10 * scale; distance <= maxDistance; distance += 10 * scale) {
      for (const angleOffset of angleOffsets) {
        const testAngle = rect.defaultAngle + (angleOffset * Math.PI / 180)
        const testX = rect.micX + Math.sin(testAngle) * distance
        const testY = rect.micY - Math.cos(testAngle) * distance

        const hasCollision = checkLabelCollision(
          testX, testY, rect.width, rect.height,
          rect.micX, rect.micY, micRadius,
          allRects, existingPositions, currentIdx
        )

        if (!hasCollision) return { x: testX, y: testY }
      }
    }
    return null
  }

  function calculateLabelPositions(ctx) {
    const scale = nodeScaleFactor.value
    const labelPositions = []
    const labelRects = []
    const micNodeRadius = 20 * scale
    const nodes = getNodes() || []

    nodes.forEach((mic, idx) => {
      const { x, y } = imageToCanvasCoords(mic.x, mic.y)
      const rotation = mic.rotation || 0
      const labelText = mic.track_name || mic.label || ''

      ctx.font = `bold ${12 * scale}px sans-serif`
      const textMetrics = ctx.measureText(labelText)
      const padX = 6 * scale
      const padY = 4 * scale
      const bgW = Math.ceil(textMetrics.width) + padX * 2
      const bgH = (18 * scale) + padY * 2

      const labelAngle = (rotation + 180) * (Math.PI / 180)
      const baseDistance = 40 * scale
      let labelX = x + Math.sin(labelAngle) * baseDistance
      let labelY = y - Math.cos(labelAngle) * baseDistance

      labelRects.push({
        micIdx: idx,
        micX: x,
        micY: y,
        defaultX: labelX,
        defaultY: labelY,
        defaultAngle: labelAngle,
        width: bgW,
        height: bgH,
        rotation: rotation
      })
    })

    labelRects.forEach((rect, idx) => {
      let finalX = rect.defaultX
      let finalY = rect.defaultY
      let needsLine = false

      const hasCollision = checkLabelCollision(
        finalX, finalY, rect.width, rect.height,
        rect.micX, rect.micY, micNodeRadius,
        labelRects, labelPositions, idx
      )

      if (hasCollision) {
        const alternatives = findAlternativeLabelPosition(
          rect, labelRects, labelPositions, idx, scale, micNodeRadius
        )
        if (alternatives) {
          finalX = alternatives.x
          finalY = alternatives.y
          needsLine = true
        }
      }

      labelPositions.push({
        x: finalX,
        y: finalY,
        needsLine: needsLine,
        micX: rect.micX,
        micY: rect.micY
      })
    })

    return labelPositions
  }

  // ── Drawing ──────────────────────────────────────────────
  function drawMic(ctx, mic, labelPos = null) {
    const { x, y } = imageToCanvasCoords(mic.x, mic.y)
    const rotation = mic.rotation || 0
    const scale = nodeScaleFactor.value

    const colorBtn = getColorButtonForMic(mic)
    const selectedMics = getSelectedMics()
    const isSelected = selectedMics && selectedMics.has(mic)
    const micColor = colorBtn ? colorBtn.color : (isSelected ? '#007bff' : '#fff')
    const borderColor = colorBtn ? colorBtn.color : (isSelected ? '#0056b3' : '#007bff')
    const labelBgColor = colorBtn ? colorBtn.color : 'rgba(255,255,255,0.92)'
    const labelTextColor = colorBtn ? getContrastColor(colorBtn.color) : '#222'

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(scale, scale)
    ctx.rotate((rotation * Math.PI) / 180)

    // Mic circle
    ctx.beginPath()
    ctx.arc(0, 0, 20, 0, 2 * Math.PI)
    ctx.fillStyle = isSelected ? '#007bff' : micColor
    ctx.strokeStyle = borderColor
    ctx.lineWidth = (isSelected ? 3 : 2) / scale
    ctx.fill()
    ctx.stroke()

    // Direction arrow
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(8, -2)
    ctx.lineTo(-8, -2)
    ctx.closePath()
    if (colorBtn) {
      const hex = colorBtn.color.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      const darkenFactor = 0.7
      ctx.fillStyle = `rgb(${Math.floor(r * darkenFactor)}, ${Math.floor(g * darkenFactor)}, ${Math.floor(b * darkenFactor)})`
    } else {
      ctx.fillStyle = isSelected ? '#0056b3' : '#495057'
    }
    ctx.fill()

    // Selection rings
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(0, 0, 35, 0, 2 * Math.PI)
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 3 / scale
      ctx.setLineDash([8, 4])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.beginPath()
      ctx.arc(0, 0, 30, 0, 2 * Math.PI)
      ctx.strokeStyle = '#0056b3'
      ctx.lineWidth = 2 / scale
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()

    // Label
    ctx.font = `bold ${12 * scale}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelText = mic.track_name || mic.label
    const textMetrics = ctx.measureText(labelText)
    const padX = 6 * scale
    const padY = 4 * scale
    const bgW = Math.ceil(textMetrics.width) + padX * 2
    const bgH = (18 * scale) + padY * 2

    let labelX, labelY
    if (labelPos) {
      labelX = labelPos.x
      labelY = labelPos.y
    } else {
      const labelAngle = (rotation + 180) * (Math.PI / 180)
      const labelDistance = 40 * scale
      labelX = x + Math.sin(labelAngle) * labelDistance
      labelY = y - Math.cos(labelAngle) * labelDistance
    }

    if (labelPos && labelPos.needsLine) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.lineWidth = 1 / scale
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(labelX, labelY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    ctx.fillStyle = labelBgColor
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1 / scale
    ctx.beginPath()
    ctx.rect(labelX - bgW / 2, labelY - bgH / 2, bgW, bgH)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = labelTextColor
    ctx.fillText(labelText, labelX, labelY)
  }

  function drawCanvas() {
    const ctx = canvasRef.value?.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

    if (bgImageObj.value) {
      ctx.globalAlpha = 1.0
      ctx.drawImage(
        bgImageObj.value,
        imageOffsetX.value,
        imageOffsetY.value,
        bgImageObj.value.width * scaleFactor.value,
        bgImageObj.value.height * scaleFactor.value
      )
      ctx.globalAlpha = 1.0
    }

    const labelPositions = calculateLabelPositions(ctx)

    const nodes = getNodes() || []
    nodes.forEach((mic, idx) => {
      drawMic(ctx, mic, labelPositions[idx])
    })
  }

  // Mic hit-testing in image coordinates.
  function getMicAt(imgX, imgY) {
    const baseRadius = 0.05
    const scaledRadius = baseRadius * nodeScaleFactor.value
    const nodes = getNodes() || []
    for (let i = nodes.length - 1; i >= 0; i--) {
      const mic = nodes[i]
      const dx = imgX - mic.x
      const dy = imgY - mic.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < scaledRadius) return mic
    }
    return null
  }

  return {
    drawCanvas,
    drawMic,
    calculateLabelPositions,
    rectangleCircleOverlap,
    rectanglesOverlap,
    getMicAt
  }
}
