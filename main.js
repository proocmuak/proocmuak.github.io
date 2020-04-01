import Vue from "vue";
import Main from "./vue/main";
import VueCarousel from "vue-carousel";
Vue.use(VueCarousel);
new Vue({
  el: "#App",
  render: h => h(Main)
});
