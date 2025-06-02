<template>
  <div
    v-show="visible"
    :style="{
      position: 'absolute',
      top: `${position.y}px`,
      left: `${position.x}px`,
      backgroundColor: '#fff',
      opacity: 1,
      fontSize: '14px',
      padding: '8px',
      borderRadius: '5px',
      zIndex: 9,
      pointerEvents: 'none',
    }"
  >
    <div v-if="link">
      <div>
        <span>连线ID</span> <span>{{ link.id }}</span>
      </div>
      <div>
        <span>起点</span> <span>{{ link.source.name }}</span>
      </div>
      <div>
        <span>终点</span> <span>{{ link.target.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IdcLinkInfo } from '@/api/api'

defineProps<{
  visible: boolean
  position: { x: number; y: number }
  link: IdcLinkInfo | null
}>()
</script>
