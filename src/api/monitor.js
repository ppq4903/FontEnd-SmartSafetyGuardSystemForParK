import request from '@/utils/request'

/**
 * 统一查询：返回 { rows, total }
 * 兼容后端可能的返回格式：数组 / {rows|list|items|data, total}
 */
export async function fetchCameraList (filters = {}) {
  const {
    page = 1,
    page_size = 1000, // 给足分页，避免 33 条被截断
    skip = (page - 1) * page_size,
    limit = page_size,
    park_area_id,
    analysis_mode,
    camera_status,
    camera_name
  } = filters

  const params = { page, page_size, skip, limit }
  if (park_area_id !== undefined && park_area_id !== null && park_area_id !== '') params.park_area_id = park_area_id
  if (analysis_mode !== undefined && analysis_mode !== null && analysis_mode !== '') params.analysis_mode = analysis_mode
  if (camera_status !== undefined && camera_status !== null && camera_status !== '') params.camera_status = camera_status
  if (camera_name) params.camera_name = camera_name

  const res = await request.get('/camera_infos/search', { params })
  const data = res?.data ?? res

  if (Array.isArray(data)) return { rows: data, total: data.length }
  const rows = data?.rows || data?.list || data?.items || data?.data || []
  const total = data?.total ?? rows.length
  return { rows, total }
}

// 测试 RTSP 连通性
export function fetchFramePing (cameraId) {
  return request.get(`/camera_infos/test/${cameraId}`)
}

// 开启/关闭检测
export function startAnalysis (cameraId) {
  return request.get(`/safety_analysis/start/${cameraId}`)
}
export function stopAnalysis (cameraId) {
  return request.get(`/safety_analysis/stop/${cameraId}`)
}

// 单项 CRUD
export function getCameraById (id) {
  return request.get(`/camera_infos/${id}`)
}
export function createCamera (payload) {
  return request.post('/camera_infos/', payload)
}
export function updateCamera (id, payload) {
  return request.put(`/camera_infos/${id}`, payload)
}
export function deleteCameras (ids) {
  const path = Array.isArray(ids) ? ids.join(',') : ids
  return request.delete(`/camera_infos/${path}`)
}

// 可选：截图
export async function requestSnapshot (cameraId) {
  const res = await request.get(`/camera_infos/${cameraId}/snapshot`, { responseType: 'blob' })
  return res?.data ?? res
}

/* ---------------------- 测试视频与绑定 ---------------------- */
/**
 * 说明：
 * - 视频放到前端 public/test_videos/ 下（或由网关映射到 /test_videos/）
 * - 只将 1/2/3/4 号摄像头绑定到这四个视频，其余摄像头不绑定
 * - 如需修改绑定，可用环境变量 VITE_CAMERA_BINDINGS_JSON 传入对象：
 *   {"1":"helmet_vest.mp4","2":"all.mp4","3":"fire_smoke.mp4","4":"person_vehicle.mp4"}
 */
export const VIDEO_BASE_PATH = import.meta.env.VITE_VIDEO_BASE_PATH || '/test_videos/'

function defaultBindings () {
  return {
    1: 'all.mp4',
    2: 'helmet_vest.mp4',
    3: 'person_vehicle.mp4',
    4: 'fire_smoke.mp4',
    // 新增摄像头5-8的绑定
    5: 'local:all.mp4',
    6: 'local:all.mp4',
    7: 'local:fire_smoke.mp4',
    8: 'local:person_vehicle.mp4'
  }
}

function loadBindings () {
  try {
    if (import.meta.env.VITE_CAMERA_BINDINGS_JSON) {
      const obj = JSON.parse(import.meta.env.VITE_CAMERA_BINDINGS_JSON)
      return obj && typeof obj === 'object' ? obj : defaultBindings()
    }
  } catch (e) {}
  return defaultBindings()
}

export function buildTestVideoUrl (file, base = VIDEO_BASE_PATH) {
  return `${base}${file}`
}

/** 返回按相机ID升序的绑定槽位 [{cameraId, file, src}] */
export function getCameraSlots () {
  const map = loadBindings()
  return Object.keys(map)
    .map(k => Number(k))
    .sort((a, b) => a - b)
    .map(id => ({ cameraId: id, file: map[id], src: buildTestVideoUrl(map[id]) }))
}

/** 获取绑定到指定相机ID的视频URL；未绑定则返回空字符串 */
export function getBoundVideoUrl (cameraId) {
  const map = loadBindings()
  const file = map?.[cameraId]
  if (!file) return ''
  
  // 处理local:格式的视频路径，提取文件名并构建正确的URL
  if (file.startsWith('local:')) {
    const fileName = file.substring(6) // 移除'local:'前缀
    return buildTestVideoUrl(fileName)
  }
  
  return buildTestVideoUrl(file)
}

/** 被绑定的视频相机ID数组（升序） */
export function getBoundCameraIds () {
  const map = loadBindings()
  return Object.keys(map).map(Number).sort((a, b) => a - b)
}
