<template>
  <div class="screen">
    <topmenu></topmenu>
    <huynya> </huynya>
    <whatDoWeActuallyCook></whatDoWeActuallyCook>
  </div>
</template>
<script>
import topmenu from "./menu";
import huynya from "./block";
import whatDoWeActuallyCook from "./whatDoWeActuallyCook";
export default {
  name: "screen",
  components: { topmenu, huynya, whatDoWeActuallyCook }
};
</script>
<style>
* {
  margin: 0;
  padding: 0;
  font-family: "Playfair Display", serif;
}
.screen {
  width: 100vw;
  height: 5200px;
  background-color: #980246;
}
</style>
