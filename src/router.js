import Vue from 'vue';
import VueRouter from "vue-router";

Vue.use(VueRouter);

import AppMatches from "./components/Matches.vue";

export const router = new VueRouter ({
    mode: "history",
    routes: [
        {path: "", component: AppMatches},
        {path: "*", redirect: ""}
    ]
});