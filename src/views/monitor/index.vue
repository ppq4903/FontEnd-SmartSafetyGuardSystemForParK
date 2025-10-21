<template>
  <div class="monitor-layout">
    <!-- 左：2×2 播放墙（默认） -->
    <section class="wall">
      <div class="grid" :style="gridStyle">
        <div v-for="(slot, i) in cameraSlots" :key="slot.cameraId" class="cell">
          <video
            :ref="el => setVideoRef(el, i)"
            class="cell-video"
            :src="slot.src"
            controls
            autoplay
            loop
            muted
            playsinline
            @error="() => onVideoError(i)"
          ></video>

          <!-- 信息条（第二章风格） -->
          <div class="cell-info">
            <div class="row1">
              <span class="cam">摄像头{{ slot.cameraId }}（{{ cameraNameMap[slot.cameraId] || '-' }}）</span>
              <span class="area">检测结果：<b>{{ (cellState[slot.cameraId]?.result) || '正常' }}</b></span>
            </div>
            <div class="row2">
              <span>当前告警：{{ (cellState[slot.cameraId]?.alarm) || '无' }}</span>
              <span v-if="cellState[slot.cameraId]?.time">时间：{{ cellState[slot.cameraId].time }}</span>
            </div>
            <div class="row3" v-if="cellState[slot.cameraId]?.snapshot">
              <img :src="cellState[slot.cameraId].snapshot" class="snapshot" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 右：控制面板 -->
    <aside class="side">
      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel-header">
            <span>展示与控制</span>
            <el-button size="small" @click="loadCameras">刷新</el-button>
          </div>
        </template>

        <div class="block">
          <div class="block-title">布局</div>
          <el-radio-group v-model="layoutKey" size="small" @change="onLayoutChange">
            <el-radio :label="'1x1'">1×1展示</el-radio>
            <el-radio :label="'2x2'">2×2展示</el-radio>
            <el-radio :label="'3x3'">3×3展示</el-radio>
            <el-radio :label="'3x5'">3×5展示</el-radio>
          </el-radio-group>
        </div>

        <div class="block">
          <div class="red-label">请选择园区区域</div>
          <el-select
            v-model="filters.park_area_id"
            placeholder="全部园区"
            clearable
            filterable
            class="w-full"
            @change="loadCameras"
          >
            <el-option v-for="a in parkAreas" :key="a.value" :label="a.label" :value="a.value" />
          </el-select>
        </div>

        <div class="block">
          <div class="red-label">请选择摄像头</div>
          <el-select
            v-model="selectedCameraIds"
            placeholder="可多选，用于启动/停止检测"
            multiple
            clearable
            filterable
            class="w-full"
          >
            <el-option
              v-for="c in cameraList"
              :key="c.camera_id"
              :label="`${c.camera_id} - ${c.camera_name}`"
              :value="c.camera_id"
            />
          </el-select>
          <div class="btn-row">
            <el-button size="small" type="primary" @click="startShownCameras">启动当前四路检测</el-button>
            <el-button size="small" type="success" :disabled="!selectedCameraIds.length" @click="batchStart">启动</el-button>
            <el-button size="small" type="warning" :disabled="!selectedCameraIds.length" @click="batchStop">停止</el-button>
          </div>
        </div>

        <el-divider />

        <div class="block">
          <div class="block-title">摄像头列表（{{ cameraList.length }}）</div>
          <el-table :data="cameraList" size="small" stripe height="420px">
            <el-table-column prop="camera_id" label="ID" width="80" />
            <el-table-column prop="camera_name" label="名称" min-width="160" />
            <!-- 状态：0-离线，1-在线（未开启），2-在线且检测中 -->
            <el-table-column prop="camera_status" label="状态" width="160">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.camera_status)">
                  {{ statusMap[row.camera_status] ?? row.camera_status }}
                </el-tag>
              </template>
            </el-table-column>
            <!-- 模式：0-无，1-全部，2-安全规范，3-区域入侵，4-火警 -->
            <el-table-column prop="analysis_mode" label="模式" width="280">
              <template #default="{ row }">
                {{ modeMap[(row.analysis_mode ?? 0)] }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="handleStart(row.camera_id)">启动</el-button>
                <el-button type="danger" size="small" @click="handleStop(row.camera_id)">停止</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="hint">提示：播放与检测互不影响；播放是本地测试视频循环，检测由后端对对应摄像头做实时/离线分析。</div>
        </div>
      </el-card>
    </aside>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCameraList,
  startAnalysis,
  stopAnalysis,
  getCameraSlots
} from '@/api/monitor'

/** ----------- 播放墙：绑定四个摄像头 + 四个测试视频 ----------- */
const cameraSlots = ref(getCameraSlots())   // [{cameraId, file, src}]
const layoutKey = ref('2x2')                // 默认 2×2
const layoutMap = {
  '1x1': { rows: 1, cols: 1 },
  '2x2': { rows: 2, cols: 2 },
  '3x3': { rows: 3, cols: 3 },
  '3x5': { rows: 3, cols: 5 }
}
const grid = computed(() => layoutMap[layoutKey.value] || layoutMap['2x2'])
const gridStyle = computed(() => ({
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: `repeat(${grid.value.cols}, 1fr)`,
  gridTemplateRows: `repeat(${grid.value.rows}, minmax(160px, 1fr))`
}))

// 多视频 ref 数组
const videoRefs = ref([])
const setVideoRef = (el, i) => { videoRefs.value[i] = el }

// 初始化/重放
function initPlayers () {
  nextTick(() => {
    videoRefs.value.forEach((v, i) => {
      if (!v) return
      v.src = cameraSlots.value[i]?.src
      const p = v.play()
      if (p && p.catch) p.catch(() => {})
    })
  })
}
function onLayoutChange () {
  videoRefs.value = []
  initPlayers()
}
function onVideoError (i) {
  ElMessage.error(`第 ${i + 1} 路视频加载失败`)
}

/** ----------- 映射：状态&模式（表格显示） ----------- */
const statusMap = { 0: '离线', 1: '在线（未开启检测）', 2: '在线且安防检测中' }
const statusTagType = (s) => (s === 2 ? 'success' : s === 1 ? 'warning' : 'danger')
const modeMap = {
  0: '无',
  1: '全部（安全规范+区域入侵+火警）',
  2: '安全规范',
  3: '区域入侵',
  4: '火警'
}

/** ----------- 右侧：摄像头与控制 ----------- */
const cameraList = ref([])
const cameraNameMap = computed(() => {
  const m = {}
  for (const c of cameraList.value) m[c.camera_id] = c.camera_name
  return m
})
const selectedCameraIds = ref([])
const parkAreas = ref([
  { label: '全部园区', value: '' },
  { label: '园区A', value: 'A' },
  { label: '园区B', value: 'B' }
])
const filters = reactive({ park_area_id: '' })

async function loadCameras () {
  try {
    const { rows } = await fetchCameraList({ page_size: 1000, park_area_id: filters.park_area_id })
    cameraList.value = rows || []
  } catch (e) {
    console.error(e)
  }
}

async function handleStart (cameraId) {
  try {
    await startAnalysis(cameraId)
    ElMessage.success(`摄像头 ${cameraId} 已发送启动指令`)
  } catch (e) {
    ElMessage.error('启动失败')
  }
}
async function handleStop (cameraId) {
  try {
    await stopAnalysis(cameraId)
    ElMessage.success(`摄像头 ${cameraId} 已发送停止指令`)
  } catch (e) {
    ElMessage.error('停止失败')
  }
}
async function batchStart () { for (const id of selectedCameraIds.value) await handleStart(id) }
async function batchStop () { for (const id of selectedCameraIds.value) await handleStop(id) }

// 启动当前四路（与上面四格绑定的摄像头）
async function startShownCameras () {
  for (const s of cameraSlots.value) await handleStart(s.cameraId)
  ElMessage.success('已发送启动指令（四路）')
}

/** ----------- WebSocket：接收告警并更新单元信息 ----------- */
const cellState = reactive({}) // { [cameraId]: { result, alarm, time, snapshot } }
const alarmTypeText = ['安全规范', '区域入侵', '火警']
let ws
function connectAlarmWS () {
  const url = import.meta.env.VITE_WS_ALARM_URL || 'ws://localhost:8000/ws/alarms'
  ws = new WebSocket(url)
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      const cid = msg.camera_id
      if (!cameraSlots.value.some(s => s.cameraId === cid)) return
      if (!cellState[cid]) cellState[cid] = {}

      cellState[cid].result   = (msg.alarm_status === 0 ? '告警' : '正常')
      cellState[cid].alarm    = (msg.alarm_status === 0 ? (alarmTypeText[msg.alarm_type] || '无') : '无')
      cellState[cid].time     = msg.alarm_time
      const last = (msg.snapshot_url || '').split(',').pop()
      cellState[cid].snapshot = last || null
    } catch (e) {}
  }
  ws.onclose = () => setTimeout(connectAlarmWS, 2000)
}

onMounted(async () => {
  await loadCameras()
  initPlayers()
  connectAlarmWS()
})
</script>

<style scoped>
.monitor-layout {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 14px;
  padding: 12px;
  box-sizing: border-box;
}
.wall {
  background: #0b0b0b;
  border-radius: 12px;
  padding: 10px;
}
.grid {
  width: 100%;
  height: calc(100vh - 140px);
}
.cell { position: relative; }
.cell-video {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  object-fit: contain;
  outline: 1px solid rgba(255,255,255,0.08);
}
.cell-info{
  position:absolute; left:0; right:0; bottom:0;
  background: rgba(255, 192, 203, .85);
  color:#333; padding:6px 8px; font-size:12px;
}
.cell-info .row1{ display:flex; justify-content:space-between; margin-bottom:2px; }
.cell-info .cam{ font-weight:600; }
.cell-info b{ color:#c00; }
.cell-info .row2{ display:flex; gap:12px; }
.snapshot{ margin-top:4px; max-height:80px; border-radius:4px; background:#fff; }

.side .panel {
  height: calc(100vh - 24px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.block { margin-bottom: 14px; }
.block-title { font-weight: 600; margin-bottom: 8px; }
.red-label { color: #e2574c; font-weight: 600; margin-bottom: 6px; }
.btn-row { display: flex; gap: 8px; margin-top: 8px; }
.w-full { width: 100%; }
.hint { margin-top: 8px; color: #909399; font-size: 12px; }
</style>
