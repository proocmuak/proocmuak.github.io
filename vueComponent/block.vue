<template>
  <div class="block">
    <rightMenu></rightMenu>
  </div>
</template>

<script>
import rightMenu from "./rightMenu";
export default {
  name: "huynya",
  components: { rightMenu }
};
</script>

<style>
.block {
  font-family: "Playfair Display", serif;
  background-image: url(../images/fon.jpg);
  width: 100vw;
  height: 100vh;
  background-size: 100%;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
}
.welcomeText {
  width: 100px;
  height: 200px;
  color: azure;
}
@media handheld and (max-width: 768px) {
  .block {
    background-image: url(../img/fonForPhone.jpg);
  }
}
</style>
