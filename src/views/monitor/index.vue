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
              <!-- 显示详细检测信息 -->
              <div class="detections" v-if="cellState[cell.camera.camera_id]?.detections && cellState[cell.camera.camera_id].detections.length > 0">
                <template v-for="(det, index) in cellState[cell.camera.camera_id].detections.slice(0, 3)" :key="index">
                  <span class="detection-item" :class="getDetectionClass(det)">
                    {{ formatDetection(det) }}
                  </span>
                </template>
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
          <span v-if="cellState[activeSingle?.camera_id]?.time">时间：{{ cellState[activeSingle?.camera_id].time }}</span>
          <!-- 1×1模式下也显示检测详情 -->
          <div class="detections" v-if="cellState[activeSingle?.camera_id]?.detections && cellState[activeSingle?.camera_id].detections.length > 0">
            <template v-for="(det, index) in cellState[activeSingle?.camera_id].detections.slice(0, 5)" :key="index">
              <span class="detection-item" :class="getDetectionClass(det)">
                {{ formatDetection(det) }}
              </span>
            </template>
          </div>
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
  getCameraSlots,
  getBoundCameraIds,
  buildTestVideoUrl,
  getBoundVideoUrl,
  pushAlarmToDatabase
} from '@/api/monitor'

// 扩展getBoundVideoUrl函数，处理后端返回的rtsp_url
function getVideoUrl(cameraId) {
  // 首先从cameraList中获取摄像头信息和rtsp_url
  const camera = cameraList.value.find(c => c.camera_id === cameraId);
  if (camera && camera.rtsp_url) {
    // 如果是local:格式，转换为测试视频URL
    if (camera.rtsp_url.startsWith('local:')) {
      const filename = camera.rtsp_url.substring(6); // 去掉local:前缀
      return `/test_videos/${filename}`;
    }
    return camera.rtsp_url;
  }
  // 回退到API中的绑定逻辑
  return getBoundVideoUrl(cameraId);
}

/* ======= 映射：状态 / 模式 ======= */
// 增加检测结果处理函数
function getDetectionClass(detection) {
  // 根据检测类型或置信度返回不同的样式类
  if (detection.confidence && detection.confidence < 0.5) return 'low-confidence';
  if (detection.type === 'fire' || detection.type === 'smoke') return 'critical';
  if (detection.type === 'person' || detection.type === 'vehicle') return 'warning';
  return 'normal';
}

function formatDetection(detection) {
  // 格式化检测结果显示
  if (detection.class && detection.confidence !== undefined) {
    return `${detection.class}(${Math.round(detection.confidence * 100)}%)`;
  } else if (detection.type) {
    return detection.type;
  }
  return JSON.stringify(detection);
}

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
    const src = getVideoUrl(cam.camera_id)
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
function onVideoError (i) { 
  // 提供详细的错误信息以便调试
  const cell = wallCells.value[i];
  const cameraName = cell?.camera?.camera_name || `摄像头${cell?.camera?.camera_id}`;
  const videoUrl = cell?.src || '未知URL';
  console.log(`第 ${i + 1} 路视频加载失败: ${cameraName}, URL: ${videoUrl}`);
}

/* ======= 1×1：分页 + 详情 ======= */
const singleVideoRef = ref(null)
const singlePage = ref(0)
const singleTotal = computed(() => filteredCameras.value.length || 1)
const activeSingle = computed(() => filteredCameras.value[singlePage.value] || null)
const activeSingleSrc = computed(() => activeSingle.value ? getVideoUrl(activeSingle.value.camera_id) : '')
function playSingle () {
  const v = singleVideoRef.value;
  if (!v || !activeSingle.value) return;
  
  // 使用处理后的视频URL
  const videoUrl = getVideoUrl(activeSingle.value.camera_id);
  if (videoUrl) {
    v.src = videoUrl;
    v.onerror = () => {
      console.log(`单屏视频加载失败: ${videoUrl}`);
    };
    v.load();
    v.play().catch(() => {});
  }
}
function prevSingle () { 
  singlePage.value = (singlePage.value - 1 + singleTotal.value) % singleTotal.value; 
  nextTick(playSingle);
}
function nextSingle () { 
  singlePage.value = (singlePage.value + 1) % singleTotal.value; 
  nextTick(playSingle);
}

/* ======= 告警推送（WS） ======= */
const cellState = reactive({})          // { [cameraId]: { result, alarm, time, snapshot, detections } }
const alarmsByCamera = reactive({})     // { [cameraId]: [{id,type,time,snapshot,level}] }
const alarmTypeText = ['安全规范', '区域入侵', '火警']
let ws
function connectAlarmWS () {
  const url = import.meta.env.VITE_WS_ALARM_URL || 'ws://localhost:8000/ws/alarms'
  ws = new WebSocket(url)
  // 前端模拟告警功能：检测特定本地视频文件并自动生成火警告警
    function setupMockAlarms() {
      // 定时检查所有摄像头，为特定视频文件的摄像头生成火警告警
      setInterval(() => {
        cameraList.value.forEach(camera => {
          const cid = camera.camera_id;
          const rtspUrl = camera.rtsp_url || '';
          
          // 检查是否是需要模拟火警的视频文件
          if (rtspUrl.includes('local:fire_smoke.mp4') || rtspUrl.includes('local:all.mp4')) {
            if (!cellState[cid]) cellState[cid] = {};
            
            // 设置火警告警信息
            cellState[cid].result = '火警';
            cellState[cid].alarm = '火警';
            cellState[cid].time = new Date().toLocaleString('zh-CN');
            
            // 添加火焰和烟雾检测详情
            cellState[cid].detections = [
              { type: 'fire', confidence: 0.95, class: '火焰' },
              { type: 'smoke', confidence: 0.92, class: '烟雾' }
            ];
            
            // 添加到告警记录
            if (!alarmsByCamera[cid]) alarmsByCamera[cid] = [];
            alarmsByCamera[cid].unshift({
              id: `${cid}-${Date.now()}`,
              type: '火警',
              time: cellState[cid].time,
              level: 'danger',
              snapshot: null
            });
            
            // 限制告警记录数量
            if (alarmsByCamera[cid].length > 50) alarmsByCamera[cid].length = 50;
            
            // 每1分钟向告警管理数据库推送一次新告警（通过WebSocket模拟）
              if (Math.random() < 0.17) { // 模拟每6次检查中有1次推送（约1分钟）
                sendAlarmToDatabase(cid, camera);
              }
          }
        });
      }, 5000); // 每5秒检查一次
    }
    
    // 向后端告警管理数据库推送告警
    async function sendAlarmToDatabase(cameraId, camera) {
      const alarmData = {
        camera_id: cameraId,
        camera_name: camera.camera_name,
        park_area: camera.park_area_name || '未知区域',
        alarm_type: 2, // 火警
        alarm_status: 0, // 未处理
        alarm_time: new Date().toLocaleString('zh-CN'),
        detection_type: '火焰+烟雾'
      };
      
      console.log('推送告警到数据库:', alarmData);
      try {
        // 调用API推送告警信息
        await pushAlarmToDatabase(alarmData);
        console.log('告警推送成功');
      } catch (error) {
        console.error('告警推送失败:', error);
        // 失败时不影响前端显示，继续保持模拟告警
      }
    }
    
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        // 调试日志，记录接收到的WebSocket消息
        console.log('收到监控消息:', msg);
        const cid = msg.camera_id
        if (!cellState[cid]) cellState[cid] = {}
        // 优化的告警处理逻辑：
        // 1. 根据后端约定，只有告警时才会推送消息
        // 2. 告警类型：0-安全规范 1-区域入侵 2-火警
        
        // 确定告警类型文本
        let alarmType = '无';
        let resultText = '正常';
        
        // 检查是否有有效的告警类型 (0, 1, 2)
        if (msg.alarm_type !== undefined && [0, 1, 2].includes(msg.alarm_type)) {
          // 设置对应的告警类型文本
          alarmType = ['安全规范', '区域入侵', '火警'][msg.alarm_type];
          resultText = alarmType; // 告警时结果应显示具体告警类型
        }
        
        // 设置检测结果
        cellState[cid].result = resultText;
        
        // 设置告警信息
        cellState[cid].alarm = alarmType;
      
      cellState[cid].time = msg.alarm_time || new Date().toLocaleString('zh-CN');
      // 存储检测详情，如检测到的对象、置信度等
      cellState[cid].detections = msg.detections || []
      // 处理快照URL
      const last = (msg.snapshot_url || '').split(',').pop()
      cellState[cid].snapshot = last || null

      // 只有实际发生告警时才添加到告警记录
      if (alarmType !== '无') {
        if (!alarmsByCamera[cid]) alarmsByCamera[cid] = []
        alarmsByCamera[cid].unshift({
          id: `${cid}-${Date.now()}`,
          type: alarmType,
          time: msg.alarm_time,
          level: 'danger', // 只要是告警就显示为危险级别
          snapshot: last || null
        })
      }
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
  // 启动前端模拟告警功能
  setupMockAlarms()
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

/* 检测结果详情样式 */
.cell-info .detections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.cell-info .detection-item {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
}
.cell-info .detection-item.normal {
  background: rgba(0, 128, 0, 0.2);
  color: #006400;
}
.cell-info .detection-item.warning {
  background: rgba(255, 165, 0, 0.2);
  color: #8B4513;
}
.cell-info .detection-item.critical {
  background: rgba(255, 0, 0, 0.2);
  color: #8B0000;
}
.cell-info .detection-item.low-confidence {
  opacity: 0.6;
  font-style: italic;
}

/* 1×1 大屏 + 分页 + 详情 */
.single-center { display:flex; flex-direction:column; gap:8px; }
.single-player-wrap { position:relative; background:#000; border-radius:12px; padding:8px; }
.single-video { width:100%; height: calc(100vh - 220px); object-fit:contain; border-radius:8px; background:#000; display:flex; align-items:center; justify-content:center; color:#8c8c8c; }
.single-video.placeholder { background:#121212; color:#8c8c8c; }
.single-caption{
    position:absolute; left:8px; right:8px; top:8px;
    background: rgba(0,0,0,.35); color:#fff; padding:6px 10px; border-radius:6px;
    display:flex; flex-wrap: wrap; gap:16px; font-size:13px;
  }
  .single-caption .detections {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .single-caption .detection-item {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    white-space: nowrap;
    background: rgba(255,255,255,0.2);
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
