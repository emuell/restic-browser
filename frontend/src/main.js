import Vue from "vue";
import '@mdi/font/css/materialdesignicons.css'

// Vuesax!
import Vuetify from 'vuetify'
Vue.use(Vuetify, {
  iconfont: 'md'
})

// Vuex!
import Vuex from 'vuex'
Vue.use(Vuex)
import store from './store';

import App from "./App.vue";

Vue.config.productionTip = false;
Vue.config.devtools = true;

import Bridge from "./wailsbridge";

Bridge.Start(() => {
  new Vue({
    render: h => h(App),
    store
  }).$mount("#app");
});
