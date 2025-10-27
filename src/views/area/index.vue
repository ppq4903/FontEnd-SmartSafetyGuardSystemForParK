<template>
  <div class="page-area">
    <!-- 顶部操作+筛选 -->
    <div class="actionbar-wrap">
      <div class="actionbar">
        <div class="left">
          <el-button type="primary" icon="el-icon-plus" @click="openAdd">新增区域</el-button>
          <el-button
            type="danger"
            icon="el-icon-delete"
            :disabled="multipleSelection.length === 0"
            @click="confirmBatchDelete"
          >批量删除</el-button>
        </div>

        <div class="right">
          <el-form :inline="true" :model="query" class="compact-form" @keyup.enter.native="onSearch">
            <el-form-item>
              <el-input
                v-model.trim="query.park_area"
                placeholder="园区区域（支持模糊查询）"
                clearable
                class="w-320"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onSearch">查询</el-button>
              <el-button @click="onReset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>

    <!-- JSON区域已隐藏 -->

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="tableData"
        border
        v-loading="loading"
        @selection-change="(rows)=>multipleSelection = rows"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column type="index" label="序号" width="80" :index="(index) => index + 1" />
        <el-table-column prop="park_area" label="园区区域" min-width="240" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="260" show-overflow-tooltip />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">{{ formatTime(row.update_time) }}</template>
        </el-table-column>

        <!-- ✅ 新的操作列 -->
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" plain size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" plain size="small" @click="confirmDelete(row.park_area_id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="page"
          :page-size="limit"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="(p)=>{ page = p; fetchAndRender() }"
          @size-change="(s)=>{ limit = s; page = 1; fetchAndRender() }"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="isEdit ? '编辑园区区域' : '新增园区区域'"
               v-model="dialogVisible"
               width="520px"
               :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="园区区域" prop="park_area">
          <el-input v-model="form.park_area" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import { selectPage, addNewArea, update, deleteArea } from '@/api/area'

export default {
  name: 'AreaIndex',
  data () {
    return {
      // rawText 已移除
      loading: false,
      saving: false,
      query: { park_area: '' },
      page: 1,
      limit: 10,
      total: 0,
      tableData: [],
      multipleSelection: [],
      dialogVisible: false,
      isEdit: false,
      form: { park_area_id: null, park_area: '', remark: '' },
      rules: {
        park_area: [
          { required: true, message: '请输入园区区域名称', trigger: 'blur' },
          { min: 1, max: 50, message: '长度 1~50', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    // JSON相关计算属性已移除
  },
  created () { this.fetchAndRender() },
  methods: {
    formatTime (v) { return v ? String(v).replace('T', ' ').replace(/Z$/, '') : '' },
    async fetchAndRender () {
      try {
        await this.fetchData()
      } catch (e) {
        const err = {
          message: e?.message, status: e?.response?.status,
          url: e?.config?.url, data: e?.response?.data
        }
        ElMessage.error(`接口访问异常，Status：${err.status || '-'}，${e?.message || ''}`)
      }
    },
    async fetchData () {
      this.loading = true
      try {
        const params = {
          park_area: this.query.park_area || undefined,
          skip: (this.page - 1) * this.limit, limit: this.limit
        }
        const { data } = await selectPage(params)
        const total = data?.data?.total ?? data?.total ?? 0
        const rows = data?.data?.rows ?? data?.rows ?? []
        this.total = total
        this.tableData = rows
        return { data: { total, rows } }
      } finally { this.loading = false }
    },
    onSearch () { this.page = 1; this.fetchAndRender() },
    onReset () { this.query.park_area = ''; this.onSearch() },
    openAdd () {
      this.isEdit = false
      this.form = { park_area_id: null, park_area: '', remark: '' }
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.formRef?.clearValidate())
    },
    openEdit (row) {
      this.isEdit = true
      this.form = {
        park_area_id: row.park_area_id,
        park_area: row.park_area,
        remark: row.remark
      }
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.formRef?.clearValidate())
    },
    // 新增/编辑保存
    submitForm () {
      this.$refs.formRef.validate(async (valid) => {
        if (!valid) return
        this.saving = true
        try {
          // 检查园区名称是否已存在
          const checkParams = { park_area: this.form.park_area, skip: 0, limit: 1 }
          const { data: checkData } = await selectPage(checkParams)
          const existingRows = checkData?.data?.rows || checkData?.rows || []
          
          // 编辑模式下排除当前编辑的记录
          const isExisting = existingRows.some(row => {
            if (this.isEdit) {
              return row.park_area_id !== this.form.park_area_id
            }
            return true
          })
          
          if (existingRows.length > 0 && isExisting) {
            ElMessage.warning('该园区区域已存在')
            return
          }
          
          // 原有保存逻辑
          if (this.isEdit) {
            await update(this.form)
            ElMessage.success('更新成功')
          } else {
            await addNewArea(this.form)
            ElMessage.success('新增成功')
          }
          this.dialogVisible = false
          if (!this.isEdit) this.page = 1
          this.fetchAndRender()
        } catch (e) {
          ElMessage.error(e?.response?.data?.message || e?.message || '保存失败')
        } finally { this.saving = false }
      })
    },
    // 单个删除确认
    confirmDelete (id) {
      ElMessageBox.confirm('确认删除该园区区域？', '提示', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => this.handleDelete(id)).catch(() => {})
    },
    async handleDelete (id) {
      try {
        await deleteArea(String(id))
        ElMessage.success('删除成功')
        const remain = this.tableData.length - 1
        if (remain <= 0 && this.page > 1) this.page -= 1
        this.fetchAndRender()
      } catch (e) {
        ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
      }
    },
    confirmBatchDelete () {
      const ids = this.multipleSelection.map(r => r.park_area_id)
      if (ids.length === 0) return
      ElMessageBox.confirm(`确认批量删除选中的 ${ids.length} 条记录？`, '提示', {
        confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
      }).then(async () => {
        try {
          await deleteArea(ids)
          ElMessage.success('删除成功')
          if (this.page > 1 && this.multipleSelection.length >= this.tableData.length) this.page -= 1
          this.fetchAndRender()
        } catch (e) {
          ElMessage.error(e?.response?.data?.message || e?.message || '删除失败')
        }
      }).catch(() => {})
    },
    // JSON复制功能已移除
  }
}
</script>

<style scoped>
.page-area { padding: 12px; }

/* 顶部操作区 */
.actionbar-wrap {
  padding: 6px 0 2px;
  margin-bottom: 6px;
  border: none;
}
.actionbar { display: flex; justify-content: space-between; align-items: center; }
.left { display: flex; gap: 8px; }
.right { display: flex; align-items: center; }
.compact-form :deep(.el-form-item) { margin-bottom: 0; margin-right: 8px; }
.w-320 { width: 320px; }

/* JSON相关样式已移除 */

/* 表格 */
.table-card { margin-top: 10px; }
.pager { margin-top: 10px; text-align: right; }
</style>
