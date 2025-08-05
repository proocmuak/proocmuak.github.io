// src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import enter from './App.vue';
import menu from './Menu.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: enter },
    { path: '/menu', component: menu },
  ],
});

export default router;