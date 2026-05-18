import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'

/**
 * PNG export pipeline.
 *
 * Walks all mic + label bounds at the current zoom level, picks a safe
 * frame, draws onto an offscreen canvas (with a project-info header band),
 * stamps the legend, then either uploads to storage or returns the data URL.
 *
 * The heavy `exportDocsStorage` helpers are dynamically imported so they
 * stay out of the initial bundle.
 */
export function useMicExport({
  props,
  canvasRef,
  canvasWidth,
  canvasHeight,
  bgImage,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  nodeScaleFactor,
  legendEntriesByMic,
  calculateLabelPositions,
  drawMic,
  drawLegend,
  imageToCanvasCoords
}) {
  const toast = useToast()

  // Filename prompt modal state
  const showFilenameModal = ref(false)
  const exportFilename = ref('')

  // Project information for export header
  const projectName = ref('')
  const projectDateRange = ref('')

  async function fetchProjectInfo() {
    try {
      if (!props.projectId) return
      const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, main_show_days')
        .eq('id', props.projectId)
        .single()

      if (!projectData) return

      projectName.value = projectData.project_name || ''

      if (projectData.main_show_days && Array.isArray(projectData.main_show_days) && projectData.main_show_days.length > 0) {
        const dates = projectData.main_show_days
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a - b)

        if (dates.length > 0) {
          const start = dates[0]
          const end = dates[dates.length - 1]

          const formatDate = (date) => {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
            })
          }

          if (start.getTime() === end.getTime()) {
            projectDateRange.value = formatDate(start)
          } else {
            projectDateRange.value = `${formatDate(start)} - ${formatDate(end)}`
          }
        } else {
          projectDateRange.value = ''
        }
      } else {
        projectDateRange.value = ''
      }
    } catch (error) {
      console.error('Error fetching project info:', error)
      projectName.value = ''
      projectDateRange.value = ''
    }
  }

  function exportToPDF() {
    if (!canvasRef.value) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    exportFilename.value = `mic-placement-${timestamp}`
    showFilenameModal.value = true
  }

  function closeFilenameModal() {
    showFilenameModal.value = false
    exportFilename.value = ''
  }

  async function confirmExport() {
    const filenameInput = exportFilename.value.trim()
    if (!filenameInput) {
      toast.error('Please enter a filename')
      return
    }

    let sanitizedFilename = filenameInput
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!sanitizedFilename || sanitizedFilename.length === 0) {
      sanitizedFilename = 'mic-placement-export'
    }

    sanitizedFilename = sanitizedFilename.replace(/\.png$/i, '')

    const filename = `${sanitizedFilename}.png`

    console.log('Export filename:', filename, 'from input:', filenameInput)

    closeFilenameModal()

    const dataURL = await getCanvasDataURL()
    if (!dataURL) {
      toast.error('Failed to generate export image')
      return
    }

    try {
      let venueId = null
      if (props.locationId) {
        try {
          const { data: locationData } = await supabase
            .from('locations')
            .select('venue_id')
            .eq('id', props.locationId)
            .single()
          if (locationData) venueId = locationData.venue_id || null
        } catch (err) {
          console.warn('Error fetching venue_id:', err)
        }
      }

      const { savePNGToStorage } = await import('@/services/exportDocsStorage')
      const description = `Mic placement export${props.stageName ? ` - ${props.stageName}` : ''}`

      const result = await savePNGToStorage(
        dataURL,
        filename,
        props.projectId,
        venueId,
        props.locationId,
        description
      )

      const { showExportSuccessModal } = await import('@/services/exportDocsStorage')
      showExportSuccessModal(result, filename, {
        projectId: props.projectId,
        venueId,
        stageId: props.locationId,
        mimeType: 'image/png'
      })
    } catch (e) {
      console.error('Error exporting canvas:', e)
      toast.error('Failed to export mic placement')
    }
  }

  async function getCanvasDataURL() {
    const PADDING = 20
    const dprLocal = window.devicePixelRatio || 1

    if (!canvasRef.value) return null

    const measure = document.createElement('canvas').getContext('2d')
    if (!measure) return null
    measure.font = 'bold 12px sans-serif'

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
    } else {
      minX = Math.min(minX, 0)
      minY = Math.min(minY, 0)
      maxX = Math.max(maxX, canvasWidth.value)
      maxY = Math.max(maxY, canvasHeight.value)
    }

    const exportLabelPositions = calculateLabelPositions(measure)

    const circleRadius = 30 * nodeScaleFactor.value
    const measureFont = `bold ${12 * nodeScaleFactor.value}px sans-serif`
    measure.font = measureFont

    props.nodes.forEach((mic, idx) => {
      const { x, y } = imageToCanvasCoords(mic.x, mic.y)
      minX = Math.min(minX, x - circleRadius)
      minY = Math.min(minY, y - circleRadius)
      maxX = Math.max(maxX, x + circleRadius)
      maxY = Math.max(maxY, y + circleRadius)

      const labelText = mic.track_name || mic.label || ''
      const textMetrics = measure.measureText(labelText)
      const padX = 6 * nodeScaleFactor.value
      const padY = 4 * nodeScaleFactor.value
      const bgW = Math.ceil(textMetrics.width) + padX * 2
      const bgH = (18 * nodeScaleFactor.value) + padY * 2

      let labelX, labelY
      if (exportLabelPositions[idx]) {
        labelX = exportLabelPositions[idx].x
        labelY = exportLabelPositions[idx].y
      } else {
        const rotation = mic.rotation || 0
        const labelAngle = (rotation + 180) * (Math.PI / 180)
        const labelDistance = 40 * nodeScaleFactor.value
        labelX = x + Math.sin(labelAngle) * labelDistance
        labelY = y - Math.cos(labelAngle) * labelDistance
      }

      const lx = labelX - bgW / 2
      const ly = labelY - bgH / 2
      minX = Math.min(minX, lx)
      minY = Math.min(minY, ly)
      maxX = Math.max(maxX, lx + bgW)
      maxY = Math.max(maxY, ly + bgH)
    })

    if (legendEntriesByMic.value.length > 0) {
      const legendMeasure = document.createElement('canvas').getContext('2d')
      if (legendMeasure) {
        legendMeasure.font = '12px sans-serif'
        let maxTextWidth = 0
        legendEntriesByMic.value.forEach(entry => {
          const countText = `x${entry.count}`
          const w = legendMeasure.measureText(entry.gearName).width + 8 + legendMeasure.measureText(countText).width
          maxTextWidth = Math.max(maxTextWidth, w)
        })
        const LEGEND_PADDING = 12
        const LEGEND_ITEM_HEIGHT = 24
        const LEGEND_ITEM_GAP = 8
        const SWATCH_SIZE = 16
        const SWATCH_MARGIN = 8
        const legendItemCount = legendEntriesByMic.value.length
        const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + maxTextWidth + LEGEND_PADDING * 2
        const legendHeight = (LEGEND_ITEM_HEIGHT * legendItemCount) + (LEGEND_ITEM_GAP * (legendItemCount - 1)) + LEGEND_PADDING * 2 + 20

        const legendX = maxX - legendWidth - 20
        const legendY = maxY - legendHeight - 20

        if (legendX < minX) minX = legendX
        if (legendY < minY) minY = legendY
        if (legendX + legendWidth > maxX) maxX = legendX + legendWidth
        if (legendY + legendHeight > maxY) maxY = legendY + legendHeight
      }
    }

    const HEADER_PADDING = 20
    const HEADER_BOTTOM_PADDING = 15
    let headerHeight = 0
    let headerText = ''
    let headerDateText = ''

    if (projectName.value || projectDateRange.value) {
      const headerMeasure = document.createElement('canvas').getContext('2d')
      if (headerMeasure) {
        const nameHeight = 34
        const dateHeight = 22
        const nameDateGap = 8
        headerHeight = HEADER_PADDING + nameHeight + nameDateGap + dateHeight + HEADER_BOTTOM_PADDING

        headerText = projectName.value || ''
        headerDateText = projectDateRange.value || ''
      }
    }

    const exportW = Math.max(1, Math.ceil((maxX - minX) + PADDING * 2))
    const exportH = Math.max(1, Math.ceil((maxY - minY) + PADDING * 2 + headerHeight))

    const off = document.createElement('canvas')
    off.width = exportW * dprLocal
    off.height = exportH * dprLocal
    const ctx = off.getContext('2d')
    if (!ctx) return null
    ctx.scale(dprLocal, dprLocal)

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, exportW, exportH)

    if (headerHeight > 0) {
      ctx.save()

      if (headerText) {
        ctx.font = 'bold 28px sans-serif'
        ctx.fillStyle = '#1a1a1a'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(headerText, exportW / 2, HEADER_PADDING)
      }

      if (headerDateText) {
        ctx.font = '18px sans-serif'
        ctx.fillStyle = '#666666'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const nameHeight = 34
        const nameDateGap = 8
        ctx.fillText(headerDateText, exportW / 2, HEADER_PADDING + nameHeight + nameDateGap)
      }

      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PADDING, headerHeight - HEADER_BOTTOM_PADDING)
      ctx.lineTo(exportW - PADDING, headerHeight - HEADER_BOTTOM_PADDING)
      ctx.stroke()

      ctx.restore()
    }

    ctx.save()
    ctx.translate(-minX + PADDING, -minY + PADDING + headerHeight)

    if (bgImage.value && bgImageObj.value) {
      try {
        const resp = await fetch(bgImage.value)
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        const exportImg = await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = blobUrl
        })
        ctx.globalAlpha = 1.0
        ctx.drawImage(
          exportImg,
          imageOffsetX.value,
          imageOffsetY.value,
          bgImageObj.value.width * scaleFactor.value,
          bgImageObj.value.height * scaleFactor.value
        )
        ctx.globalAlpha = 1.0
        URL.revokeObjectURL(blobUrl)
      } catch (_) {
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
    }

    const exportCtx = document.createElement('canvas').getContext('2d')
    if (exportCtx) {
      exportCtx.font = `bold ${12 * nodeScaleFactor.value}px sans-serif`
      const exportLabelPositions2 = calculateLabelPositions(exportCtx)

      props.nodes.forEach((mic, idx) => {
        drawMic(ctx, mic, exportLabelPositions2[idx])
      })
    } else {
      props.nodes.forEach(mic => drawMic(ctx, mic))
    }

    ctx.restore()

    if (legendEntriesByMic.value.length > 0) {
      drawLegend(ctx, exportW, exportH)
    }

    try {
      return off.toDataURL('image/png')
    } catch (e) {
      return null
    }
  }

  return {
    showFilenameModal,
    exportFilename,
    projectName,
    projectDateRange,
    fetchProjectInfo,
    exportToPDF,
    closeFilenameModal,
    confirmExport,
    getCanvasDataURL
  }
}
