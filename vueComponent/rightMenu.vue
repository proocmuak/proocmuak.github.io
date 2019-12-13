<template>
  <div class="rightMenu">
    <div class="labele"></div>
    <div class="aboutOpenning">
      <span class="think">Мы открываемся</span>
      <br />
      <span class="thick">21 никогда</span>
    </div>
    <div class="buttonLearnMore">Узнать больше</div>
  </div>
</template>

<script>
export default {
  name: "rightMenu"
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.rightMenu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-evenly;
  width: 95vw;
  height: 50vh;
}
.labele {
  background-image: url("../icon.png");
  width: 100px;
  height: 100px;
  background-size: 100%;
  background-repeat: no-repeat;
}
.think {
  font-size: 50px;
  font-weight: 300;
  color: #fff;
}
.thick {
  font-size: 50px;
  font-weight: 900;
  color: #fff;
}
.buttonLearnMore {
  background-color: rgba(11, 95, 15, 0.74);
  color: wheat;
  width: 390px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 45px;
  font-weight: 600;
  border-radius: 10%;
  position: relative;
  cursor: pointer;
}
.buttonLearnMore:hover {
  transition: 0.5s;
  color: white;
  width: 23vw;
  height: 110px;
  font-size: 50px;
  font-weight: 800;
}
</style>
