// src/api/area.js
import request from '@/utils/request'

/**
 * 列表搜索：GET /park_areas/search
 * params: { park_area?, skip, limit }
 * 后端返回 { code, msg, data: { total, rows: [...] } }
 */
export const selectPage = (params) => {
  return request.get('/park_areas/search', { params })
}

/** 新增：POST /park_areas */
export const addNewArea = (area) => {
  const body = {
    park_area: area.park_area,
    remark: area.remark
  }
  return request.post('/park_areas', body)
}

/** 查询单个：GET /park_areas/{id} */
export const selectById = (id) => request.get(`/park_areas/${Number(id)}`)

/** 更新：PUT /park_areas/{id} */
export const update = async (area) => {
  const id = area?.park_area_id ?? area?.id
  if (id === undefined || id === null || Number.isNaN(Number(id))) {
    const err = new Error('missing or invalid park_area_id for update')
    err.code = 'NO_ID'
    throw err
  }
  const body = {}
  if (area.park_area !== undefined) body.park_area = area.park_area
  if (area.remark !== undefined) body.remark = area.remark
  return request.put(`/park_areas/${Number(id)}`, body)
}

/** 删除（支持批量）：DELETE /park_areas/{ids}  */
export const deleteArea = (ids) => {
  const areaIds = Array.isArray(ids) ? ids.join(',') : String(ids)
  return request.delete(`/park_areas/${areaIds}`, { params: { park_area_ids: areaIds } })
}
