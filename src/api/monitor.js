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
 */
export async function fetchCameraList (filters = {}) {
  const {
    page = 1,
    page_size = 28,
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

// 可选：截图
export async function requestSnapshot (cameraId) {
  const res = await request.get(`/camera_infos/${cameraId}/snapshot`, { responseType: 'blob' })
  return res?.data ?? res
}
