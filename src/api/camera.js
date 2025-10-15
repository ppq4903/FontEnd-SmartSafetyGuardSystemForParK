// src/api/camera.js
import request from '@/utils/request'

/**
 * 约定：
 * baseURL 由 request.js 配置为 '/backend'（例如代理到 http://localhost:8089/api/v1）
 * 这里写 '/cameraInfos/...' 即可。
 *
 * 后端（FastAPI）接口（见 /docs）：
 * GET  /cameraInfos/search
 * GET  /cameraInfos/{camera_info_id}
 * GET  /cameraInfos/
 * POST /cameraInfos/
 * PUT  /cameraInfos/{camera_info_id}
 * DELETE /cameraInfos/{camera_info_ids}
 * GET  /cameraInfos/test/{camera_id}
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

// 仅允许：rtsp://IP:端口/流地址
export const RTSP_REGEX = /^rtsp:\/\/\d{1,3}(\.\d{1,3}){3}:\d+\/.+$/

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
  return request.get('/cameraInfos/search', { params: normalizePageParams(params) })
}

/** 获取“尽可能全部”的数据；FastAPI 这条默认 limit=10，这里显式传一个很大的 limit */
export const getAllCameras = (skip = 0, limit = 100000) => {
  return request.get('/cameraInfos/', { params: { skip, limit } })
}

export const getCameraById = (id) => request.get(`/cameraInfos/${id}`)

export const createCamera = (payload) => request.post('/cameraInfos/', payload)

/** 注意：这里带结尾斜杠，避免路由不匹配被重定向到登录 */
export const updateCamera = (id, payload) => request.put(`/cameraInfos/${id}/`, payload)

/** 支持数组或逗号分隔字符串；同样带结尾斜杠 */
export const deleteCameras = (ids) => {
  const idStr = Array.isArray(ids) ? ids.join(',') : ids
  return request.delete(`/cameraInfos/${idStr}/`)
}

export const testCamera = (id) => request.get(`/cameraInfos/test/${id}`)
