<template>
  <div class="menu">
    <ul>
      <li class="button">Добро пожаловать</li>
      <li class="button">Меню</li>
      <li class="button">События</li>
      <li class="button">Контакты</li>
      <li class="button">Вход</li>
    </ul>
  </div>
</template>
<script>
export default {};
</script>
<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.button {
  display: inline;
  padding: 0px 15px 0px 15px;
  cursor: pointer;
}
.button:hover {
  color: white;
  background-color: red;
  width: auto;
  border-radius: 10%;
  transition: 0.5s;
}
.menu {
  width: 100vw;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  position: absolute;
  font-size: 30px;
  font-weight: 900;
}
@media (max-width: 720px) {
  .menu {
    font-size: 22.5px;
  }
}
</style>
