<template>
  <div class="page-emp">
    <!-- 原始返回（只读） -->
    <el-card shadow="never" class="mb-12">
      <div class="topline">
        <div class="title">接口原始返回（只读）</div>
        <div>
          <el-button size="small" type="primary" @click="fetchAndRender">刷新</el-button>
        </div>
      </div>
      <el-input type="textarea" :rows="6" v-model="rawText" readonly />
    </el-card>

    <h2 class="page-title">员工管理</h2>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="left">
        <el-button type="primary" icon="el-icon-plus" @click="onAdd">新增员工</el-button>
        <el-button type="danger" :disabled="multipleSelection.length===0" @click="onBatchDelete">
          批量删除
        </el-button>
      </div>
      <div class="right">
        <el-input
          v-model.trim="queryForm.name"
          placeholder="按姓名/账号/电话搜索"
          prefix-icon="el-icon-search"
          @keyup.enter="onSearch"
          clearable
          class="w-260"
        />
        <el-select v-model="queryForm.role" placeholder="全部角色" clearable class="w-160">
          <el-option label="全部角色" :value="''" />
          <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
        <el-button type="primary" class="ml-8" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </div>

    <!-- 表格（前端分页：一次取全，再做筛选/排序/分页） -->
    <el-table
      :data="pageRows"
      border
      stripe
      v-loading="loading"
      @selection-change="handleSelectionChange"
      @sort-change="onSortChange"
      :header-cell-style="{ background:'#fafafa' }"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column prop="id" label="员工ID" width="90" sortable="custom" />
      <el-table-column prop="user_name" label="账号" min-width="120" sortable="custom" />
      <el-table-column prop="name" label="姓名" min-width="120" sortable="custom" />
      <el-table-column prop="roleLabel" label="角色" min-width="140" />
      <el-table-column prop="phone" label="联系电话" min-width="140" />
      <el-table-column prop="create_time" label="录入时间" min-width="180" sortable="custom" />
      <el-table-column label="操作" fixed="right" width="190">
        <template #default="{row}">
          <el-button size="mini" type="primary" @click="onEdit(row)">编辑</el-button>
          <el-button size="mini" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="filteredTotal"
        :page-sizes="[5,10,20,50,100]"
        :page-size="pageSize"
        :current-page="currentPage"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 新增 / 编辑 -->
    <el-dialog
      :title="dialogMode==='add' ? '新增员工' : '编辑员工'"
      v-model="dialogVisible"
      width="560px"
      @close="onDialogClose"
    >
      <el-form ref="empFormRef" :model="empForm" :rules="empRules" label-width="96px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model.trim="empForm.name" maxlength="20" />
        </el-form-item>
        <el-form-item label="账号" prop="user_name">
          <el-input v-model.trim="empForm.user_name" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色" prop="user_role">
          <el-select v-model="empForm.user_role" placeholder="请选择角色">
            <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.raw" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="empForm.gender">
            <el-radio :label="1">男</el-radio>
            <el-radio :label="0">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model.trim="empForm.phone" maxlength="11" />
        </el-form-item>

        <!-- 新增：必须填初始密码 -->
        <el-form-item v-if="dialogMode==='add'" label="初始密码" prop="password">
          <el-input v-model.trim="empForm.password" show-password maxlength="32" />
        </el-form-item>

        <!-- 编辑：可选修改密码 -->
        <template v-else>
          <el-form-item label="修改密码">
            <el-switch v-model="empForm.resetPassword" />
          </el-form-item>
          <el-form-item v-if="empForm.resetPassword" label="新密码" prop="password">
            <el-input v-model.trim="empForm.password" show-password maxlength="32" />
          </el-form-item>
          <el-form-item v-if="empForm.resetPassword" label="确认新密码" prop="confirmPassword">
            <el-input v-model.trim="empForm.confirmPassword" show-password maxlength="32" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" :disabled="saving" :loading="saving" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { selectPage, addNewEmp, update, deleteEmp, selectById } from '@/api/emp'

export default {
  name: 'EmpIndex',
  data () {
    return {
      loading: false,
      saving: false,

      // 原始 JSON
      rawText: '',

      // 前端全量数据
      allRows: [],

      // 分页/排序/筛选（前端）
      pageSize: 10,
      currentPage: 1,
      sortField: '',
      sortOrder: '', // ascending | descending | ''
      queryForm: { name: '', role: '' },

      roleOptions: [
        { label: '管理员', value: '0', raw: 0 },
        { label: '安保管理员', value: '1', raw: 1 },
        { label: '普通操作员', value: '2', raw: 2 }
      ],

      multipleSelection: [],

      // 弹窗
      dialogVisible: false,
      dialogMode: 'add', // add | edit
      empForm: this.getEmptyForm()
    }
  },
  created () {
    this.fetchAndRender()
  },
  computed: {
    filteredTotal () {
      return this.filteredRows.length
    },
    filteredRows () {
      let rows = [...this.allRows]
      const kw = (this.queryForm.name || '').trim()
      if (kw) {
        rows = rows.filter(r =>
          (r.name || '').includes(kw) ||
          (r.user_name || '').includes(kw) ||
          (r.phone || '').includes(kw)
        )
      }
      if (this.queryForm.role !== '') {
        rows = rows.filter(r => String(r.user_role) === String(this.queryForm.role))
      }
      if (this.sortField && this.sortOrder) {
        const dir = this.sortOrder === 'ascending' ? 1 : -1
        rows.sort((a, b) => (a[this.sortField] > b[this.sortField] ? dir : -dir))
      }
      return rows
    },
    pageRows () {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredRows.slice(start, start + this.pageSize)
    }
  },
  methods: {
    getEmptyForm () {
      return {
        user_id: null,
        user_name: '',
        name: '',
        user_role: 2,
        phone: '',
        gender: 1,
        // 密码相关（编辑时可选）
        password: '',
        confirmPassword: '',
        resetPassword: false
      }
    },

    // 取全量 -> 原样显示 -> 解析映射
    async fetchAndRender () {
      this.loading = true
      try {
        // 一次取“足够多”的数据，避免后端 limit 默认 10 导致“最多 10 条”的错觉
        const res = await selectPage({ skip: 0, limit: 10000 })
        let payload = res.data
        // 回显原始返回
        this.rawText = typeof payload === 'string' ? payload : JSON.stringify(payload)
        // 解析对象，兼容 Result 包裹
        if (typeof payload === 'string') {
          try { payload = JSON.parse(payload) } catch (_) {}
        }
        const dataNode = payload?.data ?? payload
        const list = Array.isArray(dataNode?.rows) ? dataNode.rows : []
        this.allRows = this.mapRows(list)
        // 越界回退
        const maxPage = Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize))
        if (this.currentPage > maxPage) this.currentPage = maxPage
        this.formatRaw()
      } catch (e) {
        const code = e?.response?.status
        this.$message.error(`加载失败${code ? '，Status：' + code : ''}`)
      } finally {
        this.loading = false
      }
    },

    formatRaw () {
      try { this.rawText = JSON.stringify(JSON.parse(this.rawText), null, 2) } catch (_) {}
    },

    mapRows (rows) {
      const roleMap = { 0: '管理员', 1: '安保管理员', 2: '普通操作员' }
      return rows.map(r => ({
        ...r,                  // 保留 user_id 等原始字段，编辑时可直接用
        id: r.user_id,         // 表格显示用
        roleLabel: roleMap[r.user_role] || '普通操作员'
      }))
    },

    // —— 交互（前端分页）——
    onSearch () { this.currentPage = 1 },
    onReset () { this.queryForm = { name: '', role: '' }; this.currentPage = 1 },
    onSortChange ({ prop, order }) { this.sortField = prop; this.sortOrder = order || ''; this.currentPage = 1 },
    handleSizeChange (size) { this.pageSize = size; this.currentPage = 1 },
    handleCurrentChange (page) { this.currentPage = page },
    handleSelectionChange (val) { this.multipleSelection = val },

    // —— 新增 / 编辑 —— 
    onAdd () {
      this.dialogMode = 'add'
      this.dialogVisible = true
      this.empForm = this.getEmptyForm()
      this.$nextTick(() => this.$refs.empFormRef?.clearValidate())
    },
    async onEdit (row) {
      this.dialogMode = 'edit'
      this.dialogVisible = true
      try {
        // 优先从接口拉；如接口返回被 Result 包裹，下面也能兜底
        const { data } = await selectById(row.id)
        const node = data?.data ?? data
        this.empForm = {
          ...this.getEmptyForm(),
          user_id: Number(node?.user_id ?? row.user_id ?? row.id),
          user_name: node?.user_name ?? row.user_name,
          name: node?.name ?? row.name,
          user_role: Number(node?.user_role ?? row.user_role ?? 2),
          phone: node?.phone ?? row.phone,
          gender: Number(node?.gender ?? row.gender ?? 1)
        }
      } catch (_) {
        // 回退：直接用表格行数据
        this.empForm = {
          ...this.getEmptyForm(),
          user_id: Number(row.user_id ?? row.id),
          user_name: row.user_name,
          name: row.name,
          user_role: Number(row.user_role ?? 2),
          phone: row.phone,
          gender: Number(row.gender ?? 1)
        }
      } finally {
        this.$nextTick(() => this.$refs.empFormRef?.clearValidate())
      }
    },
    onDialogClose () {
      this.empForm = this.getEmptyForm()
    },

    // 统一提交
    onSubmit () {
      this.$refs.empFormRef.validate(async (ok) => {
        if (!ok) return
        try {
          this.saving = true
          if (this.dialogMode === 'add') {
            await addNewEmp({
              user_name: this.empForm.user_name,
              name: this.empForm.name,
              user_role: Number(this.empForm.user_role),
              phone: this.empForm.phone,
              gender: Number(this.empForm.gender),
              password: this.empForm.password
            })
            this.$message.success('新增成功')
          } else {
            // 严格校验 user_id，避免 /users/undefined
            if (this.empForm.user_id === null || this.empForm.user_id === undefined || Number.isNaN(Number(this.empForm.user_id))) {
              throw Object.assign(new Error('缺少或非法的 user_id'), { code: 'NO_ID' })
            }
            const payload = {
              user_id: Number(this.empForm.user_id),
              user_name: this.empForm.user_name,
              name: this.empForm.name,
              user_role: Number(this.empForm.user_role),
              phone: this.empForm.phone,
              gender: Number(this.empForm.gender)
            }
            if (this.empForm.resetPassword && this.empForm.password) {
              payload.password = this.empForm.password
            }
            await update(payload)
            this.$message.success('保存成功')
          }
          this.dialogVisible = false
          await this.fetchAndRender()
        } catch (e) {
          const code = e?.response?.status
          const raw = e?.response?.data?.detail ?? e?.response?.data
          let detail = ''
          if (raw) {
            try { detail = typeof raw === 'string' ? raw : JSON.stringify(raw) } catch (_) { detail = String(raw) }
          } else if (e?.code === 'NO_ID') {
            detail = '缺少或非法的 user_id'
          }
          this.$message.error(`保存失败${code ? '，Status：' + code : ''}${detail ? '，' + detail : ''}`)
        } finally {
          this.saving = false
        }
      })
    },

    // —— 删除 —— 
    onDelete (row) {
      this.$confirm(`确定删除【${row.name}】吗？`, '提示', { type: 'warning' })
        .then(async () => {
          try {
            await deleteEmp(row.id)
            this.$message.success('删除成功')
            if (this.pageRows.length === 1 && this.currentPage > 1) this.currentPage -= 1
            await this.fetchAndRender()
          } catch (e) {
            const code = e?.response?.status
            this.$message.error(`接口访问异常，Status：${code || '未知'}`)
          }
        })
        .catch(() => {})
    },
    onBatchDelete () {
      const ids = this.multipleSelection.map(i => i.id)
      if (!ids.length) return
      this.$confirm(`已选择 ${ids.length} 条记录，是否批量删除？`, '提示', { type: 'warning' })
        .then(async () => {
          try {
            await deleteEmp(ids)
            this.$message.success('批量删除成功')
            if (ids.length >= this.pageRows.length && this.currentPage > 1) this.currentPage -= 1
            await this.fetchAndRender()
          } catch (e) {
            const code = e?.response?.status
            this.$message.error(`接口访问异常，Status：${code || '未知'}`)
          }
        })
        .catch(() => {})
    }
  }
}
</script>

<style scoped>
.page-emp { display: flex; flex-direction: column; }
.mb-12 { margin-bottom: 12px; }
.topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.title { font-size: 14px; color: #666; }
.page-title { text-align: center; margin: 8px 0 12px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.left { display: flex; gap: 8px; }
.right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.w-160 { width: 160px; }
.w-260 { width: 260px; }
.ml-8 { margin-left: 8px; }
.pagination { margin-top: 12px; text-align: right; }
</style>
