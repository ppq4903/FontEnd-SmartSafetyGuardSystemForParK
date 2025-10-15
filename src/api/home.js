// src/api/home.js
import request from '@/utils/request'

// -------------------- Alarms（告警） --------------------

// 最近未处理/未解决（后端一般返回最近 N 条）
export function apiGetRecentUnresolved (params = {}) {
  return request({
    url: '/alarms/recent_unresolved',
    method: 'get',
    params
  })
}

// 通用获取告警列表（支持分页、筛选）
export function apiGetAlarms (params = {}) {
  return request({
    url: '/alarms/',
    method: 'get',
    params
  })
}

// 今日处理率
export function apiGetTodayHandleReport () {
  return request({
    url: '/alarms/today_handle_report',
    method: 'get'
  })
}

// 今日各类告警分布
export function apiGetTodayReport () {
  return request({
    url: '/alarms/today_report',
    method: 'get'
  })
}

// 历史汇总
export function apiGetAllReport () {
  return request({
    url: '/alarms/all_report',
    method: 'get'
  })
}

// -------------------- Cameras（摄像头） --------------------

// 条件/分页查询
export function apiGetCameraInfos (params = {}) {
  return request({
    url: '/camera_infos/search',
    method: 'get',
    params
  })
}

// 摄像头状态统计（若后端未提供或为空，前端回退聚合）
export function apiGetCameraStatusReport () {
  return request({
    url: '/camera_infos/status_report',
    method: 'get'
  })
}
