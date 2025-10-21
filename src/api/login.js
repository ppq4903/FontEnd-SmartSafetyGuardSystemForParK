import request from '@/utils/request'

/**
 * 登录：/token 需要 x-www-form-urlencoded（OAuth2PasswordRequestForm）
 */
export const login = ({ username, password }) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  // 某些实现会校验该字段，保留更稳妥
  form.append('grant_type', 'password')

  return request.post('token', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
}

/**
 * 注册：/register 接收 JSON（UserRegister）
 * 必填：user_name、password、phone（phone 11位）
 */
export const register = ({ user_name, password, phone }) => {
  return request.post('register', { user_name, password, phone })
}
