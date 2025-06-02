export type IdcNodeType = 'DC' | 'OC' | 'EDGE'

export interface IdcNode {
  id: number
  name: string
  coord: [number, number]
  types: IdcNodeType[] // 支持多种类型
}

export interface IdcNodeInfo extends IdcNode {
  viaLines?: IdcLinkInfo[]
}

export interface IdcLine {
  id: number
  description: string
  source: number
  target: number
  spec?: string // 线的规格
}

export interface IdcLinkInfo {
  id: number
  description: string
  source: IdcNode
  target: IdcNode
  spec?: string
}

// 模拟异步请求获取节点和连线数据
export async function fetchIdcNodesData(): Promise<{ nodes: IdcNode[]; lines: IdcLine[] }> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300))
  const nodes: IdcNode[] = [
    { id: 1, name: '北京', coord: [116.4074, 39.9042], types: ['DC', 'OC'] },
    { id: 2, name: '法兰克福', coord: [8.6821, 50.1109], types: ['DC'] },
    { id: 3, name: '纽约', coord: [-74.006, 40.7128], types: ['OC'] },
    { id: 4, name: '东京', coord: [139.6917, 35.6895], types: ['EDGE'] },
    { id: 5, name: '新加坡', coord: [103.8198, 1.3521], types: ['DC', 'EDGE'] },
    { id: 6, name: '伦敦', coord: [-0.1276, 51.5074], types: ['OC', 'EDGE'] },
    { id: 7, name: '悉尼', coord: [151.2093, -33.8688], types: ['EDGE'] },
    { id: 8, name: '洛杉矶', coord: [-118.2437, 34.0522], types: ['DC', 'OC', 'EDGE'] },
    { id: 9, name: '巴黎', coord: [2.3522, 48.8566], types: ['DC'] },
    { id: 10, name: '迪拜', coord: [55.2708, 25.2048], types: ['OC', 'EDGE'] },
  ]
  const lines: IdcLine[] = [
    { id: 1, source: 1, target: 2, description: '北京-法兰克福', spec: '100G' },
    { id: 2, source: 2, target: 3, description: '法兰克福-纽约', spec: '10G' },
    { id: 3, source: 1, target: 3, description: '北京-纽约', spec: '40G' },
    { id: 4, source: 1, target: 4, description: '北京-东京', spec: '10G' },
    { id: 5, source: 4, target: 5, description: '东京-新加坡', spec: '10G' },
    { id: 6, source: 5, target: 6, description: '新加坡-伦敦', spec: '100G' },
    { id: 7, source: 6, target: 7, description: '伦敦-悉尼', spec: '10G' },
    { id: 8, source: 7, target: 8, description: '悉尼-洛杉矶', spec: '40G' },
    { id: 9, source: 8, target: 9, description: '洛杉矶-巴黎', spec: '10G' },
    { id: 10, source: 9, target: 10, description: '巴黎-迪拜', spec: '10G' },
    { id: 11, source: 10, target: 1, description: '迪拜-北京', spec: '100G' },
    { id: 12, source: 2, target: 6, description: '法兰克福-伦敦', spec: '40G' },
    { id: 13, source: 3, target: 8, description: '纽约-洛杉矶', spec: '10G' },
    { id: 14, source: 4, target: 9, description: '东京-巴黎', spec: '10G' },
    { id: 15, source: 5, target: 10, description: '新加坡-迪拜', spec: '10G' },
  ]
  return { nodes, lines }
}
