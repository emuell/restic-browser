<template>
  <v-container fluid fill-height>
    <v-layout v-if="!showErrorDialog" justify-center align-center>
      <v-card class="mx-auto" width="100%">
        <v-sheet class="pa-3 primary lighten-2">
          <v-text-field
            v-model="search"
            label="Search Repository"
            dark
            flat
            solo-inverted
            hide-details
            clearable
            clear-icon="mdi-close-circle-outline"
          ></v-text-field>
          <v-layout>
            <v-checkbox
              style="margin-bottom: 14px; margin-top: 20px;"
              v-model="caseSensitive"
              dark
              hide-details
              label="Case sensitive search"
            ></v-checkbox>
            <v-btn
              color="info"
              style="margin-top:16px"
              right
              v-if="selectedItems.length>0"
            >Extract Files</v-btn>
          </v-layout>
        </v-sheet>
        <v-card-text>
          <v-treeview :items="files" selectable v-model="selectedItems">
            <template v-slot:prepend="{ item, open }">
              <v-icon v-if="item.type == 'dir'">{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
              <v-icon v-else>{{ filetypes[item.file] }}</v-icon>
            </template>
          </v-treeview>
        </v-card-text>
      </v-card>
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
import "material-design-icons-iconfont";

export default {
  data() {
    return {
      showErrorDialog: false,
      caseSensitive: false,
      search: "",
      open: ["root"],
      selectedItems: [],
      filetypes: {
        html: "mdi-language-html5",
        js: "mdi-nodejs",
        json: "mdi-json",
        md: "mdi-markdown",
        pdf: "mdi-file-pdf",
        png: "mdi-file-image",
        txt: "mdi-file-document-outline",
        xls: "mdi-file-excel"
      }
    };
  },
  computed: {
    ...mapState(["files"]),
    filter() {
      return this.caseSensitive
        ? (item, search, textKey) => item[textKey].indexOf(search) > -1
        : undefined;
    }
  },
  /* eslint-disable */
  methods: {
    // showSnaphotFiles: async function(snapshot) {
    //   // Get Files from snapshot
    //   try {
    //     let files = await window.backend.Restoric.GetFilesForSnapshot(
    //       snapshot.id
    //     );
    //     this.$store.dispatch("SetFiles", files);
    //   } catch (e) {
    //     this.errorMessage = e;
    //     this.showErrorDialog = true;
    //   }
    // },
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
