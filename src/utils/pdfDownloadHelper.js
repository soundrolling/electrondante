/**
 * Enhanced PDF Download Helper
 * Maximum compatibility across all devices with comprehensive error handling
 */

/**
 * Configuration and constants
 */
const CONFIG = {
  CLEANUP_DELAY: 100,
  LONG_CLEANUP_DELAY: 1000,
  FILE_SYSTEM_TIMEOUT: 30000, // 30 seconds for File System Access API
  RETRY_DELAY: 500,
  MAX_RETRIES: 2
}

/**
 * Detects if the device is iOS/iPad
 * @returns {boolean}
 */
function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  
  const ua = navigator.userAgent || navigator.vendor || (typeof window !== 'undefined' ? window.opera : '')
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  
  // Check for iPad on iOS 13+ (which reports as MacIntel)
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  
  // Check for iOS in general
  const isIOSUA = /iPhone|iPad|iPod/i.test(ua)
  
  return isIOS || isIPadOS || isIOSUA
}

/**
 * Detects if the device is Safari
 * @returns {boolean}
 */
function isSafari() {
  if (typeof navigator === 'undefined') return false
  
  const ua = navigator.userAgent
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua)
  return isSafariBrowser
}

/**
 * Detects if the browser supports the download attribute
 * @returns {boolean}
 */
function supportsDownloadAttribute() {
  if (typeof document === 'undefined') return false
  
  try {
    const link = document.createElement('a')
    return typeof link.download !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Detects if File System Access API is available
 * @returns {boolean}
 */
function supportsFileSystemAccess() {
  try {
    return typeof window !== 'undefined' && 
           'showSaveFilePicker' in window &&
           typeof window.showSaveFilePicker === 'function'
  } catch {
    return false
  }
}

/**
 * Detects if popups are blocked
 * @returns {boolean}
 */
function isPopupBlocked() {
  if (typeof window === 'undefined') return false
  
  try {
    const testWindow = window.open('', '_blank', 'width=1,height=1')
    if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
      return true
    }
    testWindow.close()
    return false
  } catch {
    return true
  }
}

/**
 * Sanitizes filename for safe download
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `document-${Date.now()}.pdf`
  }
  
  // Remove or replace invalid characters
  let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  
  // Ensure .pdf extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized = `${sanitized}.pdf`
  }
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Ensure filename isn't empty after sanitization
  if (sanitized === '.pdf' || sanitized.length === 0) {
    sanitized = `document-${Date.now()}.pdf`
  }
  
  // Limit filename length (Windows has 255 char limit)
  if (sanitized.length > 200) {
    const extension = '.pdf'
    sanitized = sanitized.substring(0, 200 - extension.length) + extension
  }
  
  return sanitized
}

/**
 * Creates a safe blob URL with automatic cleanup
 * @param {Blob} blob - The blob
 * @returns {Object} - Object with url and cleanup function
 */
function createSafeBlobUrl(blob) {
  const url = URL.createObjectURL(blob)
  let cleaned = false
  
  const cleanup = () => {
    if (!cleaned) {
      try {
        URL.revokeObjectURL(url)
        cleaned = true
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error)
      }
    }
  }
  
  // Auto-cleanup after a longer delay as insurance
  setTimeout(cleanup, 60000) // 1 minute
  
  return { url, cleanup }
}

/**
 * Attempts to download using File System Access API with timeout
 * @param {Blob} blob - The PDF blob
 * @param {string} filename - The filename
 * @returns {Promise<boolean>} - True if successful
 */
async function tryFileSystemAccess(blob, filename) {
  if (!supportsFileSystemAccess()) {
    return false
  }
  
  try {
    // Race against timeout
    const downloadPromise = (async () => {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'PDF files',
          accept: { 'application/pdf': ['.pdf'] }
        }]
      })
      
      const writable = await fileHandle.createWritable()
      try {
        await writable.write(blob)
        await writable.close()
        return true
      } catch (writeError) {
        // Try to close the writable even if write fails
        try {
          await writable.close()
        } catch { /* ignore */ }
        throw writeError
      }
    })()
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('File System Access timeout')), CONFIG.FILE_SYSTEM_TIMEOUT)
    )
    
    return await Promise.race([downloadPromise, timeoutPromise])
  } catch (error) {
    // User cancelled is not an error
    if (error.name === 'AbortError') {
      return false
    }
    console.log('File System Access API failed:', error)
    return false
  }
}

/**
 * Attempts download using blob URL with download attribute
 * @param {Blob} blob - The PDF blob
 * @param {string} filename - The filename
 * @returns {Promise<boolean>} - True if successful
 */
async function tryBlobDownload(blob, filename) {
  if (!supportsDownloadAttribute()) {
    return false
  }
  
  const { url, cleanup } = createSafeBlobUrl(blob)
  
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.cssText = 'display: none; position: absolute; left: -9999px;'
    link.setAttribute('download', filename)
    link.rel = 'noopener noreferrer'
    
    document.body.appendChild(link)
    
    // Multiple click attempts for reliability
    try {
      link.click()
    } catch {
      // Fallback: dispatch click event
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      link.dispatchEvent(event)
    }
    
    // Cleanup
    await new Promise(resolve => setTimeout(resolve, CONFIG.CLEANUP_DELAY))
    
    try {
      if (link.parentNode) {
        document.body.removeChild(link)
      }
    } catch (removeError) {
      console.warn('Failed to remove link element:', removeError)
    }
    
    return true
  } catch (error) {
    console.log('Blob download failed:', error)
    return false
  } finally {
    setTimeout(cleanup, CONFIG.LONG_CLEANUP_DELAY)
  }
}

/**
 * Attempts download using data URI
 * @param {string} dataUri - The PDF data URI
 * @param {string} filename - The filename
 * @returns {Promise<boolean>} - True if successful
 */
async function tryDataUriDownload(dataUri, filename) {
  if (!supportsDownloadAttribute()) {
    return false
  }
  
  try {
    const link = document.createElement('a')
    link.href = dataUri
    link.download = filename
    link.style.cssText = 'display: none; position: absolute; left: -9999px;'
    link.setAttribute('download', filename)
    
    document.body.appendChild(link)
    
    try {
      link.click()
    } catch {
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      link.dispatchEvent(event)
    }
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.CLEANUP_DELAY))
    
    try {
      if (link.parentNode) {
        document.body.removeChild(link)
      }
    } catch { /* ignore */ }
    
    return true
  } catch (error) {
    console.log('Data URI download failed:', error)
    return false
  }
}

/**
 * Opens PDF in new window/tab
 * @param {Blob} blob - The PDF blob
 * @returns {Promise<boolean>} - True if successful
 */
async function tryWindowOpen(blob) {
  const { url, cleanup } = createSafeBlobUrl(blob)
  
  try {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
    
    if (newWindow && !newWindow.closed) {
      // Clean up after user has had time to load the PDF
      setTimeout(cleanup, CONFIG.LONG_CLEANUP_DELAY * 10)
      return true
    }
    
    cleanup()
    return false
  } catch (error) {
    console.log('Window.open failed:', error)
    cleanup()
    return false
  }
}

/**
 * Converts blob to data URI with error handling
 * @param {Blob} blob - The blob
 * @returns {Promise<string>} - Data URI
 */
function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    const timeout = setTimeout(() => {
      reader.abort()
      reject(new Error('FileReader timeout'))
    }, 30000) // 30 second timeout
    
    reader.onload = (e) => {
      clearTimeout(timeout)
      resolve(e.target.result)
    }
    
    reader.onerror = () => {
      clearTimeout(timeout)
      reject(reader.error || new Error('FileReader failed'))
    }
    
    reader.onabort = () => {
      clearTimeout(timeout)
      reject(new Error('FileReader aborted'))
    }
    
    try {
      reader.readAsDataURL(blob)
    } catch (error) {
      clearTimeout(timeout)
      reject(error)
    }
  })
}

/**
 * Attempts download with retry logic
 * @param {Function} downloadFn - Download function to try
 * @param {number} retries - Number of retries
 * @returns {Promise<boolean>}
 */
async function tryWithRetry(downloadFn, retries = CONFIG.MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await downloadFn()
      if (result) {
        return true
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error)
    }
    
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY))
    }
  }
  
  return false
}

/**
 * Downloads a PDF using jsPDF instance with comprehensive fallback strategies
 * @param {jsPDF} pdfDoc - The jsPDF instance
 * @param {string} filename - The filename for the download
 * @param {Function} toast - Optional toast function for success/error messages
 * @returns {Promise<void>}
 */
export async function downloadPDF(pdfDoc, filename, toast = null) {
  // Validate inputs
  if (!pdfDoc) {
    const errorMsg = 'PDF document is required'
    console.error(errorMsg)
    if (toast) {
      toast.error(errorMsg)
    } else {
      alert(errorMsg)
    }
    return
  }
  
  const finalFileName = sanitizeFilename(filename)
  
  try {
    // Strategy 1: jsPDF's built-in save (works on most modern browsers)
    try {
      pdfDoc.save(finalFileName)
      if (toast) {
        toast.success('PDF downloaded successfully')
      }
      return
    } catch (saveError) {
      console.log('jsPDF save method failed, trying alternatives:', saveError.message)
    }
    
    // Generate blob once for all strategies (more efficient)
    let pdfBlob
    try {
      pdfBlob = pdfDoc.output('blob')
    } catch (blobError) {
      console.error('Failed to create PDF blob:', blobError)
      throw new Error('Could not generate PDF file')
    }
    
    // Validate blob
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('Generated PDF is empty')
    }
    
    // Strategy 2: File System Access API (Chrome/Edge - best UX)
    if (supportsFileSystemAccess()) {
      try {
        const success = await tryFileSystemAccess(pdfBlob, finalFileName)
        if (success) {
          if (toast) {
            toast.success('PDF saved successfully')
          }
          return
        }
      } catch (fsError) {
        console.log('File System Access failed:', fsError)
      }
    }
    
    // Strategy 3: Blob download with retry (modern browsers)
    try {
      const success = await tryWithRetry(() => tryBlobDownload(pdfBlob, finalFileName))
      if (success) {
        if (toast) {
          toast.success('PDF downloaded successfully')
        }
        return
      }
    } catch (blobDownloadError) {
      console.log('Blob download with retry failed:', blobDownloadError)
    }
    
    // Strategy 4: Data URI download (fallback for blob issues)
    try {
      const dataUri = await blobToDataUri(pdfBlob)
      const success = await tryDataUriDownload(dataUri, finalFileName)
      if (success) {
        if (toast) {
          toast.success('PDF downloaded successfully')
        }
        return
      }
    } catch (dataUriError) {
      console.log('Data URI download failed:', dataUriError)
    }
    
    // Strategy 5: Try jsPDF data URI output directly
    try {
      const pdfDataUri = pdfDoc.output('datauristring')
      const success = await tryDataUriDownload(pdfDataUri, finalFileName)
      if (success) {
        if (toast) {
          toast.success('PDF downloaded successfully')
        }
        return
      }
    } catch (directDataUriError) {
      console.log('Direct data URI from jsPDF failed:', directDataUriError)
    }
    
    // Strategy 6: Open in new window (iOS/Safari and popup-blocked scenarios)
    const popupBlocked = isPopupBlocked()
    if (popupBlocked && toast) {
      toast.info('Please allow popups to download the PDF', { duration: 5000 })
    }
    
    try {
      const success = await tryWindowOpen(pdfBlob)
      if (success) {
        const message = isIOSDevice() || isSafari()
          ? 'PDF opened - please use the Share button to save'
          : 'PDF opened in new window - please save using your browser\'s save function'
        
        if (toast) {
          toast.info(message, { duration: 6000 })
        }
        return
      }
    } catch (windowOpenError) {
      console.log('Window.open failed:', windowOpenError)
    }
    
    // All strategies failed - provide helpful error message
    throw new Error('All download methods failed')
    
  } catch (error) {
    console.error('PDF download error:', error)
    
    // Provide context-specific error messages
    let errorMsg
    if (isIOSDevice()) {
      errorMsg = 'Unable to download PDF. Please try: 1) Using Safari browser, 2) Enabling downloads in Settings, 3) Allowing popups for this site'
    } else if (isSafari()) {
      errorMsg = 'Unable to download PDF. Please check your browser\'s download settings and allow downloads for this site'
    } else if (isPopupBlocked()) {
      errorMsg = 'Download blocked by popup blocker. Please allow popups for this site and try again'
    } else {
      errorMsg = 'Failed to download PDF. Please try again or use a different browser'
    }
    
    if (toast) {
      toast.error(errorMsg, { duration: 8000 })
    } else {
      alert(errorMsg)
    }
  }
}

/**
 * Alternative: Download PDF from ArrayBuffer (for direct API responses)
 * @param {ArrayBuffer} arrayBuffer - PDF data as ArrayBuffer
 * @param {string} filename - Filename
 * @param {Function} toast - Optional toast function
 * @returns {Promise<void>}
 */
export async function downloadPDFFromBuffer(arrayBuffer, filename, toast = null) {
  const finalFileName = sanitizeFilename(filename)
  
  try {
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
    
    if (blob.size === 0) {
      throw new Error('PDF data is empty')
    }
    
    // Try blob download first
    const success = await tryWithRetry(() => tryBlobDownload(blob, finalFileName))
    if (success) {
      if (toast) {
        toast.success('PDF downloaded successfully')
      }
      return
    }
    
    // Fallback to window.open
    const windowSuccess = await tryWindowOpen(blob)
    if (windowSuccess) {
      if (toast) {
        toast.info('PDF opened in new window', { duration: 5000 })
      }
      return
    }
    
    throw new Error('All download methods failed')
  } catch (error) {
    console.error('PDF download from buffer error:', error)
    const errorMsg = 'Failed to download PDF. Please try again'
    if (toast) {
      toast.error(errorMsg)
    } else {
      alert(errorMsg)
    }
  }
}

export default downloadPDF