<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { login, register as registerApi } from '@/api/login'

const router = useRouter()
const isRegister = ref(false)
const loading = ref(false)

const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  phone: '' // 注册必填：11位手机号
})

function resetForm() {
  form.value = { username: '', password: '', confirmPassword: '', phone: '' }
}

function switchMode(toRegister) {
  isRegister.value = toRegister
  resetForm()
}

function successGotoHome(token, fallbackName) {
  if (token) localStorage.setItem('token', token)
  localStorage.setItem('loginInfo', JSON.stringify({ name: fallbackName }))
  ElMessage.success('操作成功')
  router.push('/')
}

function isValidPhone(p) {
  return /^1\d{10}$/.test(p || '')
}

async function handleSubmit() {
  // —— 前端兜底校验，避免 422 ——
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  if (isRegister.value) {
    if (form.value.password.length < 6) {
      ElMessage.warning('密码至少 6 位')
      return
    }
    if (form.value.password !== form.value.confirmPassword) {
      ElMessage.warning('两次输入的密码不一致')
      return
    }
    if (!isValidPhone(form.value.phone)) {
      ElMessage.warning('请输入有效的 11 位手机号')
      return
    }
  }

  loading.value = true
  try {
    if (isRegister.value) {
      // /register: JSON => { user_name, password, phone }
      const res = await registerApi({
        user_name: form.value.username, // 注意字段名是 user_name（后端模型）
        password: form.value.password,
        phone: form.value.phone
      })
      const data = res?.data ?? res
      const token =
        data?.data?.access_token ?? data?.access_token ?? data?.result?.access_token
      if (token) {
        successGotoHome(token, form.value.username)
      } else if (data?.code === 200 || data?.success === true) {
        ElMessage.success(data?.msg || '注册成功，请登录')
        switchMode(false)
      } else {
        ElMessage.error(data?.msg || data?.message || '注册失败')
      }
      return
    }

    // /token: x-www-form-urlencoded => { username, password }
    const res = await login({
      username: form.value.username,
      password: form.value.password
    })
    const data = res?.data ?? res
    const token =
      data?.data?.access_token ?? data?.access_token ?? data?.result?.access_token
    if (token || data?.code === 200 || data?.success === true) {
      successGotoHome(token, form.value.username)
    } else {
      ElMessage.error(data?.msg || data?.message || '用户名或密码错误')
    }
  } catch (e) {
    // 尽量把后端的 msg/detail 透出，便于定位 422 的具体字段
    const msg = e?.response?.data?.msg || e?.response?.data?.detail || e?.message
    ElMessage.error(msg || '网络异常，请稍后再试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <el-card class="login-card">
      <h1 class="title">智能安防系统</h1>

      <el-form :model="form" label-width="90px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" autocomplete="username" />
        </el-form-item>

        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>

        <el-form-item v-if="isRegister" label="确认密码">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item v-if="isRegister" label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号（11位）" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            {{ isRegister ? '注 册' : '登 录' }}
          </el-button>
          <el-button class="ml-2" @click="resetForm">重 置</el-button>
          <el-button link class="ml-2" @click="switchMode(!isRegister)">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card { width: 420px; }
.title { text-align: center; margin-bottom: 14px; font-weight: 600; }
.tabs { display: flex; justify-content: center; gap: 8px; margin-bottom: 10px; }
.ml-2 { margin-left: 8px; }
</style>
