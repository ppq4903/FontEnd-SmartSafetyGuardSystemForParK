<template>
  <el-container class="monitor-page">
    <!-- 将左侧分区树改为默认折叠；主操作移到顶部两个下拉 -->
    <el-aside :width="sidebarCollapsed ? '0' : '320px'" class="sidebar" v-show="!sidebarCollapsed">
      <div class="sidebar-header">
        <el-input
          v-model="searchKeyword"
          :prefix-icon="Search"
          placeholder="搜索摄像头名称…"
          size="small"
          clearable
          @input="onSearch"
        />
      </div>

      <el-scrollbar class="area-scroll">
        <el-collapse v-model="openedAreaNames" accordion>
          <el-collapse-item
            v-for="group in groupedAreas"
            :key="group.area || '__none__'"
            :name="group.area || '__none__'"
          >
            <template #title>
              <div class="area-title">
                <span class="area-name">{{ group.area || '未分区' }}</span>
                <el-tag size="small" type="info">{{ group.cameras.length }} 路</el-tag>
              </div>
            </template>

            <div class="camera-list">
              <div
                v-for="cam in group.cameras"
                :key="cam.cameraId"
                class="camera-item"
                :class="{ active: cam.cameraId === activeCameraId, offline: cam.cameraStatus !== 1, alarmed: runtimeAlarmed(cam.cameraId) }"
                @click="handleSelectCamera(cam)"
              >
                <div class="ci-left">
                  <el-tag size="small" :type="cam.cameraStatus === 1 ? 'success' : 'info'">
                    {{ cam.cameraStatus === 1 ? '在线' : '离线' }}
                  </el-tag>
                  <span class="ci-name">{{ cam.cameraName || ('摄像头 ' + cam.cameraId) }}</span>
                </div>
                <div class="ci-right">
                  <el-tag type="warning" v-if="runtimeAlarmed(cam.cameraId)" size="small">告警</el-tag>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </el-aside>

    <!-- 右侧：工具栏 + 网格播放器 -->
    <el-container>
      <el-header class="toolbar">
        <div class="toolbar-left">
          <el-button size="small" :icon="FullScreen" @click="sidebarCollapsed = !sidebarCollapsed">
            {{ sidebarCollapsed ? '展开左栏' : '收起左栏' }}
          </el-button>
          <!-- 新增：上/下两个下拉框，分别选择 园区区域 与 摄像头 -->
          <el-select
            v-model="selectedArea"
            placeholder="请选择园区区域"
            clearable
            filterable
            size="small"
            class="mr-2"
            @change="onAreaOrCameraChanged"
          >
            <el-option :label="'全部园区'" :value="null" />
            <el-option
              v-for="a in areaOptions"
              :key="a.value"
              :label="a.label"
              :value="a.value"
            />
          </el-select>

          <el-select
            v-model="selectedCamera"
            placeholder="请选择摄像头"
            clearable
            filterable
            size="small"
            class="mr-4"
            :disabled="cameraOptions.length === 0 && !selectedArea"
            @change="onAreaOrCameraChanged"
          >
            <el-option :label="'全部摄像头'" :value="null" />
            <el-option
              v-for="c in cameraOptions"
              :key="c.value"
              :label="c.label"
              :value="c.value"
            />
          </el-select>

          <!-- 分屏：3×5 / 1×1 / 2×2 / 3×3 -->
          <el-radio-group v-model="gridMode" size="small" @change="applyGridMode">
            <el-radio-button :label="15">3×5展示</el-radio-button>
            <el-radio-button :label="1">1×1展示</el-radio-button>
            <el-radio-button :label="4">2×2展示</el-radio-button>
            <el-radio-button :label="9">3×3展示</el-radio-button>
          </el-radio-group>
        </div>

        <div class="toolbar-center">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="园区">{{ currentTileCamera?.parkArea || '—' }}</el-descriptions-item>
            <el-descriptions-item label="摄像头">{{ currentTileCamera?.cameraName || currentTileCamera?.cameraId || '—' }}</el-descriptions-item>
            <el-descriptions-item label="检测">{{ analysisModeText(currentTileCamera?.analysisMode) }}</el-descriptions-item>
            <el-descriptions-item label="分辨率">{{ currentTileCamera?.resolution || '—' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="toolbar-right">
          <el-button
            size="small"
            :icon="playing ? VideoPause : VideoPlay"
            @click="togglePlayPause"
          >{{ playing ? '暂停' : '播放' }}</el-button>

          <el-button
            size="small"
            :icon="PictureFilled"
            :disabled="!tiles[activeTileIndex]?.camera || !tiles[activeTileIndex]?.playing"
            @click="snapshotTile(activeTileIndex)"
          >截图下载</el-button>
        </div>
      </el-header>

      <el-main>
        <div class="grid" :style="gridStyle">
          <el-card
            v-for="(tile, idx) in tiles"
            :key="tile.id"
            shadow="hover"
            class="tile"
            :class="{ active: idx === activeTileIndex }"
            @click="activeTileIndex = idx"
          >
            <template #header>
              <div class="tile-header">
                <div class="title-left">
                  <el-tag size="small" type="info">通道{{ idx + 1 }}</el-tag>
                  <span class="name">{{ tile.camera?.cameraName || '未选择摄像头' }}</span>
                </div>
                <div class="title-right">
                  <el-button text size="small" :icon="Refresh" @click.stop="refreshTile(idx)" />
                  <el-button text size="small" :icon="VideoPlay" v-if="!tile.playing" @click.stop="playTile(idx)" />
                  <el-button text size="small" :icon="VideoPause" v-else @click.stop="pauseTile(idx)" />
                </div>
              </div>
            </template>

            <div class="player">
              <!-- 这里仍采用拉帧图片显示；实际项目可替换为 HLS.js / FLV.js。 -->
              <img
                v-if="tile.camera && tile.playing"
                class="video"
                :src="frameUrl(tile)"
                :alt="tile.camera?.cameraName"
                :ref="el => setTileImgRef(idx, el)"
                @error="onImgError(idx)"
              />
              <div v-else class="placeholder">已暂停</div>

              <!-- 识别叠加（若有） -->
              <svg class="overlay" preserveAspectRatio="none" v-if="tile.camera">
                <template v-for="(box, bidx) in (cameraRuntime[tile.cameraId]?.boxes || [])" :key="bidx">
                  <rect
                    :x="box.x * 100 + '%'"
                    :y="box.y * 100 + '%'"
                    :width="box.w * 100 + '%'"
                    :height="box.h * 100 + '%'"
                    class="bbox"
                  />
                  <text
                    :x="(box.x + 0.002) * 100 + '%'"
                    :y="(box.y + 0.015) * 100 + '%'"
                    class="label"
                  >
                    {{ box.label }} {{ (box.score * 100).toFixed(0) }}%
                  </text>
                </template>
              </svg>
            </div>

            <div class="statusbar">
              <div>
                当前识别：
                <el-tag
                  size="small"
                  :type="cameraRuntime[tile.cameraId]?.alarmed ? 'danger' : 'success'"
                >
                  {{ cameraRuntime[tile.cameraId]?.alarmed ? '告警' : '正常' }}
                </el-tag>
                <template v-if="cameraRuntime[tile.cameraId]?.alarmed">
                  <el-tag size="small" type="danger" class="ml-1" :icon="WarningFilled">
                    {{ cameraRuntime[tile.cameraId]?.alarmType || '异常' }}
                  </el-tag>
                </template>
              </div>
              <div class="muted">最近刷新：{{ formatTs(tile.ts) }}</div>
            </div>
          </el-card>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { onMounted, onBeforeUnmount, reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchCameraList,
  fetchFramePing,
  requestSnapshot,
  startAnalysis,
  stopAnalysis
} from '@/api/monitor'
import { buildWs } from '@/utils/ws'
import { ElNotification, ElMessage } from 'element-plus'
import {
  Search,
  VideoPlay,
  VideoPause,
  PictureFilled,
  FullScreen,
  WarningFilled,
  Refresh
} from '@element-plus/icons-vue'

const router = useRouter()

/** 左侧是否折叠（按截图，将左栏功能弱化，默认折叠） */
const sidebarCollapsed = ref(true)

/** 全量摄像头（后端 /camera_infos/search 返回的 rows） */
const cameras = ref([]) // 数组：[{ cameraId, cameraName, parkArea, ... }]

/** 搜索关键字（仅用于左侧折叠面板时） */
const searchKeyword = ref('')

/** 园区 -> 摄像头 分组（供左侧折叠树显示） */
const groupedAreas = computed(() => {
  const list = cameras.value
  const groups = {}
  list.forEach(c => {
    const k = c.parkArea || '__none__'
    groups[k] = groups[k] || []
    groups[k].push(c)
  })
  return Object.keys(groups).map(k => ({ area: k === '__none__' ? '' : k, cameras: groups[k] }))
})
const openedAreaNames = ref([])

/** 分屏模式：3×5 / 1×1 / 2×2 / 3×3（默认 3×5） */
const gridMode = ref(15)

/** 网格与 tile 状态 */
const tiles = ref([])
const activeTileIndex = ref(0)
const playing = ref(true)
const tileImgRefs = ref([]) // img DOM refs

/** 运行时识别状态（由后端 WebSocket 推送） */
const cameraRuntime = reactive({})
const runtimeAlarmed = (cameraId) => !!cameraRuntime[cameraId]?.alarmed

/** 当前激活 tile 的摄像头 */
const currentTileCamera = computed(() => tiles.value[activeTileIndex.value]?.camera)

/** 顶部两个下拉：选中的园区与摄像头 */
const selectedArea = ref(null)    // string | null
const selectedCamera = ref(null)  // number|string | null

/** 下拉可选项（根据 cameras 动态生成） */
const areaOptions = computed(() => {
  const set = new Set()
  cameras.value.forEach(c => set.add(c.parkArea || '未分区'))
  return Array.from(set).map(a => ({ label: a, value: a === '未分区' ? '' : a }))
})
const cameraOptions = computed(() => {
  const list = cameras.value.filter(c => {
    if (selectedArea.value === null) return true
    const a = c.parkArea || ''
    return a === (selectedArea.value || '')
  })
  return list.map(c => ({ label: c.cameraName || `摄像头 ${c.cameraId}`, value: c.cameraId }))
})

/** 初始化 tiles */
function initTiles (n) {
  const prev = tiles.value
  tiles.value = Array.from({ length: n }).map((_, i) => ({
    id: i,
    cameraId: prev?.[i]?.cameraId,
    camera: prev?.[i]?.camera,
    playing: true,
    ts: Date.now()
  }))
  activeTileIndex.value = 0
}

/** 应用分屏模式 */
function applyGridMode () {
  initTiles(gridMode.value)
  // 分屏变化后，按当前下拉选择重新布置
  fillTilesBySelector()
}

/** 网格样式 */
const gridStyle = computed(() => {
  const g = gridMode.value
  let cols = 3
  if (g === 1) cols = 1
  else if (g === 4) cols = 2
  else if (g === 9) cols = 3
  else if (g === 12) cols = 4
  else if (g === 15) cols = 5
  return { gridTemplateColumns: `repeat(${cols}, 1fr)` }
})

/** 监听两个下拉的变更 */
function onAreaOrCameraChanged () {
  // 规则：
  // 1) 两个都是默认值(null)：展示所有摄像头
  // 2) 只选园区：展示该园区所有摄像头
  // 3) 两个都选：只展示该摄像头，并自动切到 1×1
  if (selectedArea.value !== null && selectedCamera.value !== null) {
    if (gridMode.value !== 1) {
      gridMode.value = 1
      initTiles(1)
    }
  }
  fillTilesBySelector()
}

/** 根据选择把摄像头填充到 tiles */
function fillTilesBySelector () {
  let list = cameras.value.slice()
  if (selectedArea.value !== null) {
    const area = selectedArea.value || ''
    list = list.filter(c => (c.parkArea || '') === area)
  }
  if (selectedCamera.value !== null) {
    list = list.filter(c => String(c.cameraId) === String(selectedCamera.value))
  }

  // 把列表依次放入 tiles（不够填则清空）
  for (let i = 0; i < tiles.value.length; i++) {
    const cam = list[i]
    if (cam) {
      tiles.value[i].cameraId = cam.cameraId
      tiles.value[i].camera = cam
      tiles.value[i].ts = Date.now()
    } else {
      tiles.value[i].cameraId = undefined
      tiles.value[i].camera = undefined
    }
  }
}

/** 页面加载：取摄像头、默认分屏与 WS */
onMounted(async () => {
  const res = await fetchCameraList()
  // 兼容 {rows,total} 或纯数组
  cameras.value = Array.isArray(res) ? res : (res.rows || [])
  openedAreaNames.value = Array.from(new Set(cameras.value.map(c => c.parkArea || '__none__')))

  // 默认 3×5，随后根据选择填充
  applyGridMode()
  fillTilesBySelector()

  const { close } = buildWs('/ws/recognition', {
    // 兼容不同部署路径（不强制 api/v1）
    fallbacks: ['/api/ws/recognition', '/api/v1/ws/recognition'],
    onMessage: (payload) => onRecognition(payload)
  })
  wsClose = close
})

onBeforeUnmount(() => {
  wsClose && wsClose()
})

/** WebSocket 推送的识别结果 */
function onRecognition (msg) {
  const { cameraId, runtime } = msg || {}
  if (!cameraId) return
  cameraRuntime[cameraId] = runtime || {}
  if (runtime?.alarmed) {
    ElNotification({
      title: '警告',
      message: `${msg.area || ''} - 摄像头 ${cameraId} 识别到 ${runtime.alarmType || '异常'}`,
      type: 'warning',
      duration: 3000
    })
  }
}

/** 播放控制（全局/单格） */
function togglePlayPause () {
  const t = tiles.value[activeTileIndex.value]
  if (!t) return
  t.playing = !t.playing
  playing.value = t.playing
}
function playTile (idx) {
  tiles.value[idx].playing = true
  if (idx === activeTileIndex.value) playing.value = true
}
function pauseTile (idx) {
  tiles.value[idx].playing = false
  if (idx === activeTileIndex.value) playing.value = false
}
function refreshTile (idx) {
  const t = tiles.value[idx]
  if (!t?.cameraId) return
  t.ts = Date.now()
}

/** 生成帧地址（示例：后端提供 mjpeg / http 图片帧） */
function frameUrl (tile) {
  if (!tile?.cameraId) return ''
  // 约定：服务端以时间戳避免缓存，如 /camera_infos/{id}/frame?ts=xxx
  return `/camera_infos/${tile.cameraId}/frame?ts=${tile.ts || Date.now()}`
}
function onImgError (idx) {
  // 简单重试
  setTimeout(() => refreshTile(idx), 1500)
}

/** 截图下载：从 img 画到 canvas，再触发下载 */
function setTileImgRef (idx, el) {
  tileImgRefs.value[idx] = el
}
async function snapshotTile (idx) {
  const img = tileImgRefs.value[idx]
  const t = tiles.value[idx]
  if (!img || !t?.camera) return

  try {
    const canvas = document.createElement('canvas')
    // 如果后端提供了分辨率字段，可按分辨率绘制；否则用当前 DOM 尺寸
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    // 叠加识别框（与前端显示保持一致，坐标为 0~1）
    const boxes = (cameraRuntime[t.cameraId]?.boxes || [])
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(245,108,108,0.95)'
    ctx.fillStyle = 'rgba(245,108,108,0.95)'
    ctx.font = '12px sans-serif'
    ctx.textBaseline = 'top'
    boxes.forEach(b => {
      const x = b.x * w
      const y = b.y * h
      const bw = b.w * w
      const bh = b.h * h
      ctx.strokeRect(x, y, bw, bh)
      const label = `${b.label} ${(b.score * 100).toFixed(0)}%`
      ctx.fillText(label, x + 2, y + 2)
    })

    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    const area = t.camera?.parkArea || 'area'
    const name = t.camera?.cameraName || `camera_${t.cameraId}`
    a.download = `${area}_${name}_${Date.now()}.png`
    a.href = url
    a.click()
    a.remove()
  } catch (e) {
    ElMessage.error('截图失败：可能是跨域（需服务端允许图片跨域访问）')
  }
}

/** 其它工具 */
function analysisModeText (mode) {
  if (mode === 1) return '实时'
  if (mode === 2) return '定时'
  return '—'
}
function formatTs (ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

let wsClose = null

/** 左侧搜索（可选） */
function onSearch () {
  // 如需要可在 fetchCameraList 加上 name 过滤，这里简化为前端过滤
  // 左栏仅作浏览，不影响顶部下拉逻辑
}

/** 用户从左侧选择某摄像头（可选入口） */
const activeCameraId = ref(null)
function handleSelectCamera (cam) {
  if (!cam) return
  activeCameraId.value = cam.cameraId
  // 同步顶部下拉
  selectedArea.value = cam.parkArea || ''
  selectedCamera.value = cam.cameraId
  onAreaOrCameraChanged()
}
</script>

<style scoped>
.monitor-page {
  height: 100%;
}

/* 侧栏 */
.sidebar { border-right: 1px solid var(--el-border-color); }
.sidebar-header { padding: 8px; display: flex; align-items: center; }
.area-scroll { height: calc(100% - 48px); }
.area-title { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.camera-list { padding: 8px; display: grid; gap: 8px; }
.camera-item { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; background: var(--el-fill-color-blank); }
.camera-item.active { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-7) inset; }
.camera-item.offline { opacity: .6; }
.camera-item.alarmed { border-color: var(--el-color-danger); }
.ci-left { display: flex; align-items: center; gap: 8px; }
.ci-name { font-weight: 600; }
.ci-right { display: flex; align-items: center; }

/* 工具栏 */
.toolbar {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 10px;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color);
  padding: 8px 12px;
}
.toolbar-left { display: flex; align-items: center; }
.toolbar-center :deep(.el-descriptions) { width: 100%; }
.toolbar-right { display: flex; gap: 8px; align-items: center; }

/* 网格与播放器 */
.grid {
  display: grid;
  gap: 10px;
  padding: 10px;
}
.tile { height: 260px; display: flex; flex-direction: column; }
.tile.active { box-shadow: 0 0 0 2px var(--el-color-primary) inset; }
.tile-header { display: flex; align-items: center; justify-content: space-between; }
.title-left { display: flex; align-items: center; gap: 8px; }
.title-right { display: flex; align-items: center; gap: 4px; }

.player { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; background: #000; }
.video { width: 100%; height: 100%; object-fit: contain; background: #000; }
.placeholder { color: #aaa; }

.overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.bbox { fill: transparent; stroke: rgba(245,108,108,.95); stroke-width: 2; }
.label { font-size: 12px; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,.6); stroke-width: 2; }

/* 底部状态 */
.statusbar {
  display: flex; align-items: center; justify-content: space-between;
  border-top: 1px solid var(--el-border-color);
  padding-top: 8px; margin-top: 8px;
}
.muted { color: var(--el-text-color-secondary); }

.mr-2 { margin-right: 8px; }
.mr-4 { margin-right: 16px; }
.ml-1 { margin-left: 4px; } .ml-2 { margin-left: 8px; }
</style>
