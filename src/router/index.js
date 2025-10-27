import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'

// 基础页面
import LoginView from '@/views/login/index.vue'
import Layout from '@/views/layout/my_index.vue'
import HomeView from '@/views/home/my_index.vue'

// 业务页面
import ClazzView from '@/views/clazz/index.vue'
import StuView from '@/views/stu/index.vue'
import DeptView from '@/views/dept/index.vue'
import EmpView from '@/views/emp/index.vue'
import AreaView from '@/views/area/index.vue' // ★ 新增：园区管理

// 统计/日志
import EmpReportView from '@/views/report/emp/index.vue'
import StuReportView from '@/views/report/stu/index.vue'
import LogReportView from '@/views/log/index.vue'

// 监控/告警/系统配置
import MonitorView from '@/views/monitor/index.vue'
import AlarmView from '@/views/alarm/index.vue'
import SysConfigView from '@/views/sys/index.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 登录独立路由
    { path: '/login', name: 'login', component: LoginView },

    // 主框架 - 需要登录才能访问
    {
      path: '/',
      component: Layout,
      redirect: '/home',
      meta: { requiresAuth: true }, // 整个主框架都需要认证
      children: [
        { path: 'home', name: 'home', component: HomeView, meta: { title: '首页' } },

        // 业务管理
        { path: 'emp', name: 'emp', component: EmpView, meta: { title: '员工管理' } },
        { path: 'area', name: 'area', component: AreaView, meta: { title: '园区管理' } },

        // 报表/日志
        { path: 'empReport', name: 'empReport', component: EmpReportView, meta: { title: '员工统计' } },
        { path: 'stuReport', name: 'stuReport', component: StuReportView, meta: { title: '学员统计' } },
        { path: 'logReport', name: 'logReport', component: LogReportView, meta: { title: '日志统计' } },

        // 监控/告警/系统配置
        { path: 'monitor', name: 'monitor', component: MonitorView, meta: { title: '实时监控' } },
        { path: 'alarm', name: 'alarm', component: AlarmView, meta: { title: '告警管理' } },
        { path: 'sys', name: 'sys', component: SysConfigView, meta: { title: '系统配置' } }
      ]
    },

    // 兜底：未匹配重定向到登录页面
    { path: '/:pathMatch(.*)*', redirect: '/login' }
  ]
})

// 路由守卫 - 确保未登录用户不能访问受保护的页面
router.beforeEach((to, from, next) => {
  // 检查该路由或其父路由是否需要身份认证（处理嵌套路由）
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  
  if (requiresAuth) {
    // 获取token
    const token = localStorage.getItem('token')
    
    // 如果没有token，重定向到登录页面
    if (!token) {
      ElMessage.warning('请先登录')
      // 避免循环重定向
      if (to.path !== '/login') {
        next('/login')
      } else {
        next()
      }
    } else {
      // 有token，继续访问
      next()
    }
  } else {
    // 不需要身份认证的路由，直接放行
    next()
  }
})

export default router
