<template>
  <div class="all">
    <div class="up">
      <span class="text"> Чем мы готовы отравить вас </span>
      <div class="image"></div>
    </div>
    <div class="down">
      <div class="menuText">
        <div class="bigWhiteText">Новые ощущения</div>
        <div class="smallGreyText">
          <div class="fonForSmallGreyText">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Nisi,
            dolorum.
          </div>
        </div>
      </div>
      <div class="menuText">
        <div class="bigWhiteText">Обновленное меню</div>
        <div class="smallGreyText">
          <div class="fonForSmallGreyText">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Magni,
            quos!
          </div>
        </div>
      </div>
      <div class="menuText">
        <div class="bigWhiteText">Изменение интерьера</div>
        <div class="smallGreyText">
          <div class="fonForSmallGreyText">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit.
            Reiciendis, dolorem!
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "whatDoWeActuallyCook"
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
}
.down {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
.text {
  color: #fff;
  font-size: 45px;
  margin-left: 35px;
}
.image {
  background-image: url(../img/da.jpg);
  width: 790px;
  height: 500px;
  background-repeat: no-repeat;
  background-size: 100%;
}
.all {
  display: grid;
  grid-template-rows: 1fr 1fr;
  width: 100vw;
  height: 100vh;
}
.up {
  background-color: #000;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.down {
  background-color: #094367;
  width: 100vw;
}
.menuText {
  height: 100%;
  display: grid;
  grid-template-rows: 1fr 1fr;
}
.bigWhiteText {
  width: 100%;
  color: white;
  font-size: 2vw;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.smallGreyText {
  width: 100%;
  display: flex;
  color: grey;
  justify-content: center;
}
.fonForSmallGreyText {
  width: 50%;
  text-align: center;
  font-size: 1vw;
}
@media (max-width: 720px) {
  .image {
    height: 384px;
    background-image: url(../img/pizza.jpg);
    background-size: 100%;
    width: 50%;
  }
  .bigWhiteText {
    font-size: 27px;
  }
  .smallGreyText {
    font-size: 20px;
  }
}
</style>
