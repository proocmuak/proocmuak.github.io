import Vue from "vue";
import screen from "./vueComponent/app.vue";
let app = new Vue({
  el: "#app",
  render: h => h(screen)
});
