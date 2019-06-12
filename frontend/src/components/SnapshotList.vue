<template>
  <v-container fluid fill-height>
    <v-layout v-if="!showErrorDialog" justify-center align-center>
      <v-data-table :headers="headers" :items="snapshots" class="elevation-1">
        <template v-slot:items="snapshot">
          <td class="text-xs-right">{{ snapshot.item.time }}</td>
          <td class="text-xs-right">{{ snapshot.item.paths.join() }}</td>
          <td class="text-xs-center">{{ snapshot.item.username }}</td>
          <td class="text-xs-center">{{ snapshot.item.hostname }}</td>
          <td class="text-xs-center">
            <v-btn round @click="showSnaphotFiles(snapshot.item)" color="info">Select</v-btn>
          </td>
        </template>
      </v-data-table>
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
      headers: [
        {
          text: "Date",
          align: "center",
          sortable: true,
          value: "time"
        },
        { text: "Paths", align: "center", value: "paths" },
        { text: "Username", align: "center", value: "username" },
        { text: "Hostname", align: "center", value: "hostname" },
        { text: "", align: "center", value: "" }
      ],
      showErrorDialog: false
    };
  },
  computed: mapState(["snapshots"]),
  /* eslint-disable */
  methods: {
    showSnaphotFiles: async function(snapshot) {
      // Get Files from snapshot
      try {
        let files = await window.backend.Restoric.GetFilesForSnapshot(
          snapshot.id
        );
        console.log(files);
        this.$store.dispatch("SetFiles", files);
      } catch (e) {
        this.errorMessage = e;
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
