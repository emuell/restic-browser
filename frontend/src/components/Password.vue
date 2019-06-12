<template>
  <v-container fluid fill-height>
    <v-layout v-if="!showErrorDialog" justify-center align-center>
      <v-flex xs12 sm8 md4>
        <v-card class="elevation-12">
          <v-toolbar dark color="primary">
            <v-toolbar-title>Enter Repository Password</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form>
              <v-text-field
                prepend-icon="lock"
                name="password"
                label="Password"
                id="password"
                type="password"
                autofocus
                v-model="password"
                :rules="[rules.required]"
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn @click="unlock" color="primary">Unlock</v-btn>
          </v-card-actions>
        </v-card>
      </v-flex>
    </v-layout>
    <v-layout v-if="showErrorDialog" row justify-center>
      <v-dialog v-model="showErrorDialog" max-width="33%">
        <v-card>
          <v-card-title class="headline">Error</v-card-title>
          <v-card-text>{{errorMessage}}</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="green darken-1" flat="flat" @click="hideError">OK</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-layout>
  </v-container>
</template>

<script>
import { mapState } from "vuex";
export default {
  data() {
    return {
      password: "",
      showErrorDialog: false,
      errorMessage: "",
      rules: {
        required: value => !!value || "Required."
      }
    };
  },
  computed: mapState(["repodir"]),
  /* eslint-disable */
  methods: {
    async unlock() {
      try {
        let snapshots = await window.backend.Restoric.OpenRepo(
          this.repodir,
          this.password
        );
        window.wails.log.info("snapshots: " + JSON.stringify(snapshots));
        snapshots.forEach(snapshot => {
          snapshot.time = new Date(snapshot.time).toLocaleString();
        });
        this.$store.dispatch("SetSnapshots", snapshots);
      } catch (e) {
        console.log(e);
        this.showError(e);
      }
    },
    showError(message) {
      this.errorMessage = message;
      this.showErrorDialog = true;
    },
    hideError() {
      this.errorMessage = "";
      this.showErrorDialog = false;
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.selectRepo {
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: black;
}
.open {
  font-size: 1rem;
}
</style>
