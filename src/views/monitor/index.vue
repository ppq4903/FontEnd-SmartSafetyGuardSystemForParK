<template>
  <div class="monitor-page">
    <div class="left-panel">
      <!-- 播放器 -->
      <video
        ref="videoRef"
        class="player"
        controls
        autoplay
        muted
        playsinline
        @ended="onEnded"
        @error="onError"
      ></video>

      <!-- 播放控制区 -->
      <div class="toolbar">
        <el-button type="primary" :disabled="isLoopPlaying" @click="startLoop">
          循环播放测试视频
        </el-button>
        <el-button type="warning" :disabled="!isLoopPlaying" @click="stopLoop">
          停止循环
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="prev">上一个</el-button>
        <el-button @click="next">下一个</el-button>
        <span class="tip">当前：{{ currentName }}</span>
        <el-divider direction="vertical" />
        <el-button @click="downloadFrame">下载当前帧</el-button>
      </div>
    </div>

    <div class="right-panel">
      <!-- 摄像头表格（保留原有操作：启动/停止检测） -->
      <el-card class="card">
        <template #header>
          <div class="card-header">
            <span>摄像头列表</span>
            <el-button type="default" size="small" @click="loadCameras">刷新</el-button>
          </div>
        </template>

        <el-table :data="cameraList" size="small" stripe>
          <el-table-column prop="camera_id" label="ID" width="80" />
          <el-table-column prop="camera_name" label="名称" />
          <el-table-column prop="analysis_mode" label="模式" width="90" />
          <el-table-column prop="camera_status" label="状态" width="110" />
          <el-table-column label="操作" width="210">
            <template #default="{ row }">
              <el-button type="success" size="small" @click="handleStart(row.camera_id)">启动检测</el-button>
              <el-button type="danger" size="small" @click="handleStop(row.camera_id)">停止检测</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="small-hint">
          提示：播放与检测互不影响。播放仅循环本地测试视频，检测仍调用后端实时分析。
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCameraList,
  startAnalysis,
  stopAnalysis,
  getTestVideoList,
  TEST_VIDEO_FILES
} from '@/api/monitor'

// 播放器 refs
const videoRef = ref(null)

// 测试视频 URL 列表与当前索引
const videoUrls = ref(getTestVideoList())
const current = ref(0)
const isLoopPlaying = ref(false)

// 便于展示文件名
const currentName = computed(() => TEST_VIDEO_FILES[current.value] || '-')

// 摄像头列表
const cameraList = ref([])

async function loadCameras () {
  try {
    const { rows } = await fetchCameraList()
    cameraList.value = rows || []
  } catch (e) {
    console.error(e)
  }
}

function playAt (idx) {
  if (!videoRef.value) return
  if (idx < 0 || idx >= videoUrls.value.length) return
  current.value = idx
  const v = videoRef.value
  v.src = videoUrls.value[idx]
  v.load()
  v.play().catch(() => {})
}

function startLoop () {
  isLoopPlaying.value = true
  playAt(current.value)
}

function stopLoop () {
  isLoopPlaying.value = false
  if (videoRef.value) videoRef.value.pause()
}

function onEnded () {
  if (!isLoopPlaying.value) return
  next()
}

function onError () {
  ElMessage.error('视频加载失败，自动切到下一个')
  next()
}

function prev () {
  const idx = (current.value - 1 + videoUrls.value.length) % videoUrls.value.length
  playAt(idx)
}
function next () {
  const idx = (current.value + 1) % videoUrls.value.length
  playAt(idx)
}

// 下载当前帧：使用 canvas 抓取 <video> 当前画面
function downloadFrame () {
  const video = videoRef.value
  if (!video || video.readyState < 2) {
    ElMessage.warning('暂无可下载画面')
    return
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `snapshot_${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }, 'image/png')
}

// 后端：启动/停止检测
async function handleStart (cameraId) {
  try {
    await startAnalysis(cameraId)
    ElMessage.success('已发送启动检测指令')
  } catch (e) {
    ElMessage.error('启动失败')
  }
}
async function handleStop (cameraId) {
  try {
    await stopAnalysis(cameraId)
    ElMessage.success('已发送停止检测指令')
  } catch (e) {
    ElMessage.error('停止失败')
  }
}

onMounted(() => {
  loadCameras()
  // 默认不自动播放；如需进入页面就开始循环，将下一行解除注释
  // startLoop()
})
onBeforeUnmount(() => stopLoop())
</script>

<style scoped>
.monitor-page {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 16px;
  padding: 12px;
}
.left-panel { display: flex; flex-direction: column; }
.player {
  width: 100%;
  height: 520px;
  object-fit: contain;
  background: #000;
  border-radius: 8px;
}
.toolbar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tip { color: #909399; margin-left: 6px; }
.right-panel .card { height: 100%; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.small-hint {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
