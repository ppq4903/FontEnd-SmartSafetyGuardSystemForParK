<script setup>
import { ref,onMounted } from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'// 引入ElMessage和ElMessageBox
import {queryAllDepts,addNewDept,selectById,update,deleteById} from '@/api/dept'//具名导入后端交互API
// 1 部门列表相关
const deptList=ref([]);
const refreshDeptList=async()=>{
  const res=await queryAllDepts();
  if(res.code==1){//JS中非布尔值也可以隐式转换为布尔值，数字非0为真，0为假；空串为假，非空为真；undefined和null都是false
    deptList.value=res.data;
  }else{
    deptList.value=[];
  }
}
onMounted(()=>{
  refreshDeptList();
})
// 2 新增or修改部门对话框相关
const dialogVisible = ref(false)
const formLabelWidth = '140px'
let dialogTitle = ref('对话框标题')
const dept = ref({
  name: ''
})
// 表单校验相关
const rules = ref({
  //为prop=name的表单项编写校验规则集合
  name: [
    { required: true, message: '部门名称必需填写', trigger: 'blur' },//blur表示失去焦点时触发校验
    { min: 2, max: 10, message: '部门名称长度应该在2-10个字符', trigger: 'blur' },
  ]
})
const deptFormRef=ref();// 表单对象的引用，用于表单校验
// 点击新增部门按钮
const handleAddBtnClick=()=>{
  dialogTitle.value='新增部门'; // v-bind单向数据注入
  dialogVisible.value=true;//显示对话框

  dept.value={// 置空表单输入框 <= v-model双向数据绑定
    name: ''
  }
  if(deptFormRef.value){
    deptFormRef.value.resetFields(); // 清除上次校验表单项产生的message
  }
}

// 点击编辑按钮
const handleEditBtnClicked=async(deptId)=>{
  // 显示对话框
  dialogTitle="编辑部门";
  dialogVisible.value=true;
  if(deptFormRef.value){
    deptFormRef.value.resetFields(); // 清除上次校验表单项产生的message
  }
  // 查询回显
  const res=await selectById(deptId);
  if(res.code){
    // v-model双向数据绑定，按ID查询时res.data就是一个Dept对象而不是列表
    dept.value=res.data;
  }else{
    ElMessage.error(`查询回显失败：${res.msg}`);
  }
}
// 点击表单确认按钮
const submit=async()=>{
  // 通过value获取表单对象
  if(!deptFormRef.value)return
  // 校验整个表单
  deptFormRef.value.validate(
    async (valid)=>{
      if(valid){//校验通过--向后端发起请求，并处理响应
        let res={
          code:1
        };
        //依据dept.value这个对象的结构判断当前是 新增部门 or 提交修改后的部门
        if(dept.value.id){
          res=await update(dept.value);//由于查询回显，此时dept.value是一个完整的Dept实体类对象
        }else{
          res=await addNewDept(dept.value);//注意dept.value才是要传入的对象,内部只有name:"value"
        }
        if(res.code==1){
          //增加成功 or 修改成功：关闭对话框，提示，刷新部门列表
          dialogVisible.value=false;
          ElMessage.success('操作成功');
          refreshDeptList();
        }else{
          //增加失败or 修改失败：提示，但不关闭对话框
          ElMessage.error("操作失败: "+res.msg);
        }
      }else{
        // 提示，但不关闭对话框
        ElMessage.error("表单校验不通过");
      }
    }
  )
}
// 点击删除按钮--显示消息盒子
const handleDeleteBtnClicked=(id)=>{ 
  ElMessageBox.confirm("确定删除该部门？", '警告', 
  {confirmButtonText: '确定',cancelButtonText: '取消',type: 'warning',}//type指定消息内容前的图标
  )
  .then(async() => {// 点击了确认按钮
    const res=await deleteById(id);
    if(res.code){
      ElMessage.success("操作成功");
      refreshDeptList();
    }else{
      ElMessage.error("操作失败: "+res.msg);
  }})
  .catch(() => {// 点击了取消按钮
    ElMessage.info('已取消删除');
  })
}
</script>

<template>
  <h1 style="text-align: center;">部门管理</h1>
  <br>
  <el-button type="primary" @click="handleAddBtnClick">+ 增加部门</el-button>
  <br><br>
  <el-table :data="deptList" border style="width: 100%">
    <el-table-column type="index" label="序号" width="100" align="center" />
    <el-table-column prop="name" label="部门名称" width="150" align="center" />
    <el-table-column prop="updateTime" label="上次修改时间" width="200" align="center" />
    <el-table-column label="操作" align="center">
       <template #default="scope">
        <!-- 编辑、删除按钮事件监听时传入当前行对应部门对象的id -->
        <el-button type="primary" size="small" @click="handleEditBtnClicked(scope.row.id)">
          <el-icon><edit /></el-icon>编辑
        </el-button>
        <el-button type="danger" size="small" @click="handleDeleteBtnClicked(scope.row.id)">
          <el-icon><delete /></el-icon>删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog v-model="dialogVisible" :title="dialogTitle">
    <el-form :model="dept" :rules="rules" ref="deptFormRef">
      {{dept}}
      <!-- 通过表单项的prop属性指定校验规则 -->
      <el-form-item label="新增部门名" :label-width="formLabelWidth" prop="name">
        <el-input v-model="dept.name" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">提交</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>

</style>
