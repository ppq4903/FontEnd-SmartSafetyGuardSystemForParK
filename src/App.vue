<!-- 
                  src/App.vue
                  这是Vue应用的根组件：

                  所有其他组件都会在这个组件内显示
                  使用<router-view>根据当前路由显示不同的页面 
-->
<script setup>
//引入views/layout/index.vue命名为Layout
import Layout from "@/views/layout/index.vue";
</script>

<template>
  <!-- <Layout></Layout> -->
   <!-- 这里不能写死为基础布局组件，而是应该根据路由动态显示组件，所以应该使用router-view标签 -->
    <router-view></router-view>
</template>

<style scoped>
</style>
