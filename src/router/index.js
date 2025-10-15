import { createRouter, createWebHistory } from 'vue-router'

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

    // 主框架
    {
      path: '/',
      component: Layout,
      redirect: '/home',
      children: [
        { path: 'home', name: 'home', component: HomeView, meta: { title: '首页' } },

        // 业务管理
        { path: 'clazz', name: 'clazz', component: ClazzView, meta: { title: '班级管理' } },
        { path: 'stu', name: 'stu', component: StuView, meta: { title: '学员管理' } },
        { path: 'dept', name: 'dept', component: DeptView, meta: { title: '部门管理' } },
        { path: 'emp', name: 'emp', component: EmpView, meta: { title: '员工管理' } },
        { path: 'area', name: 'area', component: AreaView, meta: { title: '园区管理' } }, // ★ 新增路由

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

    // 兜底：未匹配重定向到首页或登录
    { path: '/:pathMatch(.*)*', redirect: '/home' }
  ]
})

export default router
