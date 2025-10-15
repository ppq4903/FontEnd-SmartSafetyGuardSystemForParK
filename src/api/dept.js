import request from '@/utils/request'//默认导入时不需要大括号（因为每个模块只能有一个默认导出）

// 查询全部部门--本质是一个异步请求操作
// async function queryAllDepts(){
//    const res=await request.get("/depts")
//    return res
// }

export const queryAllDepts=()=>{
   return request.get("/depts")
}
// 新增部门
export const addNewDept=(dept)=>{
   // 返回结果是Tlias-Pojo中的Result类的对象
   return request.post("/depts",dept)
}
// 查询回显：根据id查询部门
export const selectById=(id)=>{
   return request.get(`/depts/${id}`);
}

// 修改部门
export const update=(dept)=>{
   return request.put(`/depts`,dept);
}

// 删除部门
export const deleteById=(id)=>{
   return request.delete(`/depts?id=${id}`);
}