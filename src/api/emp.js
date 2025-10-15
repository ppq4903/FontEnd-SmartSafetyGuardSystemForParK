// src/api/emp.js
import request from '@/utils/request'

/**
 * 列表：与 get_all_users(skip, limit) 对齐
 * （后端默认 limit=10，这里建议前端一次取“足够大”的条数，再前端分页）
 */
export const selectPage = (params) => {
  // params: { skip, limit }
  return request.get('/users', { params })
}

/** 新增：POST /users  */
export const addNewEmp = (emp) => {
  // emp: { user_name, name, gender, password, user_role, phone }
  return request.post('/users', emp)
}

/** 查询单个：GET /users/{id} */
export const selectById = (id) => request.get(`/users/${id}`)

/**
 * 更新：PUT /users/{user_id}
 * 仅把允许更新的字段放进 body，避免与后端 UserUpdate 模型冲突
 */
export const update = async (emp) => {
  const id = emp?.user_id ?? emp?.id
  if (id === undefined || id === null || Number.isNaN(Number(id))) {
    const err = new Error('missing or invalid user_id for update')
    err.code = 'NO_ID'
    throw err
  }
  const body = {
    user_name: emp.user_name,
    name: emp.name,
    gender: Number(emp.gender),
    user_role: Number(emp.user_role),
    phone: emp.phone
  }
  if (emp.password) body.password = emp.password
  return request.put(`/users/${Number(id)}`, body)
}

// 删除（支持批量，ids 可为数组或逗号分隔字符串）
export const deleteEmp = (ids) => {
  const empIds = Array.isArray(ids) ? ids.join(',') : ids
  return request.delete(`/users/${empIds}`, { params: { ids: empIds } })
}
