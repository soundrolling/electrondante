/**
 * PDF Download Helper
 * Provides a reliable way to download PDFs that works on iPad and all modern browsers
 */

/**
 * Downloads a PDF using jsPDF instance with iPad-compatible method
 * @param {jsPDF} pdfDoc - The jsPDF instance
 * @param {string} filename - The filename for the download
 * @param {Function} toast - Optional toast function for success/error messages
 */
export function downloadPDF(pdfDoc, filename, toast = null) {
  try {
    // Ensure filename has .pdf extension
    const finalFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    
    // Modern iPadOS Safari (iOS 13+) supports download attribute with blob URLs
    // Try using jsPDF's save method first - it has built-in iPad support
    try {
      pdfDoc.save(finalFileName)
      if (toast) {
        toast.success('PDF downloaded successfully')
      }
      return
    } catch (saveError) {
      console.log('jsPDF save method failed, trying blob approach:', saveError)
    }
    
    // Fallback: Use blob URL with download attribute
    // This works on modern iPadOS Safari
    try {
      const pdfBlob = pdfDoc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = finalFileName
      link.style.display = 'none'
      
      // Add to DOM, click, then remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
      
      if (toast) {
        toast.success('PDF downloaded successfully')
      }
    } catch (blobError) {
      console.error('Blob download failed, trying data URI:', blobError)
      
      // Final fallback: Use data URI (less reliable but works as last resort)
      try {
        const pdfDataUri = pdfDoc.output('datauristring')
        const link = document.createElement('a')
        link.href = pdfDataUri
        link.download = finalFileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        if (toast) {
          toast.success('PDF downloaded successfully')
        }
      } catch (dataUriError) {
        console.error('All PDF download methods failed:', dataUriError)
        if (toast) {
          toast.error('Failed to download PDF. Please try again.')
        } else {
          alert('Failed to download PDF. Please try again.')
        }
      }
    }
  } catch (error) {
    console.error('PDF download error:', error)
    if (toast) {
      toast.error('Failed to download PDF')
    } else {
      alert('Failed to download PDF')
    }
  }
}

