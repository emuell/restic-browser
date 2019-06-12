<template>
  <v-container v-bind="{errorMessage, callback}" fluid fill-height>
    <v-layout v-if="errorMessage.length > 0" row justify-center>
      <v-dialog persistent max-width="25%">
        <v-card>
          <v-card-title class="headline">Error</v-card-title>
          <v-card-text>{{errorMessage}}</v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="green darken-1" flat @click="callback">OK</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-layout>
  </v-container>
</template>

<script>
export default {
  props: ["errorMessage", "callback"]
};
</script>

