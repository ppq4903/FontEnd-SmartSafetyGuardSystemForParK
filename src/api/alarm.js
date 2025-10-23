// 告警/处理记录/摄像头/用户 相关接口（不带 api/v1 前缀）
import request from '@/utils/request'

// 1) 告警列表（分页参数可用于分段拉取；本页采用前端稳定分页，会循环把全部取完）
export function getAlarms(params) {
  // params: { alarm_type?, alarm_status?, skip=0, limit=200 }
  return request({
    url: '/alarms',
    method: 'get',
    params
  })
}

// 2) 批量删除告警
export function deleteAlarms(ids) {
  const idStr = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request({
    url: `/alarms/${idStr}`,
    method: 'delete'
  })
}

// 3) 获取某条告警的处理记录列表
export function getHandleRecords(alarmId) {
  return request({
    url: `/alarm_handle_records/${alarmId}`,
    method: 'get'
  })
}

// 4) 新增处理记录（派单 / 误报 / 已解决）
//    避免 422：只传必要字段，非派单不传 handle_user_id；无附件不传 attachment_url
export function createHandleRecord(data) {
  return request({
    url: '/alarm_handle_records',
    method: 'post',
    data
  })
}

// 5) 上传附件（base64）
export function uploadAttachment(data) {
  // data: { file_content: base64(不含data:前缀), file_extension: 'jpg' }
  return request({
    url: '/alarm_handle_records/upload_attachment',
    method: 'post',
    data
  })
}

// 6) 取用户（例如只要操作员：user_role=2）
export function getUsers(params = {}) {
  return request({
    url: '/users',
    method: 'get',
    params
  })
}

// 7) 取摄像头信息
export function getCameraInfo(cameraId) {
  return request({
    url: `/camera_infos/${cameraId}`,
    method: 'get'
  })
}
