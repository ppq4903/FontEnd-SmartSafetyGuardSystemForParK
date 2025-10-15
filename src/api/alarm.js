// src/api/alarm.js
import request from '@/utils/request'

/**
 * 原有：获取告警列表（保留原始字符串，页面自行解析）
 * GET /alarms/?start_time&end_time&alarm_type&alarm_status&skip&limit
 */
export function getAlarmsText(params) {
  return request({
    url: '/alarms/',
    method: 'get',
    params,
    transformResponse: [(data) => data] // 保留为字符串
  })
}

/**
 * ✅ 新增兜底：获取告警列表（让 axios 正常解析为对象）
 * 用于当某些环境下 getAlarmsText 返回 '{}' 或空串时的回退方案
 */
export function getAlarmsJson(params) {
  return request({
    url: '/alarms/',
    method: 'get',
    params
    // 不设置 transformResponse，走默认 JSON 解析
  })
}

/** 批量删除 —— DELETE /alarms/{alarm_ids} */
export function deleteAlarms(ids) {
  const idsStr = Array.isArray(ids) ? ids.join(',') : String(ids || '')
  return request({
    url: `/alarms/${idsStr}`,
    method: 'delete'
  })
}

/** 处理记录列表 —— GET /alarm_handle_records/{alarm_id} */
export function getAlarmHandleRecords(alarmId) {
  return request({
    url: `/alarm_handle_records/${alarmId}`,
    method: 'get'
  })
}

/** 上传处理附件 —— POST /alarm_handle_records/upload_attachment */
export function uploadHandleAttachment(payload) {
  return request({
    url: '/alarm_handle_records/upload_attachment',
    method: 'post',
    data: payload
  })
}

/** 创建处理记录 —— POST /alarm_handle_records/ */
export function createAlarmHandleRecord(payload) {
  return request({
    url: '/alarm_handle_records/',
    method: 'post',
    data: payload
  })
}

/** 根据 camera_id 获取摄像头信息 —— GET /cameraInfos/{camera_id} */
export function getCameraInfo(cameraId) {
  return request({
    url: `/cameraInfos/${cameraId}`,
    method: 'get'
  })
}
