<!-- src/components/Calendar.vue -->
<template>
<CalendarMain />
</template>

<script>
import CalendarMain from './calendar/CalendarMain.vue'

export default {
name: 'Calendar',
components: {
  CalendarMain
}
}
</script>

<style scoped>
/* No additional styles needed - all styling is handled by subcomponents */
</style>