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
                <span class="area">检测结果：<b>{{ cellState[cell.camera.camera_id]?.result || '-' }}</b></span>
              </div>
              <div class="row2">
                <span>当前告警：{{ cellState[cell.camera.camera_id]?.alarm || '无' }}</span>
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
          <span>检测结果：<b>{{ cellState[activeSingle?.camera_id]?.result || '-' }}</b></span>
          <span>当前告警：{{ cellState[activeSingle?.camera_id]?.alarm || '无' }}</span>
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
  getBoundVideoUrl
} from '@/api/monitor'

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
// 监听摄像头选择变化
watch(cameraIdInRegion, () => {
  if (layoutKey.value === '1x1') {
    singlePage.value = 0;
    nextTick(playSingle);
  } else {
    wallPage.value = 0;
    nextTick(initPlayers);
  }
})
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
function onRegionChange () { 
  cameraIdInRegion.value = null;
  // 确保筛选逻辑正确应用
  if (layoutKey.value === '1x1') {
    singlePage.value = 0;
    nextTick(playSingle);
  } else {
    wallPage.value = 0;
    nextTick(initPlayers);
  }
}
function previewRow (row) { previewCamera(row) }
function previewCamera (row) {
  layoutKey.value = '1x1';
  const idx = filteredCameras.value.findIndex(c => c.camera_id === row.camera_id);
  if (idx >= 0) {
    singlePage.value = idx;
    nextTick(() => {
      playSingle();
      // 确保1x1模式下正确显示视频
      console.log('预览摄像头:', row.camera_name, '索引:', idx);
    });
  }
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
    const src = getBoundVideoUrl(cam.camera_id)
    console.log('Wall cell video URL:', cam.camera_name, 'URL:', src)
    return { camera: cam, src }
  })
  return cells
})
function wallPrev () { wallPage.value = (wallPage.value - 1 + wallTotalPages.value) % wallTotalPages.value; nextTick(initPlayers) }
function wallNext () { wallPage.value = (wallPage.value + 1) % wallTotalPages.value; nextTick(initPlayers) }

const videoRefs = ref([])
const setVideoRef = (el, i) => { videoRefs.value[i] = el }
function initPlayers() {
  console.log('初始化播放器，当前布局:', layoutKey.value);
  nextTick(() => {
    videoRefs.value.forEach((v, i) => {
      const cell = wallCells.value[i];
      if (!v || !cell || !cell.camera) {
        console.log('跳过无效播放器:', i);
        return;
      }
      // 确保src已设置
      if (!cell.src) {
        console.warn('缺少视频源:', cell.camera.camera_name);
        return;
      }
      // 重新设置src确保更新
      v.src = '';
      v.src = cell.src;
      console.log('设置播放器:', i, cell.camera.camera_name, cell.src);
      v.load();
      v.play().catch((e) => {
        console.log('播放器播放异常:', i, e);
      });
    });
  });
}
function onLayoutChange() {
  videoRefs.value = [];
  wallPage.value = 0;
  // 确保切换布局时正确初始化
  if (layoutKey.value !== '1x1') {
    nextTick(() => {
      initPlayers();
      console.log('切换布局:', layoutKey.value);
    });
  } else {
    // 确保在切换到1x1模式时正确播放
    nextTick(playSingle);
  }
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
const activeSingleSrc = computed(() => activeSingle.value ? getBoundVideoUrl(activeSingle.value.camera_id) : '')
function playSingle () {
  const v = singleVideoRef.value;
  if (!v || !activeSingle.value) return;
  // 直接使用activeSingleSrc计算属性的值，避免重复调用getBoundVideoUrl
  v.src = activeSingleSrc.value;
  v.load();
  v.play().catch((e) => {
    console.log('视频播放异常:', e);
  });
  // 确保在1x1模式下正确显示
  console.log('播放单个视频:', activeSingle.value.camera_name, 'URL:', v.src);
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
let heartbeatInterval
let reconnectTimer
let wsConnectionState = false

function connectAlarmWS () {
  // 确保在重新连接前清理旧连接
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // 清除之前的定时器
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // 使用后端提供的WebSocket URL
  const url = import.meta.env.VITE_WS_ALARM_URL || 'ws://127.0.0.1:8089/api/v1/safety_analysis/ws';
  
  console.log('尝试连接WebSocket:', url);
  
  try {
    ws = new WebSocket(url);
    wsConnectionState = false;
    
    ws.onopen = () => {
      console.log('告警WebSocket连接已建立');
      wsConnectionState = true;
      
      // 发送订阅消息，确保接收所有摄像头的告警
      if (cameraList.value.length > 0) {
        const cameraIds = cameraList.value.map(cam => cam.camera_id);
        sendSubscribeMessage(cameraIds);
      }
      
      // 启动心跳检测
      startHeartbeat();
    };
    
    ws.onmessage = (ev) => {
      try {
        // 记录接收到的原始消息
        console.log('收到WebSocket消息:', ev.data);
        
        const msg = JSON.parse(ev.data);
        
        // 处理心跳响应
        if (msg.type === 'pong' || msg.type === 'heartbeat_response') {
          console.log('收到心跳响应');
          return;
        }
        
        // 处理告警和检测结果
        processAlarmMessage(msg);
      } catch (e) {
        console.error('解析WebSocket消息失败', e);
        console.error('原始消息:', ev.data);
      }
    };
    
    ws.onerror = (e) => {
      console.error('WebSocket连接错误', e);
      wsConnectionState = false;
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket连接已关闭:', event.code, event.reason);
      wsConnectionState = false;
      
      // 清除心跳定时器
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // 实现带指数退避的重连策略
      scheduleReconnect();
    };
  } catch (error) {
    console.error('创建WebSocket连接失败:', error);
    wsConnectionState = false;
    scheduleReconnect();
  }
}

// 发送订阅消息
function sendSubscribeMessage(cameraIds) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const subscribeMsg = {
      type: 'subscribe',
      data: { camera_ids: cameraIds }
    };
    ws.send(JSON.stringify(subscribeMsg));
    console.log('发送摄像头订阅消息:', cameraIds);
  }
}

// 启动心跳检测
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
        console.log('发送心跳消息');
      } catch (error) {
        console.error('发送心跳消息失败:', error);
        // 心跳发送失败，触发重连
        if (ws) {
          ws.close();
        }
      }
    }
  }, 20000); // 每20秒发送一次心跳，更频繁以确保连接活跃
}

// 安排重连
let reconnectAttempts = 0;
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  // 指数退避重连策略
  reconnectAttempts++;
  const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts - 1));
  
  console.log(`将在 ${delay}ms 后进行第 ${reconnectAttempts} 次重连`);
  
  reconnectTimer = setTimeout(() => {
    connectAlarmWS();
  }, delay);
}

// 处理告警消息
function processAlarmMessage(msg) {
  // 支持多种消息格式，确保兼容性
  const cid = msg.camera_id || msg.cameraId || msg.id;
  
  // 确保camera_id存在
  if (!cid) {
    console.warn('接收到的消息缺少camera_id字段:', msg);
    return;
  }
  
  // 确保cellState[cid]存在
  if (!cellState[cid]) {
    cellState[cid] = {
      result: '正常',
      alarm: '无',
      time: '',
      snapshot: null,
      detections: [],
      lastUpdate: Date.now(),
      analysisStatus: 'unknown'
    };
  }
  
  const currentTime = new Date().toLocaleString('zh-CN');
  const previousAlarm = cellState[cid].alarm;
  const previousResult = cellState[cid].result;
  
  // 更新最后更新时间
  cellState[cid].lastUpdate = Date.now();
  cellState[cid].time = currentTime;
  
  // 更全面地处理检测结果 - 支持多种消息格式
  let hasAbnormal = false;
  let detectionObjects = [];
  
  // 1. 处理detections字段
  if (msg.detections && Array.isArray(msg.detections) && msg.detections.length > 0) {
    detectionObjects = msg.detections;
    hasAbnormal = msg.detections.some(det => {
      const isAbnormal = det.class && det.class.toLowerCase() !== 'normal';
      const hasConfidence = det.confidence !== undefined && det.confidence > 0.5;
      return isAbnormal && hasConfidence;
    });
  }
  
  // 2. 处理model_result中的detections
  if (msg.model_result && msg.model_result.detections && Array.isArray(msg.model_result.detections)) {
    detectionObjects = msg.model_result.detections;
    hasAbnormal = msg.model_result.detections.some(det => {
      const isAbnormal = det.class && det.class.toLowerCase() !== 'normal';
      const hasConfidence = det.confidence !== undefined && det.confidence > 0.5;
      return isAbnormal && hasConfidence;
    });
  }
  
  // 3. 处理直接的结果字段
  const directResult = msg.result || msg.detection_result || msg.analysis_result;
  
  // 处理告警类型和状态
  let alarmType = '无';
  let alarmLevel = 'danger';
  
  // 检查多种可能的告警字段
  const possibleAlarmTypes = [
    msg.alarm_type, 
    msg.alarmType, 
    msg.type, // 有时候消息类型直接表示告警类型
    msg.alarm_level, 
    msg.alarm_level_text
  ];
  
  for (const field of possibleAlarmTypes) {
    if (field !== undefined && field !== null && field !== '无' && field !== '') {
      alarmType = field;
      break;
    }
  }
  
  // 检查显式的告警标志
  let hasAlarmFlag = msg.is_alarm === true || msg.has_alarm === true || msg.isAlarm === true;
  if (hasAlarmFlag) {
    alarmType = alarmType === '无' ? '检测到异常' : alarmType;
  }
  
  // 确定最终结果
  let finalResult = '正常';
  if (directResult === '异常' || hasAbnormal || alarmType !== '无' || hasAlarmFlag) {
    // 当有告警记录、告警标志或检测到异常时，结果应设为异常
    finalResult = '异常';
  } else if (directResult) {
    finalResult = directResult;
  }

  // 更新检测结果
  cellState[cid].result = finalResult;

  // 更新检测详情
  if (detectionObjects.length > 0) {
    cellState[cid].detections = detectionObjects;
  }

  // 处理快照信息
  if (msg.snapshot) {
    cellState[cid].snapshot = msg.snapshot;
  }
  

  
  // 标准化告警类型文本
  if (alarmType !== '无') {
    const typeNum = typeof alarmType === 'string' ? parseInt(alarmType) : alarmType;
    const typeText = alarmTypeText[typeNum] || alarmType.toString() || '未知告警';
    cellState[cid].alarm = typeText;
    
    // 初始化告警记录数组
    if (!alarmsByCamera[cid]) {
      alarmsByCamera[cid] = [];
    }
    
    // 为每条新告警创建唯一记录，不再检查重复
    // 这确保每次告警都会被记录，解决告警记录不更新的问题
    const newAlarm = {
      id: `${cid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: typeText,
      time: currentTime,
      level: alarmLevel,
      snapshot: msg.snapshot || null,
      alarm_id: msg.alarm_id || msg.id || null,
      duration: msg.duration || null,
      details: msg.details || null,
      raw_data: { ...msg },
      end_time: null // 告警结束时间
    };
    
    // 添加到告警列表开头
    alarmsByCamera[cid].unshift(newAlarm);
    
    // 限制告警记录数量，但保留更多记录以便查看历史
    if (alarmsByCamera[cid].length > 50) {
      alarmsByCamera[cid] = alarmsByCamera[cid].slice(0, 50);
    }
    
    console.log(`摄像头 ${cid} 新增告警:`, newAlarm);
  } else if (previousAlarm !== '无') {
    // 告警状态从有变为无，更新最近告警的结束时间
    if (alarmsByCamera[cid] && alarmsByCamera[cid].length > 0) {
      const lastAlarm = alarmsByCamera[cid][0];
      if (!lastAlarm.end_time) {
        lastAlarm.end_time = currentTime;
        lastAlarm.level = 'success';
        console.log(`摄像头 ${cid} 告警结束:`, lastAlarm.type);
      }
    }
    
    // 更新为无告警状态
    cellState[cid].alarm = '无';
  }
  
  // 主动刷新当前选中摄像头的数据显示
  // 这确保UI能及时反映最新的检测结果和告警状态
  if (layoutKey.value === '1x1' && activeSingle.value && activeSingle.value.camera_id === cid) {
    // 触发视图更新
    console.log(`刷新当前选中摄像头 ${cid} 的显示数据`);
    // 使用Vue的响应式机制确保视图更新
    nextTick(() => {
      // 这里不需要特殊操作，Vue会自动更新响应式数据
    });
  }
  
  // 记录状态变化
  if (previousResult !== finalResult || previousAlarm !== cellState[cid].alarm) {
    console.log(`摄像头 ${cid} 状态变化: 结果从 ${previousResult} 变为 ${finalResult}, 告警从 ${previousAlarm} 变为 ${cellState[cid].alarm}`);
  }
}

/* ======= 后端启停 ======= */
async function handleStart (cameraId) {
  try {
    console.log(`尝试启动摄像头 ${cameraId} 的分析`);
    
    // 发送启动指令前先重置该摄像头的状态
    if (!cellState[cameraId]) {
      cellState[cameraId] = {};
    }
    
    cellState[cameraId].result = '初始化中...';
    cellState[cameraId].alarm = '无';
    cellState[cameraId].detections = [];
    cellState[cameraId].lastUpdate = Date.now();
    cellState[cameraId].analysisStatus = 'starting';
    cellState[cameraId].time = new Date().toLocaleString('zh-CN');
    
    // 调用后端API启动分析
    const result = await startAnalysis(cameraId);
    console.log(`启动摄像头 ${cameraId} 成功:`, result);
    
    ElMessage.success(`摄像头 ${cameraId} 已发送启动指令`);
    
    // 更新分析状态
    cellState[cameraId].analysisStatus = 'running';
    
    // 确保WebSocket订阅此摄像头
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendSubscribeMessage([cameraId]);
    }
    
    // 设置一个状态更新定时器，确保用户能看到变化
    setTimeout(() => {
      if (cellState[cameraId] && cellState[cameraId].result === '初始化中...') {
        cellState[cameraId].result = '分析中';
        cellState[cameraId].time = new Date().toLocaleString('zh-CN');
        console.log(`摄像头 ${cameraId} 进入分析中状态`);
      }
    }, 1000);
    
    // 主动向用户提示启动成功
    if (layoutKey.value === '1x1' && activeSingle.value && activeSingle.value.camera_id === cameraId) {
      // 强制刷新当前选中摄像头的显示
      nextTick(() => {
        console.log(`刷新当前选中摄像头 ${cameraId} 的显示`);
      });
    }
  } catch (error) {
    console.error('启动分析失败:', error);
    
    // 更新错误状态
    if (cellState[cameraId]) {
      cellState[cameraId].result = '启动失败';
      cellState[cameraId].analysisStatus = 'error';
      cellState[cameraId].lastError = error.message || '未知错误';
      cellState[cameraId].time = new Date().toLocaleString('zh-CN');
    }
    
    ElMessage.error(`启动失败: ${error.message || '未知错误'}`);
  }
}

async function handleStop (cameraId) {
  try {
    console.log(`尝试停止摄像头 ${cameraId} 的分析`);
    
    // 更新状态为停止中
    if (cellState[cameraId]) {
      cellState[cameraId].analysisStatus = 'stopping';
      cellState[cameraId].time = new Date().toLocaleString('zh-CN');
    }
    
    // 调用后端API停止分析
    const result = await stopAnalysis(cameraId);
    console.log(`停止摄像头 ${cameraId} 成功:`, result);
    
    ElMessage.success(`摄像头 ${cameraId} 已发送停止指令`);
    
    // 立即更新状态为已停止
    if (cellState[cameraId]) {
      cellState[cameraId].result = '已停止';
      cellState[cameraId].alarm = '无';
      cellState[cameraId].detections = [];
      cellState[cameraId].analysisStatus = 'stopped';
      cellState[cameraId].time = new Date().toLocaleString('zh-CN');
    }
    
    // 清除该摄像头的告警状态
    if (alarmsByCamera[cameraId] && alarmsByCamera[cameraId].length > 0) {
      const lastAlarm = alarmsByCamera[cameraId][0];
      if (!lastAlarm.end_time) {
        lastAlarm.end_time = new Date().toLocaleString('zh-CN');
        lastAlarm.level = 'success';
      }
    }
  } catch (error) {
    console.error('停止分析失败:', error);
    
    // 更新错误状态
    if (cellState[cameraId]) {
      cellState[cameraId].analysisStatus = 'error';
      cellState[cameraId].lastError = error.message || '停止失败';
      cellState[cameraId].time = new Date().toLocaleString('zh-CN');
    }
    
    ElMessage.error(`停止失败: ${error.message || '未知错误'}`);
  }
}

// 批量启动优化：使用Promise.all并行处理
async function batchStart () {
  if (selectedCameraIds.value.length === 0) {
    ElMessage.warning('请先选择摄像头');
    return;
  }
  
  console.log(`开始批量启动 ${selectedCameraIds.value.length} 个摄像头`);
  
  // 使用Promise.allSettled并行处理所有请求，避免一个失败影响全部
  const promises = selectedCameraIds.value.map(id => handleStart(id).catch(err => {
    console.error(`摄像头 ${id} 启动失败:`, err);
    return { id, success: false, error: err };
  }));
  
  await Promise.allSettled(promises);
  ElMessage.success(`批量启动完成，已发送 ${selectedCameraIds.value.length} 个摄像头的启动指令`);
  
  // 确保WebSocket订阅所有启动的摄像头
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSubscribeMessage(selectedCameraIds.value);
  }
}

// 批量停止优化
async function batchStop () {
  if (selectedCameraIds.value.length === 0) {
    ElMessage.warning('请先选择摄像头');
    return;
  }
  
  console.log(`开始批量停止 ${selectedCameraIds.value.length} 个摄像头`);
  
  const promises = selectedCameraIds.value.map(id => handleStop(id).catch(err => {
    console.error(`摄像头 ${id} 停止失败:`, err);
    return { id, success: false, error: err };
  }));
  
  await Promise.allSettled(promises);
  ElMessage.success(`批量停止完成，已发送 ${selectedCameraIds.value.length} 个摄像头的停止指令`);
}

async function startBoundCameras () {
  const boundIds = getBoundCameraIds();
  console.log(`启动绑定的摄像头:`, boundIds);
  
  for (const id of boundIds) {
    await handleStart(id);
  }
  
  ElMessage.success('已发送启动指令（四路绑定）');
  
  // 确保WebSocket订阅所有启动的摄像头
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSubscribeMessage(boundIds);
  }
}

// 添加一个函数，用于刷新当前选中摄像头的数据显示
function refreshActiveCameraDisplay() {
  if (layoutKey.value === '1x1' && activeSingle.value) {
    const cameraId = activeSingle.value.camera_id;
    console.log(`刷新摄像头 ${cameraId} 的显示数据`);
    
    // 这将触发Vue的响应式更新
    // 强制更新告警列表和检测结果
    if (alarmsByCamera[cameraId]) {
      // 重新排序或克隆数组以触发更新
      alarmsByCamera[cameraId] = [...alarmsByCamera[cameraId]];
    }
    
    if (cellState[cameraId]) {
      // 更新时间戳以确保视图更新
      cellState[cameraId].time = new Date().toLocaleString('zh-CN');
      // 触发detections数组的更新
      if (cellState[cameraId].detections) {
        cellState[cameraId].detections = [...cellState[cameraId].detections];
      }
    }
  }
}

// 增强初始化逻辑
onMounted(async () => {
  console.log('监控页面开始初始化');
  
  // 加载摄像头列表
  await loadCameras();
  
  // 先设置布局，再初始化播放器
  if (layoutKey.value === '1x1') {
    nextTick(playSingle);
  } else {
    nextTick(initPlayers);
  }
  
  // 延迟连接WebSocket，确保页面初始化完成
  setTimeout(() => {
    connectAlarmWS();
  }, 1000);
  
  // 添加WebSocket连接状态监控
  const wsStatusCheckInterval = setInterval(() => {
    if (!wsConnectionState && ws && ws.readyState !== WebSocket.CONNECTING) {
      console.warn('WebSocket连接断开，尝试重新连接');
      connectAlarmWS();
    }
  }, 15000); // 每15秒检查一次连接状态
  
  // 添加摄像头状态检查定时器
  const cameraStatusCheckInterval = setInterval(() => {
    const now = Date.now();
    
    // 检查所有摄像头状态
    Object.keys(cellState).forEach(cameraId => {
      const state = cellState[cameraId];
      
      // 如果摄像头处于分析中状态但长时间未更新，可能有问题
      if (state.analysisStatus === 'running' && 
          state.lastUpdate && 
          (now - state.lastUpdate > 2 * 60 * 1000)) {
        
        console.warn(`摄像头 ${cameraId} 分析中但2分钟未更新数据`);
        
        // 对于当前选中的摄像头，主动刷新显示
        if (layoutKey.value === '1x1' && activeSingle.value && activeSingle.value.camera_id === cameraId) {
          refreshActiveCameraDisplay();
        }
      }
    });
    
    // 主动刷新当前选中摄像头的显示，确保UI及时更新
    refreshActiveCameraDisplay();
  }, 10000); // 每10秒检查一次并刷新显示
  
  // 清理定时器
  onBeforeUnmount(() => {
    clearInterval(wsStatusCheckInterval);
    clearInterval(cameraStatusCheckInterval);
    
    // 清理WebSocket相关资源
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
  });
})

// 监听布局变化
watch(layoutKey, (v) => {
  console.log('布局变化:', v);
  
  // 重置分页
  if (v === '1x1') {
    singlePage.value = 0;
    nextTick(() => {
      playSingle();
      // 布局切换到1x1时，确保告警记录正确显示
      if (activeSingle.value) {
        const cameraId = activeSingle.value.camera_id;
        console.log(`切换到1x1模式，显示摄像头 ${cameraId} 的告警记录`);
        // 强制刷新告警列表
        if (alarmsByCamera[cameraId]) {
          alarmsByCamera[cameraId] = [...alarmsByCamera[cameraId]];
        }
      }
    });
  } else {
    wallPage.value = 0;
    nextTick(initPlayers);
  }
});

// 监听筛选后的摄像头变化
watch(filteredCameras, () => {
  console.log('筛选后的摄像头变化，数量:', filteredCameras.value.length);
  
  wallPage.value = 0;
  
  if (layoutKey.value === '1x1') {
    singlePage.value = 0;
    nextTick(() => {
      console.log('在filteredCameras变化后播放单个视频');
      playSingle();
    });
  } else {
    nextTick(() => {
      console.log('在filteredCameras变化后初始化播放器');
      initPlayers();
    });
  }
  
  // 当摄像头列表变化时，重新订阅WebSocket
  if (ws && ws.readyState === WebSocket.OPEN && filteredCameras.value.length > 0) {
    const cameraIds = filteredCameras.value.map(cam => cam.camera_id);
    sendSubscribeMessage(cameraIds);
  }
}, { deep: true });

// 监听当前活动摄像头变化，确保告警记录正确更新
watch(activeSingle, (newCamera, oldCamera) => {
  if (newCamera) {
    console.log(`当前活动摄像头变化为: ${newCamera.camera_name} (${newCamera.camera_id})`);
    
    // 确保该摄像头有告警记录数组
    if (!alarmsByCamera[newCamera.camera_id]) {
      alarmsByCamera[newCamera.camera_id] = [];
    }
    
    // 强制刷新告警记录显示
    nextTick(() => {
      console.log(`刷新告警记录显示，当前记录数: ${alarmsByCamera[newCamera.camera_id].length}`);
      // 重新排序或克隆数组以触发更新
      alarmsByCamera[newCamera.camera_id] = [...alarmsByCamera[newCamera.camera_id]];
    });
  }
});

// 监听告警记录变化，用于调试
watch(() => alarmsByCamera, (newAlarms) => {
  // 仅在调试时启用，避免性能问题
  // console.log('告警记录变化:', newAlarms);
}, { deep: true });

// 监听单元格状态变化
watch(() => cellState, (newState) => {
  // 仅在调试时启用，避免性能问题
  // console.log('单元格状态变化:', newState);
}, { deep: true });
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
