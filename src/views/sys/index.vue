<template>
  <div class="page-wrap">
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增摄像头</el-button>
      <el-button type="danger" plain :disabled="!multipleSelection.length" @click="handleBatchDelete">批量删除</el-button>

      <div class="spacer"></div>

      <!-- 分析模式 -->
      <div class="filter-item">
        <label class="filter-label">分析模式：</label>
        <el-select
          v-model="query.analysis_mode"
          placeholder="所有模式"
          clearable
          class="w-150"
          @clear="onSearch"
        >
          <el-option v-for="m in analysisModes" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
      </div>

      <!-- 状态 -->
      <div class="filter-item">
        <label class="filter-label">状态：</label>
        <el-select
          v-model="query.camera_status"
          placeholder="所有状态"
          clearable
          class="w-150"
          @clear="onSearch"
        >
          <el-option v-for="s in statusList" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </div>

      <el-input
        v-model="query.camera_name"
        placeholder="摄像头名称"
        clearable
        class="w-200 ml8"
      />

      <el-button type="primary" class="ml8" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <el-card class="json-card" shadow="never">
      <template #header>
        <div class="json-card-header">
          <span class="card-title">原始 JSON（{{ total }} 条）</span>
          <el-button size="small" @click="copyJson">复制 JSON</el-button>
        </div>
      </template>
      <el-input class="json-area" type="textarea" :rows="10" v-model="rawJson" readonly />
    </el-card>

    <el-table
      v-loading="loading"
      :data="tableData"
      row-key="camera_id"
      border
      style="width:100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="44" />
      <el-table-column prop="camera_name" label="摄像头名称" min-width="140" />
      <el-table-column prop="park_area" label="所属园区位置" min-width="120" />
      <el-table-column prop="install_position" label="具体安装位置" min-width="140" />
      <el-table-column prop="rtsp_url" label="RTSP 地址" min-width="200" show-overflow-tooltip />

      <el-table-column label="分析模式" min-width="100">
        <template #default="{ row }">
          <el-tag :type="analysisTagType(row.analysis_mode)" effect="light">{{ analysisLabel(row.analysis_mode) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="状态" min-width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.camera_status)" effect="light">{{ statusLabel(row.camera_status) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="create_time" :formatter="formatTime" label="录入时间" min-width="150" />
      <el-table-column prop="update_time" :formatter="formatTime" label="上次更新时间" min-width="150" />

      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div>
              <el-button size="small" @click="openEditDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
            <div>
              <el-button size="small" @click="handleTest(row)" style="width: 118px;">
                {{ testingMap[row.camera_id] ? '测试中' : '测试连接' }}
              </el-button>
            </div>
            <div>
              <el-button size="small" type="success" @click="handleStart(row)" style="width: 56px;">开启检测</el-button>
              <el-button size="small" type="warning" @click="handleStop(row)" style="width: 56px;">关闭检测</el-button>
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-sizes="[10, 20, 28, 50, 100]"
        :page-size="pageSize"
        :current-page="page"
        @size-change="onSizeChange"
        @current-change="onPageChange"
      />
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="摄像头名称" prop="camera_name">
          <el-input v-model="form.camera_name" maxlength="50" show-word-limit placeholder="必填" />
        </el-form-item>

        <el-form-item label="所属园区ID" prop="park_area_id">
          <el-input-number v-model="form.park_area_id" :min="1" :max="999999" controls-position="right" placeholder="必填(数字)" />
        </el-form-item>

        <el-form-item label="具体安装位置" prop="install_position">
          <el-input v-model="form.install_position" maxlength="100" show-word-limit placeholder="必填" />
        </el-form-item>

        <el-form-item label="RTSP 地址" prop="rtsp_url">
          <el-input v-model="form.rtsp_url" placeholder="格式：rtsp://用户名:密码@IP:端口/流地址" />
        </el-form-item>

        <el-form-item label="分析模式" prop="analysis_mode">
          <el-select v-model="form.analysis_mode" placeholder="请选择">
            <el-option v-for="m in analysisModes" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="状态" prop="camera_status">
          <el-select v-model="form.camera_status" placeholder="请选择">
            <el-option v-for="s in statusList" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible=false" :disabled="submitLoading">取 消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="onSubmit">{{ isEdit ? '保 存' : '创 建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCameraList, fetchFramePing,
  startAnalysis, stopAnalysis,
  getCameraById, createCamera, updateCamera
} from '@/api/monitor'

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tableData = ref([])
const rawJson = ref('[]')
const multipleSelection = ref([])
const testingMap = reactive({})

// —— 查询条件（为空=全部） —— //
const query = reactive({
  analysis_mode: undefined,  // undefined/null => 全部
  camera_status: undefined,  // undefined/null => 全部
  camera_name: ''
})

const analysisModes = ref([
  { label: '无', value: 0 },
  { label: '全部', value: 1 },
  { label: '安全规范', value: 2 },
  { label: '区域入侵', value: 3 },
  { label: '火警', value: 4 }
])
const statusList = ref([
  { label: '离线', value: 0 },
  { label: '忙碌（安全分析中）', value: 2 },
  { label: '在线', value: 1 }
])

const ANALYSIS_MAP = { 0: '无', 1:'全部', 2: '安全规范', 3: '区域入侵', 4: '火警' }
const STATUS_MAP   = { 0: '离线', 1: '在线', 2: '忙碌（安全分析中）' }
const analysisLabel = v => ANALYSIS_MAP[v] ?? v
const statusLabel   = v => STATUS_MAP[v] ?? v
const analysisTagType = v => ({ 0: 'info', 1: 'success', 2: 'warning', 3: 'danger' }[v] ?? 'info')
const statusTagType   = v => ({ 0: 'danger', 1: 'success', 2: 'warning' }[v] ?? 'info')

onMounted(() => { loadData(true) })

function handleSelectionChange (rows) { multipleSelection.value = rows }
async function onSearch () { await loadData(true) }
async function onReset () {
  query.analysis_mode = undefined
  query.camera_status = undefined
  query.camera_name = ''
  await loadData(true)
}
async function onSizeChange (val) { pageSize.value = val; page.value = 1; await loadData() }
async function onPageChange (val) { page.value = val; await loadData() }
function copyJson () { navigator.clipboard?.writeText(rawJson.value); ElMessage.success('JSON 已复制') }

async function loadData (reset = false) {
  if (reset) page.value = 1
  loading.value = true
  try {
    const keyword = (query.camera_name || '').trim()
    const needLocalFilter = !!keyword
    const reqPage = needLocalFilter ? 1 : page.value
    const reqSize = needLocalFilter ? 100000 : pageSize.value

    const { rows, total: t } = await fetchCameraList({
      analysis_mode: query.analysis_mode ?? undefined,
      camera_status: query.camera_status ?? undefined,
      camera_name: keyword || undefined,
      page: reqPage,
      page_size: reqSize
    })

    const normalized = (Array.isArray(rows) ? rows : []).map(it => {
      const o = { ...it }
      if (o.park_area_park_area && !o.park_area) o.park_area = o.park_area_park_area
      return o
    })

    if (needLocalFilter) {
      const kw = keyword.toLowerCase()
      const filtered = normalized.filter(r => (r.camera_name || '').toLowerCase().includes(kw))
      total.value = filtered.length
      const start = (page.value - 1) * pageSize.value
      tableData.value = JSON.parse(JSON.stringify(filtered.slice(start, start + pageSize.value)))
      rawJson.value = JSON.stringify({ total: total.value, rows: filtered.slice(start, start + pageSize.value) }, null, 2)
    } else {
      tableData.value = JSON.parse(JSON.stringify(normalized))
      total.value = Number.isFinite(t) ? t : normalized.length
      rawJson.value = JSON.stringify({ total: total.value, rows: normalized }, null, 2)
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '查询失败')
    tableData.value = []
    total.value = 0
    rawJson.value = '[]'
  } finally {
    loading.value = false
  }
}

// —— 新增 / 编辑 —— //
const dialogVisible = ref(false)
const dialogTitle = ref('新增摄像头')
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = reactive({
  camera_id: undefined,
  camera_name: '',
  park_area_id: undefined,
  install_position: '',
  rtsp_url: '',
  analysis_mode: 0,
  camera_status: 1
})
const rtspPattern = /^rtsp:\/\/[^:\s]+:[^@\s]+@[\d.]+:\d+\/.+/i
const rules = {
  camera_name: [{ required: true, message: '请输入摄像头名称', trigger: 'blur' }],
  park_area_id: [{ required: true, message: '请输入所属园区ID', trigger: 'change' }],
  install_position: [{ required: true, message: '请输入具体安装位置', trigger: 'blur' }],
  rtsp_url: [
    { required: true, message: '请输入 RTSP 地址', trigger: 'blur' },
    { validator: (_r, v, cb) => (rtspPattern.test(v) ? cb() : cb(new Error('RTSP 地址格式不正确'))), trigger: 'blur' }
  ],
  analysis_mode: [{ required: true, message: '请选择分析模式', trigger: 'change' }],
  camera_status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}
function resetFormValues () {
  form.camera_id = undefined
  form.camera_name = ''
  form.park_area_id = undefined
  form.install_position = ''
  form.rtsp_url = ''
  form.analysis_mode = 0
  form.camera_status = 1
  formRef.value?.clearValidate?.()
}
function openCreateDialog () {
  isEdit.value = false
  dialogTitle.value = '新增摄像头'
  resetFormValues()
  dialogVisible.value = true
}
async function openEditDialog (row) {
  isEdit.value = true
  dialogTitle.value = '编辑摄像头'
  resetFormValues()
  try {
    const res = await getCameraById(row.camera_id)
    Object.assign(form, res?.data ?? res ?? row)
  } catch {
    Object.assign(form, row)
  }
  dialogVisible.value = true
}
async function onSubmit () {
  await formRef.value.validate()
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateCamera(form.camera_id, {
        camera_name: form.camera_name,
        park_area_id: form.park_area_id,
        install_position: form.install_position,
        rtsp_url: form.rtsp_url,
        analysis_mode: form.analysis_mode,
        camera_status: form.camera_status
      })
      ElMessage.success('已保存')
      dialogVisible.value = false
      await loadData(false)
    } else {
      await createCamera({
        camera_name: form.camera_name,
        park_area_id: form.park_area_id,
        install_position: form.install_position,
        rtsp_url: form.rtsp_url,
        analysis_mode: form.analysis_mode,
        camera_status: form.camera_status
      })
      ElMessage.success('创建成功')
      dialogVisible.value = false
      await loadData(true)
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || (isEdit.value ? '保存失败' : '创建失败'))
  } finally {
    submitLoading.value = false
  }
}

// 其它操作
async function handleTest (row) {
  testingMap[row.camera_id] = true
  try { await fetchFramePing(row.camera_id); ElMessage.success('连接成功') }
  catch (e) { ElMessage.error(e?.response?.data?.message || e?.message || '连接失败') }
  finally { testingMap[row.camera_id] = false }
}
async function handleStart (row) { try { await startAnalysis(row.camera_id); ElMessage.success('已开启检测') } catch (e) { ElMessage.error(e?.message || '开启失败') } }
async function handleStop (row) { try { await stopAnalysis(row.camera_id); ElMessage.success('已关闭检测') } catch (e) { ElMessage.error(e?.message || '关闭失败') } }
function formatTime (_r, _c, cell) { return cell ? String(cell).replace('T', ' ') : '' }
function handleBatchDelete () { ElMessage.info('请在此接入批量删除接口') }
function handleDelete () { ElMessage.info('请在此接入删除接口') }
</script>

<style scoped>
.page-wrap { padding: 12px 16px 20px; }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.spacer { flex: 1; }
.w-150 { width: 150px; }
.w-200 { width: 200px; }
.ml8 { margin-left: 8px; }

/* 说明文字样式 */
.filter-item { display: flex; align-items: center; margin-left: 12px; }
.filter-label { font-size: 14px; color: #606266; margin-right: 6px; white-space: nowrap; }

.json-card { margin-bottom: 12px; }
.json-card-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-weight: 600; }
.json-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  background: #f7f8fa;
  border-radius: 8px;
}
.pager { display: flex; justify-content: flex-end; padding: 10px 6px 2px; }
:deep(.el-tag) { margin-right: 4px; }
</style>
