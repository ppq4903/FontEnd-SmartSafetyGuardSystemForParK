import request from '@/utils/request'//默认导入时不需要大括号（因为每个模块只能有一个默认导出）

export const login=(user)=>{
   return request.post("/login",user);
}