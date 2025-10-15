import axios from 'axios'
import {ElMessage,ElMessageBox} from 'element-plus'// 引入ElMessage和ElMessageBox
import router from '@/router/index'


// 定制化axios实例request，抽取访问URL
const request = axios.create({
  baseURL: '/backend',
  timeout: 600000
})

// 设置请求拦截器，增设包含JWT的请求头
request.interceptors.request.use((config)=>{
  const loginInfoStr=localStorage.getItem("loginInfo");
  const loginInfo=JSON.parse(loginInfoStr);
  if(loginInfo && loginInfo.token){
    config.headers.set("token",loginInfo.token);
  }
  return config;
})

// 设置响应拦截器,抽取出Result实体类对象返回 or 在401（用户未授权）错误时转到登录组件
request.interceptors.response.use(
  (response)=>{//成功回调--返回的是一个Tlias-Pojo中的Result类对象
    return response.data
  },
  (error)=>{//失败回调
    if(error.response.status===401){
      ElMessage.error("登录超时，请重新登录！");
      router.push('/login');// 停止当前页面显示，跳转到登录页面
    }else{
      ElMessage.error(`接口访问异常，Status：${error.response.status}`);
    }
    return Promise.reject(error)
  }
)

// 默认导出，每个模块只能有一个默认导出
export default request