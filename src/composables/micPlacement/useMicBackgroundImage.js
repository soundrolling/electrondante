import { ref } from 'vue'
import { supabase } from '@/supabase'

/**
 * Owns the background image used as the canvas backdrop.
 *
 * Reactive state:
 *   - `bgImage` - signed/public URL string used as <img> src
 *   - `bgImageObj` - HTMLImageElement once loaded (used by the draw loop)
 *   - `imageOffsetX/Y`, `scaleFactor` - pan/zoom transform applied when drawing
 *   - `bgOpacity` - kept for back-compat; current draw uses 1.0
 *
 * Caller passes:
 *   - getters for projectId / locationId (storage path scope)
 *   - getters for canvasWidth/canvasHeight and `getIsMobile()` for initial fit
 *   - a `redraw()` action invoked after the image loads
 */
export function useMicBackgroundImage({
  getProjectId,
  getLocationId,
  getCanvasWidth,
  getCanvasHeight,
  getIsMobile,
  redraw
}) {
  const bgImage = ref(null)
  const bgImageObj = ref(null)
  const bgOpacity = ref(1.0)
  const imageOffsetX = ref(0)
  const imageOffsetY = ref(0)
  const scaleFactor = ref(1)

  function storagePathForStage() {
    const projectId = getProjectId()
    if (!projectId) return null
    const scope = getLocationId() ?? 'default'
    return `mic-placement/${projectId}/${scope}/bg.png`
  }

  async function getBgPublicUrl() {
    try {
      const path = storagePathForStage()
      if (!path) return null
      const { data, error } = await supabase.storage
        .from('stage-pictures')
        .createSignedUrl(path, 60 * 60)
      if (error) return null
      return data?.signedUrl || null
    } catch {
      return null
    }
  }

  async function uploadBgToStorage(file) {
    const path = storagePathForStage()
    if (!path) throw new Error('Missing project id for background path')
    let removed = false
    try {
      const { error: remErr } = await supabase.storage.from('stage-pictures').remove([path])
      if (!remErr) removed = true
    } catch {}
    const { error } = await supabase.storage
      .from('stage-pictures')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data: signed, error: signErr } = await supabase.storage
      .from('stage-pictures')
      .createSignedUrl(path, 60 * 60)
    if (signErr) throw signErr
    return { url: `${signed.signedUrl}&v=${Date.now()}`, removed }
  }

  function fitImageToCanvas(img) {
    const canvasW = getCanvasWidth()
    const canvasH = getCanvasHeight()
    const imgW = img.width
    const imgH = img.height
    const scale = Math.min(canvasW / imgW, canvasH / imgH)
    const offsetX = (canvasW - imgW * scale) / 2
    const offsetY = (canvasH - imgH * scale) / 2
    return { scale, offsetX, offsetY }
  }

  async function setBackgroundImage(src, state) {
    return new Promise((resolve) => {
      bgImage.value = src
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        bgImageObj.value = img
        if (state) {
          bgOpacity.value = state.opacity ?? 1.0
          imageOffsetX.value = state.offsetX ?? 0
          imageOffsetY.value = state.offsetY ?? 0
          scaleFactor.value = state.scale ?? 1
        } else {
          const fit = fitImageToCanvas(img)
          // On mobile, zoom in 1.5x for easier tapping
          const mobileBoost = getIsMobile() ? 1.5 : 1
          scaleFactor.value = fit.scale * mobileBoost
          imageOffsetX.value = (getCanvasWidth() - img.width * scaleFactor.value) / 2
          imageOffsetY.value = (getCanvasHeight() - img.height * scaleFactor.value) / 2
        }
        redraw && redraw()
        resolve()
      }
      img.onerror = () => {
        bgImage.value = null
        bgImageObj.value = null
        redraw && redraw()
        resolve()
      }
      img.src = src
    })
  }

  async function loadImageState() {
    try {
      const cloudUrl = await getBgPublicUrl()
      if (cloudUrl) await setBackgroundImage(cloudUrl)
    } catch (_) {}
  }

  // Reserved for future use; transforms are session-only for now.
  function saveImageState() {}

  return {
    bgImage,
    bgImageObj,
    bgOpacity,
    imageOffsetX,
    imageOffsetY,
    scaleFactor,
    storagePathForStage,
    getBgPublicUrl,
    uploadBgToStorage,
    fitImageToCanvas,
    setBackgroundImage,
    loadImageState,
    saveImageState
  }
}
