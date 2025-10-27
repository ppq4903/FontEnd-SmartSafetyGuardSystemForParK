// src/api/camera.js
import request from '@/utils/request'

/**
 * 约定：
 * baseURL 由 request.js 配置为 '/backend'（例如代理到 http://localhost:8089/api/v1）
 * 这里写 '/camera_infos/...' 即可。
 *
 * 后端（FastAPI）接口（见 /docs）：
 * GET  /camera_infos/search
 * GET  /camera_infos/{camera_info_id}
 * GET  /camera_infos/
 * POST /camera_infos/
 * PUT  /camera_infos/{camera_info_id}
 * DELETE /camera_infos/{camera_info_ids}
 * GET  /camera_infos/test/{camera_id}
 */

// ---------- 常量枚举 ----------
export const ANALYSIS_MODE_MAP = {
  0: '无',
  1: '全部',
  2: '安全规范',
  3: '区域入侵',
  4: '火警',
}

export const CAMERA_STATUS_MAP = {
  0: '离线',
  1: '在线',
  2: '检测中',
}

export const ANALYSIS_MODE_OPTIONS = Object.entries(ANALYSIS_MODE_MAP).map(
  ([value, label]) => ({ label, value: Number(value) })
)
export const CAMERA_STATUS_OPTIONS = Object.entries(CAMERA_STATUS_MAP).map(
  ([value, label]) => ({ label, value: Number(value) })
)

// 允许两种格式：
// 1. local:filename.mp4 格式
// 2. rtsp://IP:端口/流地址 格式
export const RTSP_REGEX = /^(local:\S+\.mp4$|rtsp:\/\/[^:\s]+(:[^@\s]+)?@?[\d.]+:\d+\/\S*)$/i

// ---------- 查询/分页参数归一 ----------
const normalizePageParams = (params = {}) => {
  const {
    page,
    pageNum,
    page_size,
    pageSize,
    park_area,
    analysis_mode,
    camera_status,
    camera_name,
    ...rest
  } = params

  return {
    pageNum: pageNum ?? page ?? 1,
    pageSize: pageSize ?? page_size ?? 10,
    park_area,
    analysis_mode,
    camera_status,
    camera_name,
    ...rest,
  }
}

// ---------- 接口 ----------
export const searchCameras = (params = {}) => {
  return request.get('/camera_infos/search', { params: normalizePageParams(params) })
}

/** 获取“尽可能全部”的数据；FastAPI 这条默认 limit=10，这里显式传一个很大的 limit */
export const getAllCameras = (skip = 0, limit = 100000) => {
  return request.get('/camera_infos/', { params: { skip, limit } })
}

export const getCameraById = (id) => request.get(`/camera_infos/${id}`)

export const createCamera = (payload) => request.post('/camera_infos/', payload)

/** 注意：保持接口路径一致性 */
export const updateCamera = (id, payload) => request.put(`/camera_infos/${id}`, payload)

/** 支持数组或逗号分隔字符串 */
export const deleteCameras = (ids) => {
  const idStr = Array.isArray(ids) ? ids.join(',') : ids
  return request.delete(`/camera_infos/${idStr}`)
}

export const testCamera = (id) => request.get(`/camera_infos/test/${id}`)

/** 测试摄像头连接 */
export const fetchFramePing = (id) => request.get(`/camera_infos/test/${id}`)
