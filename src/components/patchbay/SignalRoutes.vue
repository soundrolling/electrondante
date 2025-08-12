<template>
<svg
  class="absolute inset-0 w-full h-full"
  :style="{ pointerEvents: props.deletePathMode ? 'auto' : 'none' }"
>
  <defs>
    <marker
      id="arrowhead"
      markerWidth="6"
      markerHeight="6"
      refX="5"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L0,6 L6,3 z" :fill="arrowColor" />
    </marker>
  </defs>

  <g v-if="patchBay.currentLayoutId && patchBay.nodes.length && patchBay.connections.length">
    <template v-for="route in patchBay.connections" :key="route.id">
      <!-- Invisible hit-area for mobile -->
      <line
        :x1="getEnd(route.from_node,false).x" :y1="getEnd(route.from_node,false).y"
        :x2="getEnd(route.to_node,  true).x" :y2="getEnd(route.to_node,  true).y"
        stroke="transparent"
        :stroke-width="hitStrokeWidth"
        style="pointer-events: stroke;"
        @pointerdown="handleClick(route.id)"
      />
      <!-- Visible arrowed line -->
      <line
        :x1="getEnd(route.from_node,false).x" :y1="getEnd(route.from_node,false).y"
        :x2="getEnd(route.to_node,  true).x" :y2="getEnd(route.to_node,  true).y"
        marker-end="url(#arrowhead)"
        :class="[
          'stroke-blue-600',
          'stroke-2',
          { 'hover:stroke-red-500 cursor-pointer': props.deletePathMode },
          { 'hover:stroke-blue-800': !props.deletePathMode }
        ]"
        @click="handleClick(route.id)"
      />
    </template>
  </g>
</svg>
</template>

<script setup>
import { defineProps, computed } from 'vue';
import { usePatchBayStore } from '@/stores/patchBayStore';

const props    = defineProps({ deletePathMode: Boolean });
const emit     = defineEmits(['remove-route']);
const patchBay = usePatchBayStore();

// arrow color when deleting
const arrowColor     = computed(() => props.deletePathMode ? '#ef4444' : '#3b82f6');
// hit-area width
const hitStrokeWidth = 24;

// node sizing constants (must match CanvasView)
const NODE_ELEMENT_WIDTH = 140;
const NODE_MIN_HEIGHT    = 70;

function getEnd(nodeId, isInput) {
const node = patchBay.nodes.find(n => n.id === nodeId);
if (!node) return { x:-1000, y:-1000 };
const cx = node.x + NODE_ELEMENT_WIDTH/2;
const y  = isInput ? node.y : node.y + NODE_MIN_HEIGHT;
return { x: cx, y };
}

function handleClick(routeId) {
if (props.deletePathMode) {
  emit('remove-route', routeId);
}
}
</script>

<style scoped>
svg {
min-width: 100%;
min-height: 100%;
}
</style>