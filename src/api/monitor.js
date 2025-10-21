import request from '@/utils/request'

/**
 * 与后端接口对齐（不要手动加 /api/v1；若已在 axios baseURL 配置则自动带上）：
 * - GET  /camera_infos/search
 * - GET  /camera_infos/test/{camera_id}
 * - GET  /camera_infos/{camera_info_id}
 * - PUT  /camera_infos/{camera_info_id}
 * - POST /camera_infos/
 * - DELETE /camera_infos/{camera_info_ids}
 * - GET  /safety_analysis/start/{id}、/safety_analysis/stop/{id}
 */

/**
 * 统一查询：返回 { rows, total }
 * 兼容后端可能的返回格式：数组 / {rows|list|items|data, total}
 * 注意：默认 page_size 给足，避免 33 条被分页成 28 条。
 */
export async function fetchCameraList (filters = {}) {
  const {
    page = 1,
    page_size = 1000, // 调大默认分页，拿全量
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

// 单项 CRUD（供已有功能对接）
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

// 可选：截图（若后端支持）
export async function requestSnapshot (cameraId) {
  const res = await request.get(`/camera_infos/${cameraId}/snapshot`, { responseType: 'blob' })
  return res?.data ?? res
}

/* ---------------------- 测试视频配置 ---------------------- */
/**
 * 说明：
 * - 这 4 个 mp4 与你给的目录一致：all.mp4 / fire_smoke.mp4 / helmet_vest.mp4 / person_vehicle.mp4
 * - 在前端 public/test_videos 下放同名文件，或把后端静态目录映射到 /test_videos/
 * - 可用 VITE_VIDEO_BASE_PATH 覆盖基础路径
 */
export const VIDEO_BASE_PATH = import.meta.env.VITE_VIDEO_BASE_PATH || '/test_videos/'
export const TEST_VIDEO_FILES = [
  'all.mp4',
  'fire_smoke.mp4',
  'helmet_vest.mp4',
  'person_vehicle.mp4'
]
export function buildTestVideoUrl (file, base = VIDEO_BASE_PATH) {
  return `${base}${file}`
}
export function getTestVideoList (base = VIDEO_BASE_PATH) {
  return TEST_VIDEO_FILES.map(f => buildTestVideoUrl(f, base))
}

/* ---------------------- 四格绑定配置（前端可调） ---------------------- */
/**
 * 绑定示例：每个单元绑定一个摄像头 ID 和一个测试视频文件名。
 * 如需改绑定，只改这里的 cameraId/file 即可（或通过环境变量下发 JSON）。
 */
export const DEFAULT_CAMERA_SLOTS = [
  { cameraId: 5, file: 'helmet_vest.mp4' },
  { cameraId: 6, file: 'all.mp4' },
  { cameraId: 7, file: 'fire_smoke.mp4' },
  { cameraId: 8, file: 'person_vehicle.mp4' }
]

// 如果配置了 VITE_CAMERA_SLOTS_JSON（如：[{"cameraId":5,"file":"helmet_vest.mp4"}, ...]），则覆盖默认
export function getCameraSlots () {
  let fromEnv = []
  try {
    if (import.meta.env.VITE_CAMERA_SLOTS_JSON) {
      fromEnv = JSON.parse(import.meta.env.VITE_CAMERA_SLOTS_JSON)
    }
  } catch (e) {}
  const slots = (fromEnv?.length ? fromEnv : DEFAULT_CAMERA_SLOTS)
  return slots.map(s => ({ ...s, src: buildTestVideoUrl(s.file) }))
}
