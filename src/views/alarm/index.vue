<template>
  <div class="alarm-page">
    <!-- 顶部筛选 -->
    <el-card class="mb-12">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="告警类型">
          <el-select v-model="query.alarm_type" placeholder="全部" clearable style="width: 160px">
            <el-option label="全部" :value="undefined" />
            <el-option
              v-for="(label, val) in AlarmTypeMap"
              :key="val"
              :label="label"
              :value="Number(val)"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="处理状态">
          <el-select v-model="query.alarm_status" placeholder="全部" clearable style="width: 160px">
            <el-option label="全部" :value="undefined" />
            <el-option
              v-for="(label, val) in AlarmStatusMap"
              :key="val"
              :label="label"
              :value="Number(val)"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 原始 JSON（全部数据；仅此区域字体缩小到 0.8） -->
    <el-card class="mb-12 json-card">
      <template #header>
        <div class="card-header">
          <span>原始 JSON（共 {{ allRows.length }} 条）</span>
          <el-button size="small" @click="copyJson">复制 JSON</el-button>
        </div>
      </template>
      <el-input
        class="json-input"
        v-model="jsonText"
        type="textarea"
        :autosize="{ minRows: 10, maxRows: 16 }"
        readonly
      />
    </el-card>

    <!-- 表格 -->
    <el-card>
      <div class="table-actions">
        <div>
          <el-button
            type="danger"
            :disabled="multipleSelection.length === 0"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
        </div>
        <div class="table-total">共 {{ pagination.total }} 条</div>
      </div>

      <el-table
        v-loading="tableLoading"
        :data="tableRows"
        border
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column type="index" label="#" width="60" :index="rowIndex" />
        <!-- 不显示告警ID -->
        <el-table-column prop="alarm_time" label="触发时间" width="170">
          <template #default="{ row }">{{ formatDatetime(row.alarm_time) }}</template>
        </el-table-column>
        <el-table-column prop="park_area" label="园区区域" width="120" />
        <el-table-column prop="camera_name" label="摄像头名称" min-width="180" />

        <el-table-column label="告警类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.alarm_type)" effect="light">
              {{ AlarmTypeMap[row.alarm_type] ?? '未知' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="处理状态" width="170">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.alarm_status)" effect="light">
              {{ AlarmStatusMap[row.alarm_status] ?? '未知' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="handle_user_name" label="处理人" width="120" />

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <!-- 修改点：link 按钮 + 阻止冒泡 -->
            <el-button link type="primary" @click.stop.prevent="openDetail(row)">详情</el-button>
            <el-divider direction="vertical" />
            <el-link type="success" @click="openHandle(row)">处理</el-link>
            <el-divider direction="vertical" />
            <el-popconfirm
              width="220"
              title="确定删除该告警（及其处理记录）吗？"
              @confirm="onDelete(row)"
            >
              <template #reference>
                <el-link type="danger">删除</el-link>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页（前端稳定分页，默认每页10条） -->
      <div class="pagination">
        <el-pagination
          background
          layout="sizes, prev, pager, next"
          :current-page="pagination.page"
          :page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 30, 50]"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <!-- 处理弹窗 -->
    <el-dialog v-model="handleDialog.visible" title="处理告警" width="680px">
      <el-form
        ref="handleFormRef"
        :model="handleDialog.form"
        :rules="handleRules"
        label-width="160px"
      >
        <el-form-item label="选择处理动作" prop="handle_action">
          <el-select v-model="handleDialog.form.handle_action" placeholder="请选择处理动作" style="width: 240px">
            <el-option :value="1" label="派单处理" />
            <el-option :value="0" label="确认误报" />
            <el-option :value="2" label="处理完成" />
          </el-select>
        </el-form-item>

        <el-form-item
          label="指派派单操作员"
          prop="handle_user_id"
          v-if="handleDialog.form.handle_action === 1"
        >
          <el-select
            v-model="handleDialog.form.handle_user_id"
            placeholder="请选择操作员"
            filterable
            :loading="operatorLoading"
            style="width: 240px"
          >
            <el-option
              v-for="u in operatorOptions"
              :key="u.user_id"
              :label="u.name || u.user_name"
              :value="u.user_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="处理备注" prop="handle_detail">
          <el-input
            v-model="handleDialog.form.handle_detail"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入处理备注（如派单对象、解决措施等）"
          />
        </el-form-item>

        <el-form-item label="附件（处理完成可选）">
          <el-upload
            :show-file-list="!!handleDialog.form.attachment_url"
            :http-request="customUpload"
            :before-upload="beforeUpload"
            :on-remove="onRemoveAttachment"
          >
            <el-button type="primary">选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持常见格式，≤10MB</div>
            </template>
          </el-upload>
          <template v-if="handleDialog.form.attachment_url">
            <el-link class="ml-8" :href="handleDialog.form.attachment_url" target="_blank">查看附件</el-link>
          </template>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="handleDialog.submitting" @click="submitHandle">
          提交处理
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailDialog.visible" title="告警详情" width="980px">
      <div class="detail-head">
        <div class="detail-line">
          <span class="label">告警时间：</span>
          <span>{{ formatDatetime(detailDialog.data.alarm_time) }}</span>
        </div>
        <div class="detail-line">
          <span class="label">园区区域+摄像头名称：</span>
          <span>{{ detailDialog.data.park_area }} + {{ detailDialog.data.camera_name }}</span>
        </div>
        <div class="detail-line">
          <span class="label">告警类型：</span>
          <el-tag :type="typeTagType(detailDialog.data.alarm_type)">
            {{ txtType(detailDialog.data.alarm_type) }}
          </el-tag>
        </div>
      </div>

      <div class="detail-media">
        <div class="media-block">
          <div class="media-title">截图：</div>
          <el-image
            v-if="detailDialog.data.snapshot_url"
            :src="detailDialog.data.snapshot_url"
            fit="cover"
            class="shot"
          />
          <div v-else class="shot placeholder">无截图</div>
        </div>
      </div>

      <div class="detail-status">
        <span class="label">当前状态：</span>
        <el-tag :type="statusTagType(detailDialog.data.alarm_status)" effect="light">
          {{ txtStatus(detailDialog.data.alarm_status) }}
        </el-tag>
      </div>

      <el-descriptions :column="2" title="摄像头基本信息" class="mb-12">
        <el-descriptions-item label="摄像头ID">{{ cameraInfo?.camera_id ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ cameraInfo?.camera_name ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="园区区域">{{ cameraInfo?.park_area ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="安装位置">{{ cameraInfo?.install_position ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="分析模式">{{ AnalysisModeMap[cameraInfo?.analysis_mode] ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="摄像头状态">{{ CameraStatusMap[cameraInfo?.camera_status] ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="RTSP">{{ cameraInfo?.rtsp_url ?? '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-records">
        <div class="table-title">处理记录：</div>
        <el-table :data="handleRecords" border>
          <el-table-column prop="handle_time" label="时间" width="180">
            <template #default="{ row }">{{ formatDatetime(row.handle_time || row.create_time) }}</template>
          </el-table-column>
          <el-table-column label="处理人" width="160">
            <template #default="{ row }">
              {{ row.handle_user_name || userNameMap[row.handler_user_id] || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="handle_action" label="处理动作" width="140">
            <template #default="{ row }">
              <el-tag :type="recordActionTagType(row.handle_action)">
                {{ HandleActionMap[row.handle_action] ?? row.handle_action }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="handle_content" label="处理详情" min-width="300" show-overflow-tooltip />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-link
                v-if="row.handle_attachment_url || row.attachment_url"
                :href="row.handle_attachment_url || row.attachment_url"
                target="_blank"
              >下载附件</el-link>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button type="primary" @click="detailDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAlarms,
  deleteAlarms,
  getHandleRecords,
  createHandleRecord,
  uploadAttachment,
  getUsers,
  getCameraInfo
} from '@/api/alarm'

/** —— 映射 —— */
const AlarmTypeMap = { 0: '安全规范', 1: '区域入侵', 2: '火警' }
const AlarmStatusMap = { 0: '未处理', 1: '误报', 2: '处理中（已派单）', 3: '处理完成' }
const HandleActionMap = { 0: '确认误报', 1: '已派单', 2: '处理完成' }
const AnalysisModeMap = { 0: '无', 1: '全部', 2: '安全规范', 3: '区域入侵', 4: '火警' }

/** 颜色：未处理=灰(info)，误报=黄，处理中=蓝，完成=绿 */
const typeTagType = (t) => (t === 2 ? 'danger' : t === 0 ? 'warning' : 'info')
const statusTagType = (s) => s === 0 ? 'info' : s === 1 ? 'warning' : s === 2 ? 'primary' : 'success'
const recordActionTagType = (a) => (a === 2 ? 'success' : a === 1 ? 'primary' : 'warning')

/** 安全文本函数（避免模板复杂表达式导致渲染报错） */
const txtType = (v) => (v in AlarmTypeMap ? AlarmTypeMap[v] : '未知')
const txtStatus = (v) => {
  const k = Number.isFinite(v) ? v : 0
  return AlarmStatusMap[k] || '未知'
}

/** —— 查询与前端稳定分页 —— */
const query = reactive({ alarm_type: undefined, alarm_status: undefined })
const pagination = reactive({ page: 1, size: 10, total: 0 })
const tableLoading = ref(false)
const allRows = ref([])
const allUsers = ref([])
const userNameMap = computed(() => {
  const m = {}; (allUsers.value || []).forEach(u => m[u.user_id] = u.name || u.user_name); return m
})

// 当前页数据
const tableRows = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  const end = start + pagination.size
  return allRows.value.slice(start, end)
})
const rowIndex = (i) => (pagination.page - 1) * pagination.size + i + 1

// JSON（展示全部）
const jsonText = computed(() => JSON.stringify({ total: allRows.value.length, rows: allRows.value }, null, 2))

// 兼容 axios 响应
const extract = (res) => res?.data?.data ?? res?.data ?? res

// 拉全量，稳定排序
const fetchAllData = async () => {
  tableLoading.value = true
  try {
    allRows.value = []
    const LIMIT = 200
    let skip = 0
    for (let i = 0; i < 100; i++) {
      const res = await getAlarms({ alarm_type: query.alarm_type, alarm_status: query.alarm_status, skip, limit: LIMIT })
      const payload = extract(res)
      const total = payload?.total ?? 0
      const rows  = payload?.rows ?? []
      allRows.value.push(...rows)
      if (allRows.value.length >= total || rows.length < LIMIT) break
      skip += LIMIT
    }
    allRows.value.sort((a, b) => {
      const t = (new Date(b.alarm_time || 0)) - (new Date(a.alarm_time || 0))
      return t !== 0 ? t : (b.alarm_id || 0) - (a.alarm_id || 0)
    })
    pagination.total = allRows.value.length
  } finally {
    tableLoading.value = false
  }
}

const loadAllUsers = async () => {
  try {
    const res = await getUsers({ limit: 1000 })
    allUsers.value = extract(res)?.rows || extract(res) || []
  } catch { allUsers.value = [] }
}

const onSearch = () => { pagination.page = 1; fetchAllData() }
const onReset  = () => { query.alarm_type = undefined; query.alarm_status = undefined; onSearch() }
const onPageChange = (p) => (pagination.page = p)
const onSizeChange = (s) => { pagination.size = s; pagination.page = 1 }

/** —— 复制 JSON（全部） —— */
const copyJson = async () => {
  await navigator.clipboard.writeText(jsonText.value)
  ElMessage.success('已复制全部告警 JSON')
}

/** —— 删除 —— */
const multipleSelection = ref([])
const onSelectionChange = (val) => (multipleSelection.value = val)
const onDelete = async (row) => { await deleteByIds([row.alarm_id]) }
const onBatchDelete = async () => {
  const ids = multipleSelection.value.map(r => r.alarm_id)
  if (!ids.length) return
  await deleteByIds(ids)
}
const deleteByIds = async (ids) => {
  await ElMessageBox.confirm(`确定要删除选中的 ${ids.length} 条告警吗？（将级联删除处理记录）`, '提示', { type: 'warning' })
  await deleteAlarms(ids)
  ElMessage.success('删除成功')
  fetchAllData()
}

/** —— 处理弹窗 —— */
const handleDialog = reactive({
  visible: false, submitting: false, row: {},
  form: { alarm_id: undefined, handle_action: undefined, handle_detail: '', handle_user_id: undefined, attachment_url: '' }
})
const handleFormRef = ref()
const operatorOptions = ref([])
const operatorLoading = ref(false)

const handleRules = {
  handle_action: [{ required: true, message: '请选择处理动作', trigger: 'change' }],
  handle_detail : [{ required: true, message: '请输入处理备注', trigger: 'blur' }],
  handle_user_id: [{
    required: true, message: '请选择操作员', trigger: 'change',
    validator: (_, v, cb) => { if (handleDialog.form.handle_action !== 1) return cb(); v ? cb() : cb(new Error('请选择操作员')) }
  }]
}

const openHandle = async (row) => {
  handleDialog.row = row
  handleDialog.form = { alarm_id: row.alarm_id, handle_action: undefined, handle_detail: '', handle_user_id: undefined, attachment_url: '' }
  handleDialog.visible = true

  // 仅拉“操作员”（user_role=2）
  operatorLoading.value = true
  try {
    const res = await getUsers({ user_role: 2, limit: 1000 })
    operatorOptions.value = extract(res)?.rows || extract(res) || []
  } finally { operatorLoading.value = false }
}

// 当前登录用户（取不到使用 id=1, name='Admin'）
const getLoginUser = () => {
  try {
    const idStr = localStorage.getItem('current_user_id')
    const nameStr = localStorage.getItem('current_user_name')
    if (nameStr) return { id: idStr ? Number(idStr) || 1 : 1, name: nameStr }
    if (window.__CURRENT_USER__?.name) {
      return { id: window.__CURRENT_USER__.id ? Number(window.__CURRENT_USER__.id) : 1, name: window.__CURRENT_USER__.name }
    }
  } catch {}
  return { id: 1, name: 'Admin' }
}

const submitHandle = async () => {
  await handleFormRef.value.validate()
  handleDialog.submitting = true
  try {
    const action = handleDialog.form.handle_action
    let handler = { id: 1, name: 'Admin' }
    let detail = (handleDialog.form.handle_detail || '').trim()

    if (action === 1) {
      // 派单：处理人为所选操作员；若备注为空，自动生成
      const op = operatorOptions.value.find(u => u.user_id === handleDialog.form.handle_user_id)
      handler = { id: op?.user_id ?? 1, name: (op?.name || op?.user_name || 'Admin') }
      if (!detail) detail = `派单给操作员：${handler.name}（ID: ${handler.id}）`
    } else {
      // 误报 / 处理完成：处理人为当前登录用户
      handler = getLoginUser()
    }

    // —— 只发 Pydantic 字段，避免 422 —— //
    const payload = {
      alarm_id: handleDialog.form.alarm_id,
      handler_user_id: handler.id,
      handle_action: action,
      handle_content: detail
    }
    const url = handleDialog.form.attachment_url
    if (action === 2 && url) payload.handle_attachment_url = url

    await createHandleRecord(payload)
    ElMessage.success('处理记录提交成功')

    // —— 本地即时回写：处理人 & 状态（派单=2、误报=1、完成=3） —— //
    const row = handleDialog.row
    row.handle_user_name = handler.name
    if (action === 1) row.alarm_status = 2
    else if (action === 0) row.alarm_status = 1
    else if (action === 2) row.alarm_status = 3

    handleDialog.visible = false
    fetchAllData()
  } finally {
    handleDialog.submitting = false
  }
}

/** —— 上传附件 —— */
const beforeUpload = (file) => {
  if (file.size / 1024 / 1024 > 10) { ElMessage.error('文件不能超过 10MB'); return false }
  return true
}
const onRemoveAttachment = () => { handleDialog.form.attachment_url = '' }
const customUpload = async (options) => {
  const { file, onError, onSuccess } = options
  try {
    const base64 = await readAsBase64(file)
    const ext = file.name.split('.').pop()
    const res = await uploadAttachment({ file_content: base64.split(',')[1], file_extension: ext })
    const url = extract(res)
    handleDialog.form.attachment_url = (typeof url === 'string') ? url : url?.data || url?.file_url || ''
    onSuccess(res, file)
  } catch (e) { onError(e) }
}
const readAsBase64 = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) })

/** —— 详情 —— */
const detailDialog = reactive({ visible: false, data: {} })
const handleRecords = ref([])
const cameraInfo = ref(null)

const openDetail = async (row) => {
  detailDialog.data = row
  detailDialog.visible = true

  const rr = await getHandleRecords(row.alarm_id)
  handleRecords.value = extract(rr) || []

  const cc = await getCameraInfo(row.camera_id)
  cameraInfo.value = extract(cc) || null
}

/** —— 工具 —— */
const formatDatetime = (val) => {
  if (!val) return '-'
  try {
    const d = new Date(val); const pad = (n) => (n < 10 ? '0' + n : n)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch { return String(val) }
}

onMounted(async () => {
  await Promise.all([fetchAllData(), loadAllUsers()])
})
</script>

<style scoped>
.alarm-page { padding: 12px; }
.mb-12 { margin-bottom: 12px; }
.filter-form :deep(.el-form-item) { margin-right: 18px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.table-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.table-total { color: var(--el-text-color-secondary); font-size: 13px; }
.pagination { margin-top: 12px; display: flex; justify-content: flex-end; }

/* 仅 JSON 区域缩小字体 */
.json-card { font-size: 0.8em; }
.json-input :deep(.el-textarea__inner) { font-size: 12px; line-height: 1.3; }

/* 详情 */
.detail-head { margin-bottom: 12px; }
.detail-line { margin: 4px 0; font-size: 14px; }
.detail-line .label { color: var(--el-text-color-secondary); margin-right: 8px; }
.detail-media { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0 14px 0; }
.media-block .media-title { margin-bottom: 6px; color: var(--el-text-color-secondary); }
.shot { width: 100%; height: 260px; border-radius: 6px; object-fit: cover; border: 1px solid var(--el-border-color); }
.placeholder { display: flex; align-items: center; justify-content: center; color: var(--el-text-color-secondary); }
.detail-status { margin: 10px 0 12px 0; }
.table-title { margin: 6px 0; font-weight: 500; }
.ml-8 { margin-left: 8px; }
</style>
