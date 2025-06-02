<!-- filepath: /workspaces/vue-map-node/src/components/SearchBox.vue -->
<template>
  <div class="search-box">
    <div class="flex items-center">
      <span class="icon-search">&#128269;</span>
      <input
        v-model="searchText"
        type="text"
        placeholder="搜索节点或连线"
        class="search-input"
        @input="onSearch"
      />
    </div>
    <transition name="fade">
      <ul v-if="searchResults.length" class="search-dropdown">
        <li
          v-for="item in searchResults"
          :key="item.key"
          class="search-dropdown-item"
          @mousedown.prevent="onSelectResult(item)"
          @mouseenter="emit('hover', item)"
        >
          <span v-if="item.type === 'node'">节点：</span>
          <span v-if="item.type === 'link'">连线：</span>
          {{ item.label }}
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue'
import type { IdcNode, IdcLinkInfo } from '@/api/api'

const props = defineProps<{
  nodes: IdcNode[]
  links: IdcLinkInfo[]
}>()

const emit = defineEmits<{
  (e: 'select', item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }): void
  (e: 'hover', item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }): void
}>()

const searchText = ref('')
const searchResults = ref<
  { type: 'node' | 'link'; key: string; label: string; node?: IdcNode; link?: IdcLinkInfo }[]
>([])

function onSearch() {
  const text = searchText.value.trim().toLowerCase()
  if (!text) {
    searchResults.value = []
    return
  }
  // 搜索节点
  const nodeResults = props.nodes
    .filter((n) => n.name.toLowerCase().includes(text) || String(n.id).includes(text))
    .map((n) => ({
      type: 'node' as const,
      key: `node-${n.id}`,
      label: `${n.name} (ID:${n.id})`,
      node: n,
    }))
  // 搜索连线
  const linkResults = props.links
    .filter(
      (l) =>
        l.source.name.toLowerCase().includes(text) ||
        l.target.name.toLowerCase().includes(text) ||
        String(l.id).includes(text),
    )
    .map((l) => ({
      type: 'link' as const,
      key: `link-${l.id}`,
      label: `${l.source.name} <-> ${l.target.name} (ID:${l.id})`,
      link: l,
    }))
  searchResults.value = [...nodeResults, ...linkResults]
}

function onSelectResult(item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }) {
  searchResults.value = []
  searchText.value = ''
  emit('select', item)
}
</script>

<style scoped>
.search-box {
  position: absolute;
  top: 32px;
  left: 32px;
  z-index: 100;
  width: 44px;
  height: 44px;
  overflow: visible;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition:
    width 0.3s cubic-bezier(0.4, 2, 0.6, 1),
    background 0.2s;
}

.search-box:hover,
.search-box:focus-within {
  width: 260px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: auto;
}

.search-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 1rem;
  width: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    width 0.3s,
    opacity 0.2s,
    padding 0.2s;
}

.search-box:hover .search-input,
.search-box:focus-within .search-input,
.search-input:not(:placeholder-shown) {
  width: 180px;
  padding: 0.25rem 0.5rem;
  opacity: 1;
  pointer-events: auto;
}

.icon-search {
  font-size: 1.3rem;
  pointer-events: none;
  color: #888;
}

.search-dropdown {
  position: absolute;
  top: 48px;
  left: 0;
  width: 100%;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.13);
  border: 1px solid #eee;
  padding: 4px 0;
  margin-top: 4px;
  z-index: 101;
  max-height: 240px;
  overflow-y: auto;
  display: none;
}

.search-box:hover .search-dropdown,
.search-box:focus-within .search-dropdown,
.search-input:not(:placeholder-shown) ~ .search-dropdown {
  display: block;
}

.search-dropdown-item {
  padding: 8px 18px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 15px;
  color: #333;
  border-bottom: 1px solid #f2f2f2;
}
.search-dropdown-item:last-child {
  border-bottom: none;
}
.search-dropdown-item:hover {
  background: #f5f7fa;
  color: #1976d2;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
