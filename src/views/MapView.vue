<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { Map } from 'maplibre-gl'
import { ScatterplotLayer, ArcLayer, TextLayer } from '@deck.gl/layers'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { PickingInfo } from 'deck.gl'
import NodeTooltip from '@/components/NodeTooltip.vue'
import LinkTooltip from '@/components/LinkTooltip.vue'
import SearchBox from '@/components/SearchBox.vue'
import {
  fetchIdcNodesData,
  type IdcLine,
  type IdcLinkInfo,
  type IdcNode,
  type IdcNodeInfo,
} from '@/api/api'

const searchText = ref('')
const searchResults = ref<
  { type: 'node' | 'link'; key: string; label: string; node?: IdcNode; link?: IdcLinkInfo }[]
>([])

async function onSelectResult(item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }) {
  searchResults.value = []
  searchText.value = ''
  if (item.type === 'node' && item.node) {
    // 定位到节点
    hoverType.value = 'node'
    hoverNodeId.value = item.node.id
    nodeTooltipState.visible = true
    nodeTooltipState.position = { x: 0, y: 0 }
    nodeTooltipState.node = {
      ...item.node,
      viaLines: idcLinkMap.value[item.node.id] || [],
    }
    await nextTick()
    // 平移到节点
    map.value?.flyTo({ center: item.node.coord, zoom: 4 })
    updateLayers(true)
  } else if (item.type === 'link' && item.link) {
    // 定位到连线（取中点）
    hoverType.value = 'link'
    hoverNodeId.value = null
    linkTooltipState.visible = true
    linkTooltipState.position = { x: 0, y: 0 }
    linkTooltipState.link = item.link
    await nextTick()
    // 计算中点
    const lng = (item.link.source.coord[0] + item.link.target.coord[0]) / 2
    const lat = (item.link.source.coord[1] + item.link.target.coord[1]) / 2
    map.value?.flyTo({ center: [lng, lat], zoom: 3 })
    updateLayers(false)
  }
}

const onHoverResult = (item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }) => {
  if (item.type === 'node' && item.node) {
    hoverType.value = 'node'
    hoverNodeId.value = item.node.id
    nodeTooltipState.visible = true
    nodeTooltipState.position = { x: 0, y: 0 }
    nodeTooltipState.node = {
      ...item.node,
      viaLines: idcLinkMap.value[item.node.id] || [],
    }
    updateLayers(true) // 高亮节点
  } else if (item.type === 'link' && item.link) {
    hoverType.value = 'link'
    hoverNodeId.value = null
    linkTooltipState.visible = true
    linkTooltipState.position = { x: 0, y: 0 }
    linkTooltipState.link = item.link
    updateLayers(false) // 高亮连线
  } else {
    hoverType.value = null
    hoverNodeId.value = null
    nodeTooltipState.visible = false
    nodeTooltipState.node = null
    linkTooltipState.visible = false
    linkTooltipState.link = null
    updateLayers(false) // 取消高亮
  }
}

const mapContainer = ref<HTMLDivElement | null>(null)
const map = shallowRef<Map | null>(null)

const idcNodes = ref<IdcNode[]>([])
const idcLines = ref<IdcLine[]>([])

const hoverType = ref<'node' | 'link' | null>(null)
const nodeTooltipState = reactive({
  visible: false,
  position: { x: 0, y: 0 },
  node: null as IdcNodeInfo | null,
})

const linkTooltipState = reactive({
  visible: false,
  position: { x: 0, y: 0 },
  link: null as IdcLinkInfo | null,
})

const hoverNodeId = ref<number | null>(null)

// 脉冲动画（只给 outline 用）
const pulse = ref(0)
let pulseTimer: number | null = null
let pulseT = 0
function startPulse() {
  const animate = () => {
    // 更自然的脉冲（easeOutQuad）
    const t = pulseT % 1
    pulse.value = 1 - Math.pow(1 - t, 2)
    pulseT += 0.02
    if (hoverNodeId.value && deckOverlay) {
      updateLayers(true)
    }
    pulseTimer = requestAnimationFrame(animate)
  }
  animate()
}
onUnmounted(() => {
  if (pulseTimer) cancelAnimationFrame(pulseTimer)
  map.value?.remove()
})

const buildNodeLink = (nodes: IdcNode[], lines: IdcLine[]): IdcLinkInfo[] => {
  const linkInfos: IdcLinkInfo[] = []
  lines.forEach((line) => {
    if (line.source === line.target) return
    const sourceNode = nodes.find((node) => node.id === line.source)
    const targetNode = nodes.find((node) => node.id === line.target)
    if (sourceNode && targetNode) {
      const linkInfo: IdcLinkInfo = {
        id: line.id,
        description: line.description,
        source: sourceNode,
        target: targetNode,
      }
      linkInfos.push(linkInfo)
    }
  })
  return linkInfos
}

let deckOverlay: MapboxOverlay | null = null
const linkInfos = computed(() => buildNodeLink(idcNodes.value, idcLines.value))
const idcLinkMap = computed(() => {
  const map: Record<number, IdcLinkInfo[]> = {}
  linkInfos.value.forEach((link) => {
    if (!map[link.source.id]) map[link.source.id] = []
    if (!map[link.target.id]) map[link.target.id] = []
    map[link.source.id].push(link)
    map[link.target.id].push(link)
  })
  return map
})

const buildLayers = (nodes: IdcNode[], links: IdcLinkInfo[]) => {
  const arc = new ArcLayer({
    id: 'idc-arc',
    data: links,
    greatCircle: true,
    // getHeight: 0.1,
    // numSegments: 100,
    getSourcePosition: (d) => d.source.coord,
    getTargetPosition: (d) => d.target.coord,
    getWidth: (d) => {
      // 高亮连线加粗
      return linkTooltipState.link && d.id === linkTooltipState.link.id ? 4 : 1
    },
    getSourceColor: (d) => {
      // 高亮连线变色
      return linkTooltipState.link && d.id === linkTooltipState.link.id
        ? [249, 205, 23, 250]
        : [15, 129, 135]
    },
    getTargetColor: (d) => {
      return linkTooltipState.link && d.id === linkTooltipState.link.id
        ? [249, 205, 23, 250]
        : [59, 30, 177]
    },
    pickable: true,
    autoHighlight: true,
    highlightColor: [249, 205, 23, 250],
    onHover: (info: PickingInfo<IdcLinkInfo>) => {
      const { picked, x = 0, y = 0, object } = info
      if (picked && object) {
        hoverType.value = 'link'
        linkTooltipState.visible = true
        linkTooltipState.position = { x, y }
        linkTooltipState.link = object
        updateLayers(false)
      } else {
        linkTooltipState.visible = false
        linkTooltipState.link = null
        if (hoverType.value === 'link') {
          hoverType.value = null
          hoverNodeId.value = null
          updateLayers(true)
        }
      }
    },
    updateTriggers: {
      getWidth: [linkTooltipState.link?.id],
      getSourceColor: [linkTooltipState.link?.id],
      getTargetColor: [linkTooltipState.link?.id],
    },
  })

  // 节点本体：无动画
  const idcNodesScatter = new ScatterplotLayer({
    id: 'idc-nodes',
    data: nodes,
    getPosition: (d) => d.coord,
    getFillColor: [0, 211, 114, 250],
    getRadius: 30000,
    pickable: true,
    opacity: 0.3,
    autoHighlight: false,
    highlightColor: [0, 211, 114, 60],
    onHover: (info: PickingInfo<IdcNode>) => {
      if (info.object) {
        hoverType.value = 'node'
        hoverNodeId.value = info.object.id
        nodeTooltipState.visible = true
        nodeTooltipState.position = { x: (info.x ?? 0) + 0, y: (info.y ?? 0) - 80 }
        nodeTooltipState.node = {
          ...info.object,
          viaLines: idcLinkMap.value[info.object.id] || [],
        }
        updateLayers(true)
      } else {
        nodeTooltipState.visible = false
        nodeTooltipState.node = null
        if (hoverType.value === 'node') {
          hoverType.value = null
          hoverNodeId.value = null
          updateLayers(true)
        }
      }
    },
    updateTriggers: {
      getRadius: [hoverNodeId.value],
      getFillColor: [hoverNodeId.value],
    },
  })

  // 只让 outline 有动画
  const idctNodesOutlineScatter = new ScatterplotLayer({
    id: 'idc-nodes-outline',
    data: nodes,
    getPosition: (d) => d.coord,
    getLineColor: (d) => {
      if (d.id !== hoverNodeId.value) return [0, 211, 114, 80]
      const alpha = Math.round(220 - 180 * pulse.value)
      return [0, 211, 114, alpha]
    },
    getFillColor: [0, 0, 0, 0],
    getRadius: (d) => (d.id === hoverNodeId.value ? 32000 + 10000 * pulse.value : 32000),
    lineWidthMinPixels: 2,
    stroked: true,
    updateTriggers: {
      getRadius: [pulse.value, hoverNodeId.value],
      getLineColor: [pulse.value, hoverNodeId.value],
    },
  })

  const idcNodesText = new TextLayer({
    id: 'idc-nodes-text',
    data: nodes,
    getPosition: (d) => d.coord,
    getText: (d) => d.name,
    getAlignmentBaseline: 'center',
    getColor: [255, 128, 0],
    getSize: 200,
    getTextAnchor: 'middle',
    fontFamily: 'Noto Sans SC, Microsoft YaHei, Arial, sans-serif', // 指定支持中文的字体
  })

  return [idcNodesText, arc, idcNodesScatter, idctNodesOutlineScatter]
}

// updateLayers: 只在节点 hover 时过滤，否则显示全部
const updateLayers = (filterNode = false) => {
  let nodesData = idcNodes.value.map((n) => ({
    ...n,
    hovered: n.id === hoverNodeId.value,
  }))
  let linksData = linkInfos.value

  if (filterNode && hoverType.value === 'node' && hoverNodeId.value) {
    linksData = linkInfos.value.filter(
      (l) => l.source.id === hoverNodeId.value || l.target.id === hoverNodeId.value,
    )
    const relatedNodeIds = new Set<number>()
    linksData.forEach((l) => {
      relatedNodeIds.add(l.source.id)
      relatedNodeIds.add(l.target.id)
    })
    nodesData = nodesData.filter((n) => relatedNodeIds.has(n.id))
  }

  if (deckOverlay) {
    deckOverlay.setProps({ layers: buildLayers(nodesData, linksData) })
    map.value?.triggerRepaint()
  }
}

onMounted(() => {
  map.value = markRaw(
    new Map({
      container: mapContainer.value!,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 20],
      zoom: 2,
    }),
  )

  map.value.on('load', async (e) => {
    const ret = await fetchIdcNodesData()
    idcNodes.value = ret.nodes
    idcLines.value = ret.lines
    try {
      e.target.removeLayer('building')
    } catch {}
    try {
      e.target.removeLayer('building-top')
    } catch {}

    deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: buildLayers(idcNodes.value, linkInfos.value),
      onAfterRender: () => map.value?.triggerRepaint(),
      pickingRadius: 10,
    })

    e.target.addControl(deckOverlay)
    startPulse() // 只给 outline 层动画
  })

  map.value.on('zoom', updateLayers)
})
</script>

<template>
  <div class="flex items-center w-full h-screen p-5">
    <div ref="mapContainer" class="w-full h-[calc(80vh)]">
      <SearchBox
        :nodes="idcNodes"
        :links="linkInfos"
        @select="onSelectResult"
        @hover="onHoverResult"
      />
    </div>

    <NodeTooltip
      v-if="nodeTooltipState.visible"
      :visible="nodeTooltipState.visible"
      :position="nodeTooltipState.position"
      :node="nodeTooltipState.node"
    />
    <LinkTooltip
      v-if="linkTooltipState.visible"
      :visible="linkTooltipState.visible"
      :position="linkTooltipState.position"
      :link="linkTooltipState.link"
    />
  </div>
</template>
