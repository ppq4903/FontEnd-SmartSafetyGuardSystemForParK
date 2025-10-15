<template>
  <el-container class="monitor-page">
    <!-- 左侧：摄像头分区列表 -->
    <el-aside :width="sidebarCollapsed ? '64px' : '320px'" class="sidebar">
      <div class="sidebar-header" :class="{ collapsed: sidebarCollapsed }">
        <el-input
          v-model="searchKeyword"
          :prefix-icon="Search"
          placeholder="搜索摄像头名称…"
          size="small"
          clearable
          @input="onSearch"
          :disabled="sidebarCollapsed"
        />
        <el-button
          class="ml-2"
          size="small"
          :icon="sidebarCollapsed ? Expand : Fold"
          @click="sidebarCollapsed = !sidebarCollapsed"
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

            <div>
              <div
                v-for="cam in group.cameras"
                :key="cam.cameraId"
                class="camera-item"
                :class="{
                  active: activeCameraId === cam.cameraId,
                  offline: cam.cameraStatus !== 1,
                  alarmed: !!cameraRuntime[cam.cameraId]?.alarmed
                }"
                @click="handleSelectCamera(cam)"
                :title="`单击 1*1 播放：${cam.cameraName}`"
              >
                <div class="ci-left">
                  <el-badge
                    :is-dot="cam.cameraStatus === 1"
                    :type="cam.cameraStatus === 1 ? 'success' : 'info'"
                  >
                    <span class="ci-name">{{ cam.cameraName }}</span>
                  </el-badge>
                </div>
                <div class="ci-right">
                  <el-tag size="small" :type="cam.analysisMode === 1 ? 'success' : 'warning'">
                    {{ analysisModeText(cam.analysisMode) }}
                  </el-tag>
                  <el-tag size="small" class="ml-1" :type="cam.cameraStatus === 1 ? 'success' : 'info'">
                    {{ cam.cameraStatus === 1 ? '在线' : '离线' }}
                  </el-tag>
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
          <el-radio-group v-model="gridMode" size="small" @change="applyGridMode">
            <el-radio-button :label="1">1 路</el-radio-button>
            <el-radio-button :label="4">4 路</el-radio-button>
            <el-radio-button :label="9">9 路</el-radio-button>
            <el-radio-button :label="12">12 路</el-radio-button>
          </el-radio-group>
        </div>

        <div class="toolbar-center" v-if="currentTileCamera">
          <el-descriptions :column="3" size="small" border>
            <el-descriptions-item label="名称">
              <b>{{ currentTileCamera.cameraName }}</b>
            </el-descriptions-item>
            <el-descriptions-item label="位置">
              {{ currentTileCamera.parkArea || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="分辨率">
              {{ currentTileCamera.resolution || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="toolbar-right">
          <el-button
            size="small"
            :icon="playing ? VideoPause : VideoPlay"
            @click="togglePlayPause"
          >{{ playing ? '暂停' : '播放' }}</el-button>

          <el-tooltip content="后端未提供截图接口" placement="bottom">
            <span>
              <el-button
                size="small"
                :icon="PictureFilled"
                :disabled="true"
                @click="handleSnapshot"
              >截图</el-button>
            </span>
          </el-tooltip>
        </div>
      </el-header>

      <el-main class="main">
        <div class="video-grid" :style="gridStyle">
          <el-card
            v-for="(tile, idx) in tiles"
            :key="tile.id"
            shadow="hover"
            class="tile"
            :class="{ active: activeTileIndex === idx, flashing: cameraRuntime[tile.cameraId]?.alarmed }"
            @click="activeTileIndex = idx"
          >
            <template #header>
              <div class="tile-header">
                <div class="tile-title">
                  <b>{{ tile.camera?.cameraName || '未选择' }}</b>
                  <span class="muted">· {{ tile.camera?.parkArea || '—' }}</span>
                </div>
                <div class="tile-actions">
                  <el-button
                    text size="small"
                    :icon="tile.playing ? VideoPause : VideoPlay"
                    @click.stop="toggleTilePlay(idx)"
                    :title="tile.playing ? '暂停' : '播放'"
                  />
                  <el-button
                    text size="small"
                    :icon="PictureFilled"
                    @click.stop="snapshotTile(idx)"
                    title="截图"
                    :disabled="true"
                  />
                  <el-button
                    text size="small"
                    :icon="FullScreen"
                    @click.stop="maximizeTile(idx)"
                    title="放大展示"
                  />
                </div>
              </div>
            </template>

            <div class="player">
              <div class="video-wrap">
                <img
                  v-if="tile.camera && tile.playing"
                  class="video"
                  :src="frameUrl(tile)"
                  :alt="tile.camera?.cameraName"
                  @error="onImgError(idx)"
                />
                <div v-else class="placeholder">已暂停</div>

                <!-- 识别叠加 -->
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
                    {{ cameraRuntime[tile.cameraId]?.alarmType || '—' }}
                  </el-tag>
                  <span class="muted ml-1">{{ formatTs(cameraRuntime[tile.cameraId]?.alarmTime) }}</span>
                </template>
              </div>
              <el-link type="primary" @click.stop="goAlarmDetail(tile.cameraId)">查看告警详情</el-link>
            </div>
          </el-card>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { onMounted, onBeforeUnmount, reactive, ref, computed } from 'vue'
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
  Fold,
  Expand,
  VideoPlay,
  VideoPause,
  PictureFilled,
  FullScreen,
  WarningFilled
} from '@element-plus/icons-vue'

const router = useRouter()

/** 左侧：折叠与搜索 */
const sidebarCollapsed = ref(false)
const searchKeyword = ref('')

/** 摄像头列表与分组 */
const cameras = ref([])
const openedAreaNames = ref([])

const groupedAreas = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  const list = cameras.value.filter(c => (c.cameraName || '').toLowerCase().includes(kw))
  const map = new Map()
  list.forEach((c) => {
    const k = c.parkArea
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(c)
  })
  return Array.from(map.entries()).map(([area, arr]) => ({ area, cameras: arr }))
})

function onSearch () {
  openedAreaNames.value = groupedAreas.value.map(g => g.area || '__none__')
}

/** 网格与 tile 管理 */
const gridMode = ref(1)
const tiles = ref([])
const activeTileIndex = ref(0)
const activeCameraId = ref(null)

const gridStyle = computed(() => {
  const g = gridMode.value
  let cols = 1
  if (g === 4) cols = 2
  else if (g === 9) cols = 3
  else if (g === 12) cols = 4
  return { gridTemplateColumns: `repeat(${cols}, 1fr)` }
})

/** 页面级播放状态（跟随激活 tile） */
const playing = ref(true)

/** 运行时识别状态（由 WS 推送） */
const cameraRuntime = reactive({})

/** 当前激活 tile 的摄像头 */
const currentTileCamera = computed(() => tiles.value[activeTileIndex.value]?.camera)

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
}

/** 选择摄像头：单画面直切，多画面填当前激活格；联动启动分析 */
async function handleSelectCamera (cam) {
  const now = Date.now()
  activeCameraId.value = cam.cameraId

  if (gridMode.value === 1) {
    tiles.value[0].cameraId = cam.cameraId
    tiles.value[0].camera = cam
    tiles.value[0].ts = now
    activeTileIndex.value = 0
  } else {
    const t = tiles.value[activeTileIndex.value]
    t.cameraId = cam.cameraId
    t.camera = cam
    t.ts = now
  }

  const name = cam.parkArea || '__none__'
  if (!openedAreaNames.value.includes(name)) openedAreaNames.value.push(name)

  // 启动该摄像头的分析（若后端按需生效）
  try { await startAnalysis(cam.cameraId) } catch (e) { /* 忽略启动失败 */ }
}

/** tile 控制（联动 start/stop） */
async function toggleTilePlay (idx) {
  const t = tiles.value[idx]
  t.playing = !t.playing
  if (t.cameraId) {
    try {
      if (t.playing) await startAnalysis(t.cameraId)
      else await stopAnalysis(t.cameraId)
    } catch (e) { /* 忽略 */ }
  }
  if (idx === activeTileIndex.value) playing.value = t.playing
}
function maximizeTile (idx) {
  const t = tiles.value[idx]
  gridMode.value = 1
  applyGridMode()
  if (t.camera) {
    tiles.value[0].camera = t.camera
    tiles.value[0].cameraId = t.camera.cameraId
  }
}
async function snapshotTile (idx) {
  const id = tiles.value[idx].cameraId
  if (!id) return
  await handleSnapshot(id)
}
function onImgError (idx) {
  const id = tiles.value[idx].cameraId
  if (id) fetchFramePing(id).catch(() => {})
}

/** 顶部播放/暂停（联动 start/stop） */
async function togglePlayPause () {
  const t = tiles.value[activeTileIndex.value]
  if (!t) return
  t.playing = !t.playing
  if (t.cameraId) {
    try {
      if (t.playing) await startAnalysis(t.cameraId)
      else await stopAnalysis(t.cameraId)
    } catch (e) { /* 忽略 */ }
  }
  playing.value = t.playing
}

/** 截图（当前仅提示） */
async function handleSnapshot (camId) {
  const id = camId ?? currentTileCamera.value?.cameraId
  if (!id) return
  try {
    const file = await requestSnapshot(id)
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot_cam_${id}_${Date.now()}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.warning('后端暂未提供截图接口')
  }
}

/** 帧地址：优先后端下发的 mjpegUrl；否则走占位路径（不触发 Axios 404 弹窗） */
function frameUrl (tile) {
  const cam = tile.camera
  if (!cam) return ''
  const base = cam.mjpegUrl || `/streams/${cam.cameraId}/mjpeg`
  return `${base}?ts=${tile.ts}`
}

/** WS 消息处理 */
function onRecognition (msg) {
  const r = cameraRuntime[msg.cameraId] || {}
  r.alarmed = msg.status === 'alarm'
  r.alarmType = msg.alarmType
  r.alarmTime = msg.timestamp
  r.boxes = msg.boxes || []
  cameraRuntime[msg.cameraId] = r

  if (r.alarmed) {
    ElNotification({
      title: '警告',
      message: `${msg.area || ''} - 摄像头 ${msg.cameraId} 识别到 ${r.alarmType || '异常'}`,
      type: 'warning',
      duration: 3000
    })
  }
}

/** 跳转告警详情 */
function goAlarmDetail (cameraId) {
  const id = cameraId ?? currentTileCamera.value?.cameraId
  if (!id) return
  router.push({ name: 'alarm-detail', query: { cameraId: String(id) } })
}

/** 工具 */
function formatTs (ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function analysisModeText (mode) {
  if (mode === 1) return '实时'
  if (mode === 2) return '定时'
  return '—'
}

/** 生命周期 */
let wsCleanup = null

onMounted(async () => {
  // 1) 摄像头列表
  const res = await fetchCameraList()
  cameras.value = res
  openedAreaNames.value = Array.from(new Set(res.map(c => c.parkArea || '__none__')))

  // 2) 初始化 1 路 + 默认填充一个摄像头
  applyGridMode()
  if (res.length > 0) handleSelectCamera(res[0])

  // 3) WebSocket 订阅（主路径 + 兜底）
  const { close } = buildWs('/ws/recognition', {
    fallbacks: ['/api/ws/recognition', '/api/v1/ws/recognition'],
    onMessage: (payload) => onRecognition(payload)
  })
  wsCleanup = close

  // 4) 1Hz 刷新（保证“1 秒内切换”体验与心跳）
  const timer = setInterval(() => {
    tiles.value.forEach(t => {
      if (t.playing && t.cameraId) t.ts = Date.now()
    })
  }, 1000)
  onBeforeUnmount(() => clearInterval(timer))
})

onBeforeUnmount(() => {
  if (wsCleanup) wsCleanup()
})
</script>

<style scoped>
.monitor-page { height: 100%; background: var(--el-bg-color-page); }

/* Sidebar */
.sidebar { border-right: 1px solid var(--el-border-color); padding: 10px; }
.sidebar-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.sidebar-header.collapsed :deep(.el-input) { visibility: hidden; width: 0; }
.area-scroll { height: calc(100% - 44px); }
.area-title { display: flex; align-items: center; justify-content: space-between; width: 100%; }

.camera-item {
  display: flex; align-items: center; justify-content: space-between;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 8px 10px; margin: 8px 0; cursor: pointer;
  transition: border-color .15s, box-shadow .15s, background-color .15s;
  background: var(--el-fill-color-blank);
}
.camera-item.active { border-color: var(--el-color-primary); box-shadow: 0 0 0 2px var(--el-color-primary-light-7) inset; }
.camera-item.offline { opacity: .6; }
.camera-item.alarmed { border-color: var(--el-color-danger); }
.ci-left { display: flex; align-items: center; gap: 8px; }
.ci-name { font-weight: 600; }
.ci-right { display: flex; align-items: center; }

/* Toolbar */
.toolbar {
  display: grid; grid-template-columns: 1fr 2fr auto;
  gap: 10px; align-items: center;
  border-bottom: 1px solid var(--el-border-color); padding: 8px 12px;
}
.toolbar-center :deep(.el-descriptions) { width: 100%; }

/* Main grid */
.main { padding: 12px; }
.video-grid { display: grid; gap: 12px; }
.tile { position: relative; }
.tile.active { box-shadow: 0 0 0 2px var(--el-color-primary) inset; }
.tile.flashing { animation: flash 1s infinite; }
@keyframes flash { 50% { box-shadow: 0 0 0 3px rgba(245,108,108,.35) inset; } }

.tile-header { display: flex; align-items: center; justify-content: space-between; }
.tile-title .muted { color: var(--el-text-color-secondary); margin-left: 6px; }

.player { position: relative; min-height: 140px; }
.video-wrap { position: relative; width: 100%; height: 100%; }
.video { width: 100%; height: 100%; object-fit: cover; display: block; }
.placeholder { display: grid; place-items: center; color: var(--el-text-color-secondary); height: 180px; }

.overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.bbox { fill: transparent; stroke: rgba(245,108,108,.95); stroke-width: 2; }
.label { font-size: 12px; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,.6); stroke-width: 2; }

/* Status bar */
.statusbar {
  display: flex; align-items: center; justify-content: space-between;
  border-top: 1px solid var(--el-border-color);
  padding-top: 8px; margin-top: 8px;
}
.muted { color: var(--el-text-color-secondary); }
.ml-1 { margin-left: 4px; } .ml-2 { margin-left: 8px; }
</style>
