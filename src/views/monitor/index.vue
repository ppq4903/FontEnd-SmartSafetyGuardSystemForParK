<template>
  <div class="monitor-root" :class="{'is-single': layoutKey==='1x1'}">
    <!-- 左侧：展示与控制 -->
    <aside class="left-panel">
      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel-header">
            <span>展示与控制</span>
            <el-button size="small" @click="loadCameras">刷新</el-button>
          </div>
        </template>

        <!-- 布局选择 -->
        <div class="block">
          <div class="block-title">布局</div>
          <el-radio-group v-model="layoutKey" size="small" @change="onLayoutChange">
            <el-radio :label="'3x5'">3×5展示</el-radio>
            <el-radio :label="'1x1'">1×1展示</el-radio>
            <el-radio :label="'2x2'">2×2展示</el-radio>
            <el-radio :label="'3x3'">3×3展示</el-radio>
          </el-radio-group>
        </div>

        <!-- 双下拉：区域 -> 摄像头 -->
        <div class="block">
          <div class="red-label">请选择园区区域</div>
          <el-select v-model="regionId" placeholder="全部园区" clearable filterable class="w-full" @change="onRegionChange">
            <el-option v-for="opt in regionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>

        <div class="block">
          <div class="red-label">请选择摄像头</div>
          <el-select v-model="cameraIdInRegion" placeholder="可不选（显示该区域全部摄像头）"
                     clearable filterable class="w-full" :disabled="!regionId">
            <el-option
              v-for="c in cameraOptionsInRegion"
              :key="c.camera_id"
              :label="`${c.camera_id} - ${c.camera_name}`"
              :value="c.camera_id"
            />
          </el-select>
        </div>

        <!-- 操作按钮 -->
        <div class="btn-row">
          <el-button size="small" type="primary" @click="startBoundCameras">启动四路绑定检测</el-button>
          <el-button size="small" type="success" :disabled="!selectedCameraIds.length" @click="batchStart">批量启动</el-button>
          <el-button size="small" type="warning" :disabled="!selectedCameraIds.length" @click="batchStop">批量停止</el-button>
        </div>

        <!-- 摄像头列表（隐藏ID列） -->
        <div class="block">
          <div class="block-title">摄像头列表（{{ filteredCameras.length }}）</div>
          <el-table :data="filteredCameras" size="small" stripe height="360px" @row-dblclick="previewRow">
            <!-- 不展示 ID 列 -->
            <el-table-column prop="camera_name" label="名称" min-width="160" />
            <el-table-column prop="camera_status" label="状态" width="160">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.camera_status)">{{ statusMap[row.camera_status] ?? row.camera_status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="analysis_mode" label="模式" width="260">
              <template #default="{ row }">{{ modeMap[(row.analysis_mode ?? 0)] }}</template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row, $index }">
                <el-button size="small" @click="previewCamera(row, $index)">预览</el-button>
                <el-button type="success" size="small" @click="handleStart(row.camera_id)">启动</el-button>
                <el-button type="danger" size="small" @click="handleStop(row.camera_id)">停止</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 多选：批量启停 -->
          <el-select v-model="selectedCameraIds" class="w-full mgt8" multiple collapse-tags placeholder="勾选批量启停（可多选）">
            <el-option v-for="c in filteredCameras" :key="c.camera_id" :label="`${c.camera_id} - ${c.camera_name}`" :value="c.camera_id" />
          </el-select>

          <div class="hint">
            规则：① 两个下拉都不选 → 显示所有摄像头；② 只选区域 → 显示该区域内全部摄像头；③ 两个都选 → 仅显示该摄像头。
          </div>
        </div>
      </el-card>
    </aside>

    <!-- 非 1×1：播放墙 + 分页 -->
    <section v-if="layoutKey!=='1x1'" class="wall">
      <div class="grid" :style="gridStyle">
        <div v-for="(cell, i) in wallCells" :key="i" class="cell">
          <template v-if="cell && cell.camera">
            <template v-if="cell.src">
              <video :ref="el => setVideoRef(el, i)" class="cell-video" :src="cell.src"
                     controls autoplay loop muted playsinline @error="() => onVideoError(i)"></video>
            </template>
            <template v-else>
              <div class="cell-video placeholder">暂无视频源</div>
            </template>

            <div class="cell-info">
              <div class="row1">
                <span class="cam">{{ cell.camera.camera_name || ('摄像头' + cell.camera.camera_id) }}</span>
                <span class="area">检测结果：<b>{{ (cellState[cell.camera.camera_id]?.result) || '正常' }}</b></span>
              </div>
              <div class="row2">
                <span>当前告警：{{ (cellState[cell.camera.camera_id]?.alarm) || '无' }}</span>
                <span v-if="cellState[cell.camera.camera_id]?.time">时间：{{ cellState[cell.camera.camera_id].time }}</span>
              </div>
              <div class="row3" v-if="cellState[cell.camera.camera_id]?.snapshot">
                <img :src="cellState[cell.camera.camera_id].snapshot" class="snapshot" />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="cell-video placeholder">空</div>
          </template>
        </div>
      </div>

      <!-- 播放墙分页 -->
      <div class="wall-pager">
        <button class="pager-btn" @click="wallPrev">&lt;</button>
        <span class="pager-text">{{ wallPage + 1 }} / {{ wallTotalPages }}</span>
        <button class="pager-btn" @click="wallNext">&gt;</button>
      </div>
    </section>

    <!-- 1×1：中间大播放器 + 分页；右侧详情 -->
    <section v-else class="single-center">
      <div class="single-player-wrap">
        <template v-if="activeSingleSrc">
          <video ref="singleVideoRef" class="single-video"
                 :src="activeSingleSrc" controls autoplay loop muted playsinline></video>
        </template>
        <div v-else class="single-video placeholder">该摄像头未绑定</div>

        <div class="single-caption">
          <span>{{ activeSingle?.camera_name || ('摄像头' + (activeSingle?.camera_id ?? '')) }}</span>
          <span>检测结果：<b>{{ (cellState[activeSingle?.camera_id]?.result) || '正常' }}</b></span>
          <span>当前告警：{{ (cellState[activeSingle?.camera_id]?.alarm) || '无' }}</span>
        </div>
      </div>
      <div class="pager">
        <button class="pager-btn" @click="prevSingle">&lt;</button>
        <span class="pager-text">{{ singlePage + 1 }} / {{ singleTotal }}</span>
        <button class="pager-btn" @click="nextSingle">&gt;</button>
      </div>
    </section>

    <aside v-if="layoutKey==='1x1'" class="right-detail">
      <el-card class="panel" shadow="never">
        <template #header>
          <div class="panel-header"><span>详细信息</span></div>
        </template>

        <!-- 摄像头基本信息 -->
        <div class="block">
          <div class="block-title">摄像头信息</div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="名称">{{ activeSingle?.camera_name ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTagType(activeSingle?.camera_status)">{{ statusMap[activeSingle?.camera_status] ?? '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="分析模式">{{ modeMap[(activeSingle?.analysis_mode ?? 0)] }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 告警信息列表 -->
        <div class="block">
          <div class="block-title">告警记录</div>
          <div class="alarm-list" v-if="alarmsByCamera[activeSingle?.camera_id]?.length">
            <div class="alarm-item" v-for="a in alarmsByCamera[activeSingle?.camera_id]" :key="a.id">
              <span class="alarm-dot" :class="a.level"></span>
              <span class="alarm-type">{{ a.type }}</span>
              <span class="alarm-time">{{ a.time }}</span>
              <a v-if="a.snapshot" :href="a.snapshot" target="_blank">查看</a>
            </div>
          </div>
          <div v-else class="empty">暂无告警</div>
        </div>
      </el-card>
    </aside>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCameraList,
  startAnalysis,
  stopAnalysis,
  getBoundVideoUrl,
  getCameraSlots,
  getBoundCameraIds,
  buildTestVideoUrl
} from '@/api/monitor'

/* ======= 映射：状态 / 模式 ======= */
const statusMap = { 0: '离线', 1: '在线（未开启检测）', 2: '在线且安防检测中' }
const statusTagType = (s) => (s === 2 ? 'success' : s === 1 ? 'warning' : 'danger')
const modeMap = {
  0: '无',
  1: '全部（安全规范+区域入侵+火警）',
  2: '安全规范',
  3: '区域入侵',
  4: '火警'
}

/* ======= 左侧：双下拉与摄像头表 ======= */
const cameraList = ref([])
const regionId = ref(null)             // 上：区域
const cameraIdInRegion = ref(null)     // 下：该区域下的摄像头
const selectedCameraIds = ref([])      // 批量启停
const regionOptions = computed(() => {
  const map = new Map()
  for (const c of cameraList.value) {
    const k = c.park_area_id ?? c.parkAreaId ?? c.area_id
    const v = c.park_area_name ?? c.parkAreaName ?? `区域${k ?? '-'}`
    if (k !== undefined && !map.has(k)) map.set(k, v)
  }
  return [{ label: '全部园区', value: null }, ...Array.from(map, ([value, label]) => ({ value, label }))]
})
const cameraOptionsInRegion = computed(() => {
  if (!regionId.value) return []
  return cameraList.value.filter(c => (c.park_area_id ?? c.parkAreaId ?? c.area_id) === regionId.value)
})
const filteredCameras = computed(() => {
  if (!regionId.value && !cameraIdInRegion.value) return cameraList.value
  if (regionId.value && !cameraIdInRegion.value) {
    return cameraList.value.filter(c => (c.park_area_id ?? c.parkAreaId ?? c.area_id) === regionId.value)
  }
  if (regionId.value && cameraIdInRegion.value) {
    return cameraList.value.filter(c => c.camera_id === cameraIdInRegion.value)
  }
  return cameraList.value
})
function onRegionChange () { cameraIdInRegion.value = null }
function previewRow (row) { previewCamera(row) }
function previewCamera (row) {
  layoutKey.value = '1x1'
  const idx = filteredCameras.value.findIndex(c => c.camera_id === row.camera_id)
  if (idx >= 0) { singlePage.value = idx; nextTick(playSingle) }
}

async function loadCameras () {
  try {
    const { rows } = await fetchCameraList({ page_size: 1000 })
    cameraList.value = rows || []
  } catch (e) { console.error(e) }
}

/* ======= 播放墙（非 1×1）+ 分页 ======= */
const layoutKey = ref('2x2') // 默认 2×2
const layoutMap = { '1x1': { rows: 1, cols: 1 }, '2x2': { rows: 2, cols: 2 }, '3x3': { rows: 3, cols: 3 }, '3x5': { rows: 3, cols: 5 } }
const grid = computed(() => layoutMap[layoutKey.value] || layoutMap['2x2'])
const gridStyle = computed(() => ({ display: 'grid', gap: '8px', gridTemplateColumns: `repeat(${grid.value.cols}, 1fr)`, gridTemplateRows: `repeat(${grid.value.rows}, minmax(160px, 1fr))` }))

const wallPage = ref(0)
const wallPageSize = computed(() => grid.value.rows * grid.value.cols)
const wallTotalPages = computed(() => Math.max(1, Math.ceil((filteredCameras.value.length || 0) / wallPageSize.value)))
const wallSlice = computed(() => {
  const start = wallPage.value * wallPageSize.value
  return filteredCameras.value.slice(start, start + wallPageSize.value)
})
const wallCells = computed(() => {
  const cells = Array.from({ length: wallPageSize.value }).map((_, i) => {
    const cam = wallSlice.value[i]
    if (!cam) return null
    const src = getBoundVideoUrl(cam.camera_id) // 仅 1/2/3/4 有 URL，其余为空
    return { camera: cam, src }
  })
  return cells
})
function wallPrev () { wallPage.value = (wallPage.value - 1 + wallTotalPages.value) % wallTotalPages.value; nextTick(initPlayers) }
function wallNext () { wallPage.value = (wallPage.value + 1) % wallTotalPages.value; nextTick(initPlayers) }

const videoRefs = ref([])
const setVideoRef = (el, i) => { videoRefs.value[i] = el }
function initPlayers () {
  nextTick(() => {
    videoRefs.value.forEach((v, i) => {
      const cell = wallCells.value[i]
      if (!v || !cell || !cell.src) return
      v.src = cell.src
      const p = v.play(); if (p && p.catch) p.catch(() => {})
    })
  })
}
function onLayoutChange () {
  videoRefs.value = []
  wallPage.value = 0
  if (layoutKey.value !== '1x1') initPlayers()
}
function onVideoError (i) { ElMessage.error(`第 ${i + 1} 路视频加载失败`) }

/* ======= 1×1：分页 + 详情 ======= */
const singleVideoRef = ref(null)
const singlePage = ref(0)
const singleTotal = computed(() => filteredCameras.value.length || 1)
const activeSingle = computed(() => filteredCameras.value[singlePage.value] || null)
const activeSingleSrc = computed(() => activeSingle.value ? getBoundVideoUrl(activeSingle.value.camera_id) : '')
function playSingle () {
  const v = singleVideoRef.value
  if (!v || !activeSingleSrc.value) return
  v.src = activeSingleSrc.value
  const p = v.play(); if (p && p.catch) p.catch(() => {})
}
function prevSingle () { singlePage.value = (singlePage.value - 1 + singleTotal.value) % singleTotal.value; nextTick(playSingle) }
function nextSingle () { singlePage.value = (singlePage.value + 1) % singleTotal.value; nextTick(playSingle) }

/* ======= 告警推送（WS） ======= */
const cellState = reactive({})          // { [cameraId]: { result, alarm, time, snapshot } }
const alarmsByCamera = reactive({})     // { [cameraId]: [{id,type,time,snapshot,level}] }
const alarmTypeText = ['安全规范', '区域入侵', '火警']
let ws
function connectAlarmWS () {
  const url = import.meta.env.VITE_WS_ALARM_URL || 'ws://localhost:8000/ws/alarms'
  ws = new WebSocket(url)
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      const cid = msg.camera_id
      if (!cellState[cid]) cellState[cid] = {}
      cellState[cid].result = (msg.alarm_status === 0 ? '告警' : '正常')
      cellState[cid].alarm  = (msg.alarm_status === 0 ? (alarmTypeText[msg.alarm_type] || '无') : '无')
      cellState[cid].time   = msg.alarm_time
      const last = (msg.snapshot_url || '').split(',').pop()
      cellState[cid].snapshot = last || null

      if (!alarmsByCamera[cid]) alarmsByCamera[cid] = []
      alarmsByCamera[cid].unshift({
        id: `${cid}-${Date.now()}`,
        type: (alarmTypeText[msg.alarm_type] || '告警'),
        time: msg.alarm_time,
        level: msg.alarm_status === 0 ? 'danger' : 'success',
        snapshot: last || null
      })
      if (alarmsByCamera[cid].length > 50) alarmsByCamera[cid].length = 50
    } catch (e) {}
  }
  ws.onclose = () => setTimeout(connectAlarmWS, 2000)
}

/* ======= 后端启停 ======= */
async function handleStart (cameraId) { try { await startAnalysis(cameraId); ElMessage.success(`摄像头 ${cameraId} 已发送启动指令`) } catch { ElMessage.error('启动失败') } }
async function handleStop (cameraId) { try { await stopAnalysis(cameraId); ElMessage.success(`摄像头 ${cameraId} 已发送停止指令`) } catch { ElMessage.error('停止失败') } }
async function batchStart () { for (const id of selectedCameraIds.value) await handleStart(id) }
async function batchStop () { for (const id of selectedCameraIds.value) await handleStop(id) }
async function startBoundCameras () {
  for (const id of getBoundCameraIds()) await handleStart(id)
  ElMessage.success('已发送启动指令（四路绑定）')
}

onMounted(async () => {
  await loadCameras()
  initPlayers()
  connectAlarmWS()
})

watch(layoutKey, (v) => {
  if (v === '1x1') nextTick(playSingle)
  else nextTick(initPlayers)
})
watch(filteredCameras, () => {
  wallPage.value = 0
  if (layoutKey.value === '1x1') { singlePage.value = 0; nextTick(playSingle) }
  else nextTick(initPlayers)
})
</script>

<style scoped>
/* 根布局：1x1（三列） / 其他（两列） */
.monitor-root {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 14px;
  padding: 12px;
  box-sizing: border-box;
}
.monitor-root.is-single {
  grid-template-columns: 360px 1fr 360px;
}

/* 左侧控制面板 */
.left-panel .panel { height: calc(100vh - 24px); overflow: hidden auto; }
.panel-header { display:flex; justify-content:space-between; align-items:center; }
.block { margin-bottom: 14px; }
.block-title { font-weight: 600; margin-bottom: 8px; }
.red-label { color: #e2574c; font-weight: 600; margin-bottom: 6px; }
.btn-row { display: flex; gap: 8px; margin: 8px 0 0; }
.w-full { width: 100%; }
.mgt8 { margin-top: 8px; }
.hint { margin-top: 8px; color: #909399; font-size: 12px; }

/* 播放墙 */
.wall { background:#0b0b0b; border-radius:12px; padding:10px; }
.grid { width: 100%; height: calc(100vh - 180px); }
.cell { position: relative; }
.cell-video {
  width: 100%; height: 100%; background: #000; border-radius: 8px;
  object-fit: contain; outline: 1px solid rgba(255,255,255,0.08);
  display:flex; align-items:center; justify-content:center; color:#bbb;
}
.cell-video.placeholder { background:#121212; color:#8c8c8c; font-size:14px; }
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

/* 播放墙分页条 */
.wall-pager{ display:flex; justify-content:center; align-items:center; gap:12px; padding:8px 0 0; }
.pager-btn{
  width:44px; height:32px; border-radius:6px; border:1px solid #ddd; background:#fff; cursor:pointer;
}
.pager-text{ color:#666; }

/* 1×1 大屏 + 分页 + 详情 */
.single-center { display:flex; flex-direction:column; gap:8px; }
.single-player-wrap { position:relative; background:#000; border-radius:12px; padding:8px; }
.single-video { width:100%; height: calc(100vh - 220px); object-fit:contain; border-radius:8px; background:#000; display:flex; align-items:center; justify-content:center; color:#8c8c8c; }
.single-video.placeholder { background:#121212; color:#8c8c8c; }
.single-caption{
  position:absolute; left:8px; right:8px; top:8px;
  background: rgba(0,0,0,.35); color:#fff; padding:6px 10px; border-radius:6px;
  display:flex; gap:16px; font-size:13px;
}
.pager{ display:flex; justify-content:center; align-items:center; gap:12px; }
.pager-btn{ width:44px; height:32px; border-radius:6px; border:1px solid #ddd; background:#fff; cursor:pointer; }
.pager-text{ color:#666; }

.right-detail .panel { height: calc(100vh - 24px); overflow: hidden auto; }
.alarm-list { display:flex; flex-direction:column; gap:6px; max-height:380px; overflow:auto; }
.alarm-item{ display:flex; align-items:center; gap:8px; font-size:13px; }
.alarm-dot{ width:6px; height:14px; border-radius:2px; display:inline-block; }
.alarm-dot.danger{ background:#ef4444; }
.alarm-dot.success{ background:#22c55e; }
.empty{ color:#909399; font-size:12px; }
</style>
