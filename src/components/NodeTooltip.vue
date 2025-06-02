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
    <div v-if="node">
      <div>
        <span>节点ID</span> <span>{{ node.id }}</span>
      </div>
      <div>
        <span>名称</span> <span>{{ node.name }}</span>
      </div>
      <div v-if="node.viaLines && node.viaLines.length > 0">
        <span>关联连线</span>
        <ul>
          <li v-for="link in node.viaLines" :key="link.id">
            {{ link.source.name }} &lt;-&gt; {{ link.target.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IdcNodeInfo } from '@/api/api'

defineProps<{
  visible: boolean
  position: { x: number; y: number }
  node: IdcNodeInfo | null
}>()
</script>
