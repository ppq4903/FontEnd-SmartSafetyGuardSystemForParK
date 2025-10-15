<!-- 该文件是基础布局组件，所有页面（除登录页面）都嵌套在该组件内
 -->
<script setup>
import { House } from '@element-plus/icons-vue';
import {ref,onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'// 引入ElMessage和ElMessageBox
const router=useRouter();
const name=ref('')
const setNameDisplay=()=>{
  const loginInfo=JSON.parse(localStorage.getItem("loginInfo"));
  if(loginInfo && loginInfo.name){
    name.value=loginInfo.name;
  }
}
onMounted(()=>{
  setNameDisplay();
}
)
const handleLogout=()=>{
  console.log("用户点击了退出登录按钮");
   ElMessageBox.confirm("确定退出登录", '通知', 
  {confirmButtonText: '确定',cancelButtonText: '取消',type: 'info',}//type指定消息内容前的图标
  )
  .then(async() => {// 点击了确认按钮
    localStorage.removeItem("loginInfo");
    ElMessage.success("退出成功");
    router.push("/login");
    })
  .catch(() => {// 点击了取消按钮
    ElMessage.info('已取消');
  })
}

const handleChangePwd=()=>{

}
</script>

<template>
  <div class="common-layout">
    <el-container>
      <!-- Header 区域 -->
      <el-header class="header">
        <span class="title">Tlias智能学习辅助系统</span>
        <span class="right_tool">
          <a href="" @click="handleChangePwd">
            <el-icon><EditPen /></el-icon> 修改密码 &nbsp;&nbsp;&nbsp; |  &nbsp;&nbsp;&nbsp;
          </a>
          <a href="javascript:;" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon> 退出登录 【{{ name }}】
          </a>
        </span>
      </el-header>
      <!-- 余下区域 -->
      <el-container>
        <!-- 左侧菜单 -->
        <el-aside width="200px" class="aside">
          <el-menu router default-active="[]">
            <el-menu-item index="index">
              <el-icon><house /></el-icon>首页
            </el-menu-item>
            <el-sub-menu index="csManage">
            <template #title>
              <el-icon><user /></el-icon>班级学员管理
            </template>
              <el-menu-item index="clazz">班级管理</el-menu-item>
              <el-menu-item index="stu">学员管理</el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="deManage">
            <template #title>
              <el-icon><setting /></el-icon>系统信息管理
            </template>
              <el-menu-item index="dept">部门管理</el-menu-item>
              <el-menu-item index="emp">员工管理</el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="reportManage">
            <template #title>
              <el-icon><data-line /></el-icon>数据统计
            </template>
              <el-menu-item index="empReport">员工信息统计</el-menu-item>
              <el-menu-item index="stuReport">学员信息统计</el-menu-item>
              <el-menu-item index="logReport">日志信息统计</el-menu-item>
            </el-sub-menu>
          </el-menu>
        </el-aside>
        
        <el-main>
          <router-view></router-view>
        </el-main>
      </el-container>
      
    </el-container>
  </div>
</template>

<style scoped>
.header {
  background-image: linear-gradient(to right, #00547d, #007fa4, #00aaa0, #00d072, #a8eb12);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  color: white;
  font-size: 40px;
  font-family: 楷体;
  font-weight: bolder;
}

.right_tool{
  line-height: 60px;
}

a {
  color: white;
  text-decoration: none;
}

.aside {
  width: 220px;
  border-right: 1px solid #ccc;
  height: 730px;
}
</style>
