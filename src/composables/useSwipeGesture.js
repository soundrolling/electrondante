import { ref, onMounted, onUnmounted } from 'vue'

export function useSwipeGesture(elementRef, options = {}) {
  const { onSwipeLeft, onSwipeRight, threshold = 50 } = options
  
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const touchEndX = ref(0)
  const touchEndY = ref(0)

  function handleTouchStart(e) {
    touchStartX.value = e.touches[0].clientX
    touchStartY.value = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    touchEndX.value = e.changedTouches[0].clientX
    touchEndY.value = e.changedTouches[0].clientY
    handleSwipe()
  }

  function handleSwipe() {
    const deltaX = touchEndX.value - touchStartX.value
    const deltaY = touchEndY.value - touchStartY.value
    
    // Check if horizontal swipe is greater than vertical (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      }
    }
  }

  onMounted(() => {
    const element = elementRef.value || elementRef
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, { passive: true })
      element.addEventListener('touchend', handleTouchEnd, { passive: true })
    }
  })

  onUnmounted(() => {
    const element = elementRef.value || elementRef
    if (element) {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  })

  return {
    touchStartX,
    touchStartY,
    touchEndX,
    touchEndY
  }
}

