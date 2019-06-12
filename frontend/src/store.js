import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

const APP_STATES = {
  'SELECT_REPO': 0,
  'ENTER_PASSWORD': 1,
  'SELECT_SNAPSHOT': 2,
  'SHOW_SNAPSHOT_FILES': 3
}

export default new Vuex.Store({
  state: {
    repodir: "",
    APP_STATES,
    APPSTATE: APP_STATES.SELECT_REPO,
    snapshots: [],
    files: []
  },
  mutations: {
    SET_SNAPSHOTS(state, snapshots) {
      state.snapshots = snapshots
    },
    SET_FILES(state, files) {
      state.files = [].concat(files);
    },
    SET_REPOSITORY_DIRECTORY(state, repodir) {
      state.repodir = repodir
    },
    SET_APP_STATE(state, appstate) {
      state.APPSTATE = appstate
    }
  },
  actions: {
    SetRepoDirectory(context, repodir) {
      context.commit('SET_REPOSITORY_DIRECTORY', repodir)
      context.commit('SET_APP_STATE', APP_STATES.ENTER_PASSWORD)
    },
    SetAppState(context, appstate) {
      context.commit('SET_APP_STATE', appstate)
    },
    SetSnapshots(context, snapshots) {
      context.commit('SET_SNAPSHOTS', snapshots)
      context.commit('SET_APP_STATE', APP_STATES.SELECT_SNAPSHOT)
    },
    SetFiles(context, files) {
      context.commit('SET_FILES', files)
      context.commit('SET_APP_STATE', APP_STATES.SHOW_SNAPSHOT_FILES)
    }
  }
});
