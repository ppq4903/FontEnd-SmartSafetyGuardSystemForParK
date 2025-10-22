<template>
  <div class="home">
    <!-- 上半部分并列布局 -->
    <div class="top-section">
      <!-- 未处理告警 -->
      <el-card class="alarm-bar" shadow="never" :body-style="{padding:'12px 16px'}">
        <div class="alarm-bar__head">
          <div class="left">
            <span class="badge">未处理告警（{{ pendingTotal }} 条）</span>
          </div>
          <el-button type="primary" link @click="$router.push('/alarm')">查看全部</el-button>
        </div>

        <div class="alarm-list">
          <template v-if="alarms.length">
            <div class="alarm-item" v-for="a in alarms" :key="a.alarm_id">
              <div class="alarm-content">
                <el-tag :type="statusTagType(a.alarm_status)" size="small" effect="dark" round>
                  {{ alarmStatusText(a.alarm_status) }}
                </el-tag>
                <span>【{{ alarmTypeText(a.alarm_type) }}】</span>
                <span class="meta">摄像头：{{ a.camera_name || a.camera_id }}</span>
                <span class="meta">时间：{{ formatTime(a.alarm_time) }}</span>
              </div>
              <el-link v-if="a.snapshot_url" type="primary" :href="firstShot(a.snapshot_url)" target="_blank">
                查看截图
              </el-link>
            </div>
          </template>
          <div v-else class="empty">暂无未处理告警</div>
        </div>
      </el-card>

      <!-- 快捷入口 -->
      <el-card shadow="never">
        <div class="card-head"><el-icon><Compass /></el-icon> 快捷操作</div>
        <div class="spacer"></div>
        <div class="quick-entry">
          <div class="button-row">
            <el-button type="primary" @click="$router.push('/alarm')">告警中心</el-button>
            <el-button @click="$router.push('/monitor')">实时监控</el-button>
          </div>
          <div class="button-row">
            <el-button @click="$router.push('/sys')">摄像头管理</el-button>
            <el-button @click="exportReport">导出报表</el-button>
          </div>
        </div>
      </el-card>
    </div>
    <div class="spacer"></div>
    <!-- 网格区域 -->
    <div class="grid">
      <!-- 今日处理率 -->
      <el-card class="grid-item number-card" shadow="never">
        <div class="card-head"><el-icon><Checked /></el-icon> 今日处理率</div>
        <div class="number">
          已处理 <b>{{ rate.done }}</b> / 总数 <b>{{ rate.total }}</b>，
          未处理 <b>{{ rate.pending }}</b>，
          处理率 <b>{{ (rate.rate * 100).toFixed(1) }}%</b>
        </div>
      </el-card>

      <!-- 摄像头状态（仅纵向分布） -->
      <el-card class="grid-item number-card" shadow="never">
        <div class="card-head"><el-icon><VideoCamera /></el-icon> 摄像头状态</div>

        <div class="cam-status">
          <div class="row" v-for="item in camListSorted" :key="item.label">
            <span class="label" :class="item.class">{{ item.label }}</span>
            <el-link
              :type="item.color"
              :underline="false"
              class="count"
              @click="gotoCamera(item.value)"
            >
              {{ item.count }} 台
            </el-link>
            <el-progress
              :percentage="percent(item.count)"
              :stroke-width="12"
              :show-text="true"
            />
          </div>
          <div class="total">总计：{{ totalCameras }} 台</div>
        </div>
      </el-card>

      <!-- 今日各类告警分布 -->
      <el-card class="grid-item" shadow="never">
        <div class="card-head"><el-icon><Histogram /></el-icon> 今日各类告警分布</div>
        <div id="chart-today" class="chart"></div>
      </el-card>

      <!-- 历史告警汇总 -->
      <el-card class="grid-item" shadow="never">
        <div class="card-head"><el-icon><PieChart /></el-icon> 历史告警汇总</div>
        <div id="chart-total" class="chart"></div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Checked, VideoCamera, Histogram, PieChart, Compass } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart as EPie } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([BarChart, EPie, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

import {
  apiGetRecentUnresolved,
  apiGetAlarms,
  apiGetCameraInfos,
  apiGetCameraStatusReport,
  apiGetTodayHandleReport,
  apiGetTodayReport,
  apiGetAllReport
} from '@/api/home'
import { useRouter } from 'vue-router'
const router = useRouter()

// 顶部与统计数据
const pendingTotal = ref(0)
const alarms = ref([])
const rate = reactive({ rate: 0, done: 0, total: 0, pending: 0 })
const cameraStat = reactive({ online: 0, offline: 0, busy: 0 })

let chartToday, chartTotal

// ========= 工具：统一解析 =========
function pickList (data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.data)) return data.data
  return []
}
function pickNumber (v, d = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

// 报表类：多形态 => {0:n0,1:n1,2:n2}
function normalizeTypeReport (raw) {
  // rows 数组：[{alarm_type,count}] 或 [{name,value}]
  const arr = pickList(raw?.data ?? raw)
  if (arr.length) {
    const out = { 0: 0, 1: 0, 2: 0 }
    arr.forEach(r => {
      const t = r.alarm_type ?? r.type ?? r.name ?? r.label
      const c = pickNumber(r.count ?? r.value ?? r.total, 0)
      const key =
        t === 0 || t === '安全规范' ? 0 :
        t === 1 || t === '区域入侵' ? 1 :
        t === 2 || t === '火警'     ? 2 :
        Number(t)
      if (key === 0 || key === 1 || key === 2) out[key] += c
    })
    return out
  }
  // 对象：{0:n,1:n,2:n} 或 {安全规范:n,...}
  const d = raw?.data ?? raw ?? {}
  return {
    0: pickNumber(d['0'] ?? d['安全规范'], 0),
    1: pickNumber(d['1'] ?? d['区域入侵'], 0),
    2: pickNumber(d['2'] ?? d['火警'], 0)
  }
}

// 摄像头状态：{online,offline,busy} 或由列表聚合
function normalizeCameraStat (raw, fallbackList = []) {
  if (raw && (raw.online != null || raw.offline != null)) {
    return {
      online: pickNumber(raw.online, 0),
      offline: pickNumber(raw.offline, 0),
      busy: pickNumber(raw.busy ?? raw.analyzing, 0)
    }
  }
  const rows = fallbackList.length ? fallbackList : pickList(raw)
  const stat = { online: 0, offline: 0, busy: 0 }
  rows.forEach(r => {
    const s = Number(r.camera_status)
    if (s === 1) stat.online++
    else if (s === 0) stat.offline++
    else if (s === 2) stat.busy++
  })
  return stat
}

// ========= 文本映射 =========
const ALARM_TYPE_MAP = { 0: '安全规范', 1: '区域入侵', 2: '火警', 3: '无' }
const ALARM_STATUS_MAP = { 0: '未处理', 1: '误报', 2: '处理中', 3: '处理完成' }
const CAMERA_STATUS_MAP = { 0: '离线', 1: '在线', 2: '忙碌' }
const alarmTypeText = (t) => (ALARM_TYPE_MAP[t] ?? '未知类型')
const alarmStatusText = (s) => (ALARM_STATUS_MAP[s] ?? '未知')
const statusTagType = (v) => ({ 0: 'danger', 1: 'success', 2: 'warning' }[v] ?? 'info')

// ========= 其它工具 =========
function firstShot (url) {
  return String(url || '').split(',')[0]
}
function formatTime (val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} `
      + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  } catch { return val }
}

// ========= 摄像头纵向分布（排序+跳转） =========
const camListSorted = computed(() => {
  const list = [
    { label: '在线', value: 1, color: 'success', class: 'text-online', count: cameraStat.online },
    { label: '离线', value: 0, color: 'danger',  class: 'text-offline', count: cameraStat.offline },
    { label: '忙碌', value: 2, color: 'warning', class: 'text-busy',   count: cameraStat.busy }
  ]
  return list.sort((a, b) => b.count - a.count)
})

const totalCameras = computed(() => cameraStat.online + cameraStat.offline + cameraStat.busy)
const percent = (v) => {
  const t = totalCameras.value || 0
  return t ? Math.round((Number(v) / t) * 100) : 0
}

function gotoCamera (status) {
  router.push({ path: '/sys', query: { camera_status: status } })
}

// ========= 图表 =========
function renderCharts (todayCounts, totalCounts) {
  const el1 = document.getElementById('chart-today')
  const el2 = document.getElementById('chart-total')
  if (!chartToday) chartToday = echarts.init(el1)
  if (!chartTotal) chartTotal = echarts.init(el2)

  const t = {
    安全规范: todayCounts[0] || 0,
    区域入侵: todayCounts[1] || 0,
    火警:     todayCounts[2] || 0
  }
  chartToday.setOption({
    tooltip: {},
    xAxis: { type: 'category', data: Object.keys(t) },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: Object.values(t) }]
  })

  const h = {
    安全规范: totalCounts[0] || 0,
    区域入侵: totalCounts[1] || 0,
    火警:     totalCounts[2] || 0
  }
  chartTotal.setOption({
    tooltip: { trigger: 'item' },
    legend: { top: 'bottom' },
    series: [
      {
        type: 'pie',
        radius: '60%',
        data: [
          { name: '安全规范', value: h.安全规范 },
          { name: '区域入侵', value: h.区域入侵 },
          { name: '火警', value: h.火警 }
        ]
      }
    ]
  })
}

// ========= 工具：日期处理 =========
function isToday(dateString) {
  try {
    const date = new Date(dateString)
    const today = new Date()
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate()
  } catch {
    return false
  }
}

// ========= 加载 =========
async function loadData () {
  // 1) 顶部未解决（含未处理/处理中）- 直接使用apiGetAlarms获取所有告警并筛选
  // 添加分页参数以确保获取所有告警数据
  const all = await apiGetAlarms({ page: 1, limit: 1000 }).catch(() => ({}))
  let unresolved = pickList(all?.data ?? all)
  
  // 过滤出未处理和处理中的告警
  unresolved = unresolved.filter(alarm => alarm.alarm_status === 0 || alarm.alarm_status === 2)
  
  // 确保显示所有未处理告警
  alarms.value = unresolved
  pendingTotal.value = unresolved.length

  // 2) 获取所有告警记录用于筛选当日数据
  // 添加分页参数以获取所有告警数据
  const allAlarms = await apiGetAlarms({ page: 1, limit: 1000 }).catch(() => ({}))
  const allAlarmRows = pickList(allAlarms?.data ?? allAlarms)
  
  // 筛选今日告警记录
  const todayAlarms = allAlarmRows.filter(alarm => isToday(alarm.alarm_time))
  
  // 3) 今日处理率 - 根据筛选后的当日告警计算
  const todayTotal = todayAlarms.length
  const todayDone = todayAlarms.filter(alarm => alarm.alarm_status === 3 || alarm.alarm_status === 1).length // 处理完成或误报
  const todayPending = todayTotal - todayDone
  
  rate.done = todayDone
  rate.total = todayTotal
  rate.pending = todayPending
  rate.rate = todayTotal ? todayDone / todayTotal : 0

  // 4) 摄像头状态（优先接口，否则回退聚合）
  let statObj = {}
  try {
    // 简化API调用
    const s = await apiGetCameraStatusReport()
    statObj = normalizeCameraStat(s?.data ?? s)
  } catch {}
  if (!statObj.online && !statObj.offline && !statObj.busy) {
    // 添加分页参数以获取所有摄像头数据
    const cams = await apiGetCameraInfos({ page: 1, limit: 1000 }).catch(() => ({}))
    const rows = pickList(cams?.data ?? cams)
    statObj = normalizeCameraStat(null, rows)
  }
  cameraStat.online = statObj.online
  cameraStat.offline = statObj.offline
  cameraStat.busy = statObj.busy

  // 5) 今日各类告警分布 - 根据筛选后的当日告警计算
  const todayCounts = todayAlarms.reduce((acc, alarm) => {
    const t = Number(alarm.alarm_type)
    if (t === 0 || t === 1 || t === 2) acc[t]++
    return acc
  }, { 0: 0, 1: 0, 2: 0 })
  
  // 历史告警汇总
  let totalCounts = { 0: 0, 1: 0, 2: 0 }
  const totalRep = await apiGetAllReport().catch(() => ({}))
  if (totalRep) {
    totalCounts = normalizeTypeReport(totalRep)
  }
  
  // 若历史汇总全为 0，则回退到告警列表聚合
  if ((totalCounts[0] + totalCounts[1] + totalCounts[2]) === 0) {
    totalCounts = allAlarmRows.reduce((acc, r) => {
      const t = Number(r.alarm_type)
      if (t === 0 || t === 1 || t === 2) acc[t]++
      return acc
    }, { 0: 0, 1: 0, 2: 0 })
  }

  renderCharts(todayCounts, totalCounts)
}

async function exportReport () {
  try {
    const rows = []
    rows.push('栏目,字段,数值')
    rows.push(`今日处理率,已处理,${rate.done}`)
    rows.push(`今日处理率,总数,${rate.total}`)
    rows.push(`今日处理率,未处理,${rate.pending}`)
    rows.push(`今日处理率,处理率,${(rate.rate * 100).toFixed(1)}%`)
    rows.push(`摄像头状态,在线,${cameraStat.online}`)
    rows.push(`摄像头状态,离线,${cameraStat.offline}`)
    rows.push(`摄像头状态,忙碌,${cameraStat.busy}`)

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `home_report_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.home{display:flex;flex-direction:column;gap:12px}
.top-section{display:flex;gap:12px}

/* 顶部告警条 */
.alarm-bar__head{display:flex;justify-content:space-between;align-items:center}
.badge{display:inline-block;background:#fef0f0;color:#f56c6c;border-radius:2px;padding:2px 8px}
.alarm-list{margin-top:8px;display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#dcdfe6 #f0f2f5}.alarm-list::-webkit-scrollbar{width:6px}.alarm-list::-webkit-scrollbar-track{background:#f0f2f5}.alarm-list::-webkit-scrollbar-thumb{background:#dcdfe6}
.alarm-item{display:flex;align-items:center;gap:8px}
.alarm-content{display:flex;align-items:center;gap:8px;flex:1;flex-wrap:nowrap}
.alarm-content > span:first-of-type{flex-shrink:0}
.alarm-content > span.meta:first-of-type{margin-left:0;flex-shrink:0;min-width:180px}
.alarm-content > span.meta:last-of-type{margin-left:0;flex-shrink:0}
.alarm-item .meta{color:#909399}
.alarm-bar{flex:1;max-width:70%}
.top-section > .el-card:last-child{flex:1;max-width:30%}

/* 间隔 */
.spacer{height:8px}

/* 布局与卡片 */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid-item.number-card{height:150px}.grid-item:nth-child(3),.grid-item:nth-child(4){height:300px}
.grid-item{height:100%}
.card-head{display:flex;align-items:center;gap:8px;font-weight:600}
.chart{height:240px}

/* 数字卡片 */
.number-card .number{font-size:14px}
.number-card b{font-size:18px;margin:0 4px}

/* 摄像头状态卡片（纵向分布） */
.cam-status { display:flex; flex-direction:column; gap:12px; padding:4px 12px 8px 0 }
.cam-status .row { display:grid; grid-template-columns:60px 100px 1fr; align-items:center; gap:12px }
.cam-status .label { font-weight:600; color:#606266 }
.cam-status .text-online{ color:#67C23A }
.cam-status .text-offline{ color:#F56C6C }
.cam-status .text-busy{ color:#E6A23C }
.cam-status .count { font-weight:700; cursor:pointer }
.cam-status .total { text-align:right; color:#909399 }

/* 快捷入口 */
.quick-entry{display:flex;flex-direction:column;gap:12px}
.button-row{display:flex;gap:16px}
.button-row .el-button{flex:1}
</style>
