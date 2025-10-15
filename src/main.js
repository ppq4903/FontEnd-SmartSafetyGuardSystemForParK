import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'// 引入Element Plus
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'// 引入Element Plus中文语言包
import * as ElementPlusIconsVue from '@element-plus/icons-vue'//1 引入Element Plus图标库
import './assets/main.css'
//1 利用导入的根组件App来创建Vue应用实例（根组件App本质上就是一个特殊的JS对象）
const app = createApp(App)

app.use(router)//注册路由示例到应用
app.use(ElementPlus, {locale: zhCn})//注册Element Plus组件库
//2 注册所有Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')//挂载应用实例到入口HTML文件中的#app元素

/*
  Vue应用需要一个"宿主"DOM元素来渲染其内容
  挂载过程会将Vue应用的根组件(App.vue)渲染到指定的DOM元素中
  挂载后，Vue开始接管该DOM元素及其子元素的控制权
*/
