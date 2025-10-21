<template>
  <div class="alarm-page">
    <!-- 筛选栏 -->
    <el-form :inline="true" :model="filterForm" class="filter-section">
      <el-form-item label="告警类型">
        <el-select v-model="filterForm.alarm_type" placeholder="全部" clearable style="width: 160px">
          <el-option label="安全规范" :value="0" />
          <el-option label="区域入侵" :value="1" />
          <el-option label="火警" :value="2" />
          <el-option label="无" :value="3" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-select v-model="filterForm.alarm_status" placeholder="全部" clearable style="width: 160px">
          <el-option label="未处理" :value="0" />
          <el-option label="误报" :value="1" />
          <el-option label="处理中" :value="2" />
          <el-option label="已处理" :value="3" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="onQuery">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 原始 JSON 显示 -->
    <el-card v-if="rawJsonText" class="json-card">
      <template #header>
        <div class="json-header">
          <div class="json-title">原始 JSON（{{ jsonCount }} 条）</div>
          <el-button size="small" @click="copyRaw">复制 JSON</el-button>
        </div>
      </template>
      <el-input v-model="rawJsonText" type="textarea" :rows="10" readonly />
    </el-card>

    <!-- 表格 -->
    <el-table :data="tableData" border stripe @selection-change="onSelectionChange">
      <el-table-column type="selection" width="50" />
      <el-table-column type="index" label="序号" width="90" :index="(index) => index + 1" />
      <el-table-column prop="alarm_time" label="触发时间" min-width="160" />
      <el-table-column prop="park_area" label="园区区域" min-width="140" />
      <el-table-column prop="camera_name" label="摄像头名称" min-width="160" />

      <!-- 告警类型：彩色标签 -->
      <el-table-column prop="alarm_type" label="告警类型" min-width="120">
        <template #default="{ row }">
          <el-tag :class="typeTagClass(row.alarm_type)" effect="plain">
            {{ alarmTypeText(row.alarm_type) }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 状态：彩色标签 -->
      <el-table-column prop="alarm_status" label="处理状态" min-width="120">
        <template #default="{ row }">
          <el-tag :class="statusTagClass(row.alarm_status)" effect="plain">
            {{ alarmStatusText(row.alarm_status) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="handle_user_name" label="处理人" min-width="120" />

      <!-- 操作列 -->
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDetail(row)">详情</el-button>
          <el-button type="success" link @click="openHandle(row)">处理</el-button>
          <el-popconfirm title="确认删除该记录？" @confirm="delOne(row)">
            <template #reference>
              <el-button type="danger" link>删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pager">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="currentPage"
        :page-sizes="[5, 10, 15, 20, 50]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="告警详情" width="680px" destroy-on-close>
      <template v-if="detailRow">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="告警ID">{{ detailRow.alarm_id }}</el-descriptions-item>
          <el-descriptions-item label="触发时间">{{ detailRow.alarm_time }}</el-descriptions-item>
          <el-descriptions-item label="园区区域">{{ detailRow.park_area || '-' }}</el-descriptions-item>
          <el-descriptions-item label="摄像头">{{ detailRow.camera_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="告警类型" :span="2">
            <el-tag :class="typeTagClass(detailRow.alarm_type)" effect="plain">
              {{ alarmTypeText(detailRow.alarm_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="处理状态" :span="2">
            <el-tag :class="statusTagClass(detailRow.alarm_status)" effect="plain">
              {{ alarmStatusText(detailRow.alarm_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="处理人" :span="2">{{ detailRow.handle_user_name || '-' }}</el-descriptions-item>
        </el-descriptions>

        <div class="shot-box">
          <template v-if="detailRow.snapshot_url">
            <el-image :src="detailRow.snapshot_url" fit="contain" class="shot" />
          </template>
          <template v-else>
            <p class="no-img">暂无截图</p>
          </template>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- ✅ 新增：告警处理弹窗 -->
    <el-dialog v-model="handleVisible" title="处理告警" width="480px">
      <el-form :model="handleForm" label-width="100px">
        <el-form-item label="处理动作">
          <el-select v-model="handleForm.handle_action" placeholder="请选择">
            <el-option label="确认误报" :value="1" />
            <el-option label="开始处理" :value="2" />
            <el-option label="处理完成" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理人姓名">
          <el-input v-model="handleForm.handle_user_name" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" :rows="3" v-model="handleForm.handle_content" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getAlarmsText, getAlarmsJson, deleteAlarms, createAlarmHandleRecord } from '@/api/alarm'

/* 数据与分页 */
const tableData = ref([])
const total = ref(0)
const pageSize = ref(10)
const currentPage = ref(1)
const selection = ref([])

/* JSON展示 */
const rawJsonText = ref('')
const jsonCount = ref(0)

/* 筛选条件 */
const filterForm = reactive({
  alarm_type: null,
  alarm_status: null
})

/* 弹窗 */
const detailVisible = ref(false)
const handleVisible = ref(false)
const detailRow = ref(null)

/* 处理表单 */
const handleForm = reactive({
  alarm_id: null,
  handle_action: null,
  handle_user_name: '',
  handle_content: ''
})

/* 标签映射 */
const alarmTypeText = (t) => ({ 0: '安全规范', 1: '区域入侵', 2: '火警', 3: '无' }[t] ?? '-')

// 定时刷新告警列表，确保及时显示新推送的告警
let refreshTimer = null;
function startAutoRefresh() {
  // 每30秒自动刷新一次告警列表
  refreshTimer = setInterval(() => {
    fetchList();
    console.log('自动刷新告警列表');
  }, 30000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
const alarmStatusText = (s) => ({ 0: '未处理', 1: '误报', 2: '处理中', 3: '已处理' }[s] ?? '-')

/* 彩色标签样式 */
function typeTagClass(t) {
  return {
    2: 'tag-type-fire',
    0: 'tag-type-safety',
    1: 'tag-type-intrude',
    3: 'tag-type-none'
  }[t] || 'tag-type-default'
}
function statusTagClass(s) {
  return {
    0: 'tag-st-unhandled',
    2: 'tag-st-processing',
    3: 'tag-st-done',
    1: 'tag-st-false'
  }[s] || 'tag-st-default'
}

/* 工具 */
function fmtT(v) { return typeof v === 'string' ? v.replace('T', ' ') : v }
function buildParams() {
  const p = { skip: (currentPage.value - 1) * pageSize.value, limit: pageSize.value }
  if (filterForm.alarm_type !== null) p.alarm_type = filterForm.alarm_type
  if (filterForm.alarm_status !== null) p.alarm_status = filterForm.alarm_status
  return p
}
function prettifyAndCount(obj) {
  const d = obj?.data ?? obj
  let count = 0
  if (Array.isArray(d)) count = d.length
  else if (Array.isArray(d?.rows)) count = d.rows.length
  return { pretty: JSON.stringify(obj, null, 2), count }
}

/* 主查询逻辑 */
async function fetchList() {
  const params = buildParams()
  let text = ''
  try {
    const res = await getAlarmsText(params)
    text = typeof res?.data === 'string' ? res.data : ''
  } catch (_) {}
  if (!text || text.trim() === '{}' || text.trim() === '') {
    const res2 = await getAlarmsJson(params)
    const obj2 = res2?.data ?? res2
    const { pretty, count } = prettifyAndCount(obj2)
    rawJsonText.value = pretty
    jsonCount.value = count
    fillTableFromObj(obj2)
    return
  }
  try {
    const obj = JSON.parse(text)
    const { pretty, count } = prettifyAndCount(obj)
    rawJsonText.value = pretty
    jsonCount.value = count
    fillTableFromObj(obj)
  } catch {
    const res2 = await getAlarmsJson(params)
    const obj2 = res2?.data ?? res2
    const { pretty, count } = prettifyAndCount(obj2)
    rawJsonText.value = pretty
    jsonCount.value = count
    fillTableFromObj(obj2)
  }
}

/* 填充表格 */
function fillTableFromObj(obj) {
  const d = obj?.data ?? obj
  const rows = Array.isArray(d?.rows) ? d.rows : (Array.isArray(d) ? d : [])
  tableData.value = rows.map(r => ({
    ...r,
    alarm_time: fmtT(r.alarm_time)
  }))
  total.value = Number(d?.total || rows.length || 0)
}

/* 分页/筛选 */
function onQuery() { currentPage.value = 1; fetchList() }
function onReset() { filterForm.alarm_type = null; filterForm.alarm_status = null; currentPage.value = 1; fetchList() }
function handlePageChange(p) { currentPage.value = p; fetchList() }
function handleSizeChange(size) { pageSize.value = size; currentPage.value = 1; fetchList() }
function onSelectionChange(list) { selection.value = list }
function copyRaw() { navigator.clipboard.writeText(rawJsonText.value || '') }

/* 弹窗：详情 */
function openDetail(row) {
  detailRow.value = row
  detailVisible.value = true
}

/* ✅ 弹窗：处理告警 */
function openHandle(row) {
  handleForm.alarm_id = row.alarm_id
  handleForm.handle_action = null
  handleForm.handle_user_name = ''
  handleForm.handle_content = ''
  handleVisible.value = true
}

/* ✅ 提交处理 */
async function submitHandle() {
  if (!handleForm.handle_action || !handleForm.handle_user_name) {
    return ElMessage.warning('请填写完整的处理信息！')
  }
  try {
    await createAlarmHandleRecord({
      alarm_id: handleForm.alarm_id,
      handle_action: handleForm.handle_action,
      handle_user_name: handleForm.handle_user_name,
      handle_content: handleForm.handle_content
    })
    ElMessage.success('处理成功')
    handleVisible.value = false
    fetchList()
  } catch (e) {
    ElMessage.error('处理失败')
  }
}

/* 删除 */
async function delOne(row) {
  await deleteAlarms([row.alarm_id])
  fetchList()
}

onMounted(() => {
  fetchList();
  startAutoRefresh();
})

// 组件卸载时清除定时器
function onUnmounted() {
  stopAutoRefresh();
}
</script>

<style scoped>
.alarm-page { padding: 16px; }
.filter-section { margin-bottom: 12px; }
.json-card { margin-bottom: 12px; }
.json-header { display: flex; align-items: center; justify-content: space-between; }
.json-title { font-weight: 600; }
.pager { margin-top: 12px; text-align: right; }

/* 彩色标签 */
.tag-type-fire { color: #f56c6c; border-color: #f56c6c; background: #fff5f5; }
.tag-type-safety { color: #e6a23c; border-color: #e6a23c; background: #fff7e8; }
.tag-type-intrude { color: #eebe77; border-color: #eebe77; background: #fffaf0; }
.tag-type-none { color: #909399; border-color: #dcdfe6; background: #f5f7fa; }
.tag-type-default { color: #909399; border-color: #dcdfe6; background: #fafafa; }

.tag-st-unhandled { color: #909399; border-color: #dcdfe6; background: #fafafa; }
.tag-st-processing { color: #409eff; border-color: #409eff; background: #f0f7ff; }
.tag-st-done { color: #67c23a; border-color: #67c23a; background: #f3fbef; }
.tag-st-false { color: #a36df2; border-color: #a36df2; background: #f7f2ff; }
.tag-st-default { color: #909399; border-color: #dcdfe6; background: #fafafa; }

.shot-box { margin-top: 12px; text-align: center; }
.shot { max-width: 100%; max-height: 360px; border-radius: 6px; }
.no-img { color: #aaa; margin-top: 12px; }
</style>
