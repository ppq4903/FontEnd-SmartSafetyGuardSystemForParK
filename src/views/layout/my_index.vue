<!-- src/views/layout/my_index.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const name = ref('')
const setNameDisplay = () => {
  const loginInfo = JSON.parse(localStorage.getItem('loginInfo'))
  if (loginInfo && loginInfo.name) name.value = loginInfo.name
}
onMounted(() => { setNameDisplay() })

const logout = () => {
  ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' })
    .then(() => {
      // 同时删除loginInfo和token
      localStorage.removeItem('loginInfo')
      localStorage.removeItem('token')
      ElMessage.success('已退出')
      router.push('/login')
    })
    .catch(() => {})
}
</script>

<template>
  <div class="common-layout">
    <el-container>
      <el-header class="header">
        <el-menu router :default-active="$route.path" mode="horizontal">
          <span class="title">园区智能安防</span>

          <el-menu-item index="/home">
            <el-icon><house /></el-icon>首页
          </el-menu-item>

          <el-menu-item index="/monitor">
            <el-icon><video-camera /></el-icon>实时监控
          </el-menu-item>

          <el-menu-item index="/alarm">
            <el-icon><warn-triangle-filled /></el-icon>告警管理
          </el-menu-item>

          <el-menu-item index="/emp">
            <el-icon><user /></el-icon>员工管理
          </el-menu-item>

          <!-- ★ 修改：园区管理图标由 <setting /> 改为 <location /> -->
          <el-menu-item index="/area">
            <el-icon><location /></el-icon>园区管理
          </el-menu-item>

          <el-menu-item index="/sys">
            <el-icon><setting /></el-icon>系统配置（摄像头管理）
          </el-menu-item>

          <div class="right_tool">
            <span class="welcome">欢迎您，{{ name }}</span>
            <el-button size="small" @click="logout">退出登录</el-button>
          </div>
        </el-menu>
      </el-header>

      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.title {
  width: 260px;
  background-color: aqua;
  color: #79bce0;
  font-size: 21px;
  font-family: 黑体;
  line-height: 60px;
  font-weight: bolder;
}
.right_tool { float: right; margin-left: auto; }
.welcome { margin-right: 12px; }
.header { padding: 0; }
</style>
