<!-- src/components/icons/ChangeoverIcon.vue -->
<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    :class="className"
  >
    <!-- Outer circle -->
    <circle cx="12" cy="12" r="9" />
    <!-- Circular arrow path - top half going right -->
    <path d="M6 12A6 6 0 0 0 18 12" stroke="currentColor" fill="none" />
    <path d="M16 9L18 12L16 15" fill="currentColor" />
    <!-- Circular arrow path - bottom half going left -->
    <path d="M18 12A6 6 0 0 0 6 12" stroke="currentColor" fill="none" />
    <path d="M8 15L6 12L8 9" fill="currentColor" />
  </svg>
</template>

<script>
export default {
  name: 'ChangeoverIcon',
  props: {
    size: {
      type: [Number, String],
      default: 20
    },
    className: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
svg {
  vertical-align: middle;
}
</style>
