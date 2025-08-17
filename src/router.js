// src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import enter from './App.vue';
import StudentMenu from './StudentMenu.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: enter },
    { path: '/menu', component: StudentMenu },
    
  ],
});


export default router;