<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { _GlobeView, Deck } from '@deck.gl/core'
import {
  ScatterplotLayer,
  ArcLayer,
  TextLayer,
  GeoJsonLayer,
  SolidPolygonLayer,
  PolygonLayer,
} from '@deck.gl/layers'
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
import worldGeojson from '@/assets/custom.geo.json'
const focusedCountry = ref(null)
const searchText = ref('')
const searchResults = ref<
  { type: 'node' | 'link'; key: string; label: string; node?: IdcNode; link?: IdcLinkInfo }[]
>([])

async function onSelectResult(item: { type: 'node' | 'link'; node?: IdcNode; link?: IdcLinkInfo }) {
  searchResults.value = []
  searchText.value = ''
  if (item.type === 'node' && item.node) {
    hoverType.value = 'node'
    hoverNodeId.value = item.node.id
    nodeTooltipState.visible = true
    nodeTooltipState.position = { x: 0, y: 0 }
    nodeTooltipState.node = {
      ...item.node,
      viaLines: idcLinkMap.value[item.node.id] || [],
    }
    await nextTick()
    flyToCoord(item.node.coord)
    updateLayers(true)
  } else if (item.type === 'link' && item.link) {
    hoverType.value = 'link'
    hoverNodeId.value = null
    linkTooltipState.visible = true
    linkTooltipState.position = { x: 0, y: 0 }
    linkTooltipState.link = item.link
    await nextTick()
    // 计算中点
    const lng = (item.link.source.coord[0] + item.link.target.coord[0]) / 2
    const lat = (item.link.source.coord[1] + item.link.target.coord[1]) / 2
    flyToCoord([lng, lat])
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
    updateLayers(true)
  } else if (item.type === 'link' && item.link) {
    hoverType.value = 'link'
    hoverNodeId.value = null
    linkTooltipState.visible = true
    linkTooltipState.position = { x: 0, y: 0 }
    linkTooltipState.link = item.link
    updateLayers(false)
  } else {
    hoverType.value = null
    hoverNodeId.value = null
    nodeTooltipState.visible = false
    nodeTooltipState.node = null
    linkTooltipState.visible = false
    linkTooltipState.link = null
    updateLayers(false)
  }
}

const mapContainer = ref<HTMLDivElement | null>(null)
let deck: Deck | null = null

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
    const t = pulseT % 1
    pulse.value = 1 - Math.pow(1 - t, 2)
    pulseT += 0.02
    updateLayers(true)
    pulseTimer = requestAnimationFrame(animate)
  }
  animate()
}
onUnmounted(() => {
  if (pulseTimer) cancelAnimationFrame(pulseTimer)
})

const oceanLayer = new SolidPolygonLayer({
  id: 'ocean',
  data: [
    [
      [-180, -90],
      [-180, 90],
      [180, 90],
      [180, -90],
    ],
  ],
  getPolygon: (d) => d,
  getFillColor: [180, 210, 235, 255], // 你喜欢的海洋色
  stroked: false,
  filled: true,
  pickable: false,
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

// GlobeView flyTo
function flyToCoord(coord: [number, number]) {
  if (deck) {
    deck.setProps({
      viewState: {
        ...deck.viewState,
        longitude: coord[0],
        latitude: coord[1],
        transitionDuration: 800,
        transitionInterpolator: { interpolateProps: ['longitude', 'latitude', 'zoom'] },
        zoom: 3,
      },
    })
  }
}

const buildLayers = (nodes: IdcNode[], links: IdcLinkInfo[]) => {
  // 蒙层：高亮当前国家，其它区域半透明
  const maskLayer = focusedCountry.value
    ? new GeoJsonLayer({
        id: 'country-mask',
        data: worldGeojson as any,
        stroked: false,
        filled: true,
        getFillColor: (f) =>
          f.properties?.name === focusedCountry.value.properties?.name
            ? [255, 255, 0, 80] // 高亮色
            : [0, 0, 0, 180], // 其它区域半透明
        pickable: false,
        updateTriggers: {
          getFillColor: [focusedCountry.value],
        },
      })
    : null

  // 修改 geoLayer，添加 onDoubleClick
  const geoLayer = new GeoJsonLayer({
    id: 'geojson-world',
    data: worldGeojson as any,
    stroked: true,
    filled: true,
    getFillColor: [240, 240, 240, 255],
    getLineColor: [120, 120, 120, 180],
    getLineWidth: 1,
    pickable: true,
    lineWidthMinPixels: 1,
    onDoubleClick: (info) => {
      console.log('双击选中国家:', info.object?.properties?.name)
      if (info.object) {
        focusedCountry.value = info.object
        // 输出国家名
        console.log('国家名称:', info.object.properties?.name)
        // 计算国家中心
        const coords = info.object.properties?.centroid || getFeatureCenter(info.object)
        if (coords && deck) {
          deck.setProps({
            viewState: {
              ...deck.viewState,
              longitude: coords[0],
              latitude: coords[1],
              zoom: 5,
              transitionDuration: 1000,
            },
          })
        }
        updateLayers()
      }
    },
  })

  const arc = new ArcLayer({
    id: 'idc-arc',
    data: links,
    greatCircle: true,
    numSegments: 100,
    getSourcePosition: (d) => d.source.coord,
    getTargetPosition: (d) => d.target.coord,
    getWidth: (d) => (linkTooltipState.link && d.id === linkTooltipState.link.id ? 4 : 1),
    getSourceColor: (d) =>
      linkTooltipState.link && d.id === linkTooltipState.link.id
        ? [249, 205, 23, 250]
        : [15, 129, 135],
    getTargetColor: (d) =>
      linkTooltipState.link && d.id === linkTooltipState.link.id
        ? [249, 205, 23, 250]
        : [59, 30, 177],
    getHeight: 0.5,
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
        nodeTooltipState.position = { x: info.x ?? 0, y: (info.y ?? 0) - 80 }
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
    getSize: 16,
    getTextAnchor: 'middle',
    characterSet: 'auto',
    billboard: false,
    getAngle: -180,
    parameters: {
      cullMode: 'front',
    },
  })

  return [
    oceanLayer,
    maskLayer,
    geoLayer,
    arc,
    idcNodesScatter,
    idctNodesOutlineScatter,
    idcNodesText,
  ].filter(Boolean)
}

// 计算 GeoJSON Feature 的中心点
function getFeatureCenter(feature: any): [number, number] {
  // 这里只做简单处理，建议用 turf.js 的 centroid 更精确
  const coords = feature.geometry.coordinates.flat(Infinity)
  let lng = 0,
    lat = 0
  for (let i = 0; i < coords.length; i += 2) {
    lng += coords[i]
    lat += coords[i + 1]
  }
  const n = coords.length / 2
  return [lng / n, lat / n]
}

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

  if (deck) {
    deck.setProps({ layers: buildLayers(nodesData, linksData) })
  }
}

onMounted(async () => {
  const ret = await fetchIdcNodesData()
  idcNodes.value = ret.nodes
  idcLines.value = ret.lines

  deck = new Deck({
    parent: mapContainer.value as HTMLDivElement,
    views: [
      new _GlobeView({
        id: 'main',
        controller: true,
        resolution: 1,
      }),
    ],
    initialViewState: {
      latitude: 37.8,
      longitude: -100.45,
      zoom: 4,
    },
    controller: true,
    layers: buildLayers(idcNodes.value, linkInfos.value),
  })

  startPulse()
})
</script>

<template>
  <div class="flex items-center w-full h-screen p-5">
    <div ref="mapContainer" class="w-full h-[calc(80vh)] relative">
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
