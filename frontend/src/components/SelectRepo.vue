<template>
  <v-container fluid fill-height>
    <v-layout v-if="!showErrorDialog" justify-center align-center>
      <v-flex xs12 sm8 md4>
        <v-card class="elevation-12">
          <v-toolbar dark color="primary">
            <v-toolbar-title>Welcome to Restoric</v-toolbar-title>
          </v-toolbar>
          <v-card-text>To begin using Restoric, please select a repository...</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn @click="selectRepo" color="primary">Select</v-btn>
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
export default {
  data() {
    return {
      errorMessage: "",
      showErrorDialog: false
    };
  },
  /* eslint-disable */
  methods: {
    async selectRepo() {
      try {
        let repo = await window.backend.Restoric.SelectRepo();
        console.log(this);
        this.$store.dispatch("SetRepoDirectory", repo);
      } catch (e) {
        console.log("here");
        this.errorMessage = "Invalid Repository directory. Please try again";
        this.showErrorDialog = true;
      }
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
