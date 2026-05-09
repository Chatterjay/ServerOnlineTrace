import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: () => import("../views/Dashboard.vue") },
    { path: "/servers/:id", name: "server-detail", component: () => import("../views/ServerDetail.vue") },
    { path: "/players/:uuid", name: "player-detail", component: () => import("../views/PlayerDetail.vue") },
  ],
});

export default router;
