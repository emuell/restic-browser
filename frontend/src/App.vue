<template>
  <div id="app">
    <div id="app">
      <v-app id="inspire">
        <v-navigation-drawer clipped fixed v-model="drawer" app>
          <v-list dense>
            <v-list-tile>
              <v-list-tile-action>
                <v-icon>dashboard</v-icon>
              </v-list-tile-action>
              <v-list-tile-content>
                <v-list-tile-title>Dashboard</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
            <v-list-tile>
              <v-list-tile-action>
                <v-icon>settings</v-icon>
              </v-list-tile-action>
              <v-list-tile-content>
                <v-list-tile-title>Settings</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
          </v-list>
        </v-navigation-drawer>
        <v-toolbar app fixed clipped-left>
          <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
          <v-toolbar-title>Restoric</v-toolbar-title>
        </v-toolbar>
        <v-content>
          <selectRepo v-if="APPSTATE === APP_STATES.SELECT_REPO"></selectRepo>
          <password v-if="APPSTATE === APP_STATES.ENTER_PASSWORD"></password>
          <snapshotList v-if="APPSTATE === APP_STATES.SELECT_SNAPSHOT"></snapshotList>
          <fileList v-if="APPSTATE === APP_STATES.SHOW_SNAPSHOT_FILES"></fileList>
        </v-content>
        <v-footer app fixed>
          <span style="margin-left: 10px">
            Built with
            <a href="https://wails.app">Wails</a>
          </span>
        </v-footer>
      </v-app>
    </div>
  </div>
</template>

<script>
import "vuetify/dist/vuetify.min.css";
import "./assets/css/main.css";
import "material-design-icons-iconfont";
// import "./components/SelectRepo.vue";
// import SelectRepo from "./components/SelectRepo.vue";

import Password from "./components/Password";
import SelectRepo from "./components/SelectRepo";
import SnapshotList from "./components/SnapshotList";
import FileList from "./components/FileList";

import { mapState } from "vuex";

export default {
  name: "restoric",
  data: () => ({
    activeItem: 0,
    drawer: false
  }),
  computed: mapState(["APPSTATE", "APP_STATES"]),
  components: {
    password: Password,
    selectRepo: SelectRepo,
    snapshotList: SnapshotList,
    fileList: FileList
  }
};
</script>

<style scoped>
</style>

