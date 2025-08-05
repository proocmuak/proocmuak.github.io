<script setup>
import { ref } from 'vue'
import { supabase } from './supabase.js' // Или правильный путь к вашему файлу supabase
import { useRouter } from 'vue-router'

const router = useRouter()

// Состояния формы
const isLoginForm = ref(true)
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')

// Переключение между формами
const toggleForm = () => {
  isLoginForm.value = !isLoginForm.value
  errorMessage.value = ''
  successMessage.value = ''
}

// Обработка входа
const handleLogin = async () => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    
    if (error) throw error
    localStorage.setItem('userEmail', email.value)
    window.location.href = '/menu.html';
  } catch (error) {
    errorMessage.value = error.message
  }
}

// Обработка регистрации
const handleSignUp = async () => {
  try {
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value
    })
    
    if (error) throw error
    successMessage.value = 'Проверьте вашу почту для подтверждения!'
    email.value = ''
    password.value = ''
  } catch (error) {
    errorMessage.value = error.message
  }
}

// Вход через Telegram
const handleTelegramLogin = async () => {
  // Здесь будет реализация OAuth через Telegram
  alert('Функция входа через Telegram будет реализована позже')
}
</script>

<template>
<div class="allpage">
  <div class="topmenu">
    <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
    <div class="rightparttopmenu">
      <div class="courses">Курсы</div>
      <div class="go_back">На главную</div>
    </div>
  </div> 
  
  <div class="mainpartpage">
    <div class="centerpart_for_enter">
      <div class="chose_of_login_or_register">
        <div class="chose_of_login_or_register_text">
          <div 
            class="chose_enter" 
            :style="{ color: isLoginForm ? 'black' : 'grey' }"
            @click="isLoginForm ? null : toggleForm()"
          >
            Вход
          </div>
          <div 
            class="register"
            :style="{ color: !isLoginForm ? 'black' : 'grey' }"
            @click="!isLoginForm ? null : toggleForm()"
          >
            Регистрация
          </div>
        </div>
        <div class="chose_of_login_or_register_line">
          <div 
            class="chose_of_login_or_register_line_first"
            :style="{ height: isLoginForm ? '100%' : '50%' }"
          ></div>
          <div 
            class="chose_of_login_or_register_line_second"
            :style="{ height: !isLoginForm ? '100%' : '50%' }"
          ></div>
        </div>
      </div>

      <div class="info_about_account">
        <input 
          v-model="email"
          type="text" 
          id="email_or_phone" 
          placeholder="E-mail"
        >
        <input 
          v-model="password"
          type="password" 
          id="password" 
          placeholder="Пароль"
        >
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <div class="enter_or_forget_password">
    <div 
      class="enter_button" 
      :class="{ 'register-button': !isLoginForm }"
      @click="isLoginForm ? handleLogin() : handleSignUp()"
    >
      {{ isLoginForm ? 'Войти' : 'Зарегистрироваться' }}
    </div>
    <div class="forget_password" v-if="isLoginForm">
      Забыли пароль?
    </div>
     </div>

      <div class="enter_by_telegram">
        <div class="enter_by_telegram_line"></div>
        <div 
          class="enter_by_telegram_menu"
          @click="handleTelegramLogin"
        >
          Войти через Telegram
        </div>    
      </div>
      <div class="consent">
        Осуществляя вход или регистрацию, вы выражаете согласие на обработку персональных данных
      </div>    
    </div>
  </div>

  <div class="bottominfo">
    <div class="logo_and_privacy">
      <img src="/src/assets/logovector.svg" class="logoicon">
      <div class="privacy_policy">Политика конфиденциальности</div>
    </div>
    <div class="contact">
      <div class="phone">
        <img src="/src/assets/pinkphone.svg" class="logo_without_circle"> 
        +7 (963) 643 4241
      </div>
      <div class="mail"><img src="/src/assets/pinkmail.svg" class="logo_without_circle">Purtoea@gmail.com</div>
      <div class="icons">
        <a href="https://t.me/katerinaegechembio">
            <div class="circle">
                <img src="/src/assets/telegramvector.svg" class="icon" >
            </div>
        </a>
        <a href="https://instagram.com/katerinaege.chembio">
            <div class="circle">
             <img src="/src/assets/instavector.svg" class="icon">
            </div>
        </a>
        <a href="https://www.youtube.com/@katerinaege.chembio">
            <div class="circle">
            <img src="/src/assets/youtubevector.svg" class="icon">
        </div>
    </a>
      </div>
    </div>
  </div>
</div>
</template>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
@font-face {
	font-family: Evolventa;
	src: local("Evolventa"), url("/src/assets/evolventa/Evolventa-Regular.woff");
	font-weight: normal;
	font-style: normal;
}

@font-face {
	font-family: Evolventa;
	src: local("Evolventa Oblique"), url("/src/assets/evolventa/Evolventa-Oblique.woff");
	font-weight: normal;
	font-style: italic;
}

@font-face {
	font-family: Evolventa;
	src: local("Evolventa Bold"), url("/src/assets/evolventa/Evolventa-Bold.woff");
	font-weight: bold;
	font-style: normal;
}

@font-face {
	font-family: Evolventa;
	src: local("Evolventa Bold Oblique"), url("/src/assets/evolventa/Evolventa-BoldOblique.woff");
	font-weight: bold;
	font-style: italic;
}

body {
    background-image: url(/src/assets/background.png);
    background-size: cover;
    background-position:center;
    background-repeat: no-repeat;
    font-family: Evolventa;
    width: 100%;
    height: 100%;
}

@media (max-width: 767px) {
   body{
    font-size: 12px;
    background-size: cover;
  }
}

@media (max-width: 1199) {
  body{
    font-size: 14px;
  }
}



.allpage{
    display: grid;
    height: 100vh;
    width:100%;
    grid-template-rows: 7% 81% 12%; 
}
.topmenu{
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 20% 22%;
    column-gap: 55%;
    padding-left: 8%;
    color: white;
    background-color: #b241d1;
}
.logo{
    display: grid;
    place-content: center;
    font-size: 1.25vw;
}
@media (max-width: 767px){
  .logo{font-size: 13px;}
}
.rightparttopmenu{
    display: grid; 
    grid-template-columns: 25% 30%;
    column-gap: 7%;
}
@media (max-width: 767px){
  .rightparttopmenu{
    column-gap: 17%;
  }
}
.courses{
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
}
.go_back{
    display: grid;
    place-items: center;
    white-space: nowrap
}
.mainpartpage{
    height: 100%;
    width: 100%;
    display: grid;
    place-items: center;
}

.circle{
    background-color: #b241d1;
    display: grid;
    place-items: center;
    width: 5.5vh;
    height: 5.5vh;
    border-radius: 50%;
     cursor: pointer;
}
.circle:hover{
    width: 6vh;
    height: 6vh;
}
.centerpart_for_enter{
    height: 59%;
    width: 34%;
    background-color: #f9f8ff;
    border-radius: 2%;
    padding: 2%;
    display: grid;
    grid-template-rows: 15% 25% 10% 15% 15% 10%;
    gap: 5%
}
.chose_of_login_or_register{
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 60% 5%;
}
.chose_of_login_or_register_text{
    color: black;
    font-weight: bold;
    display: grid;
    grid-template-columns: 50% 50%;
    font-size: 1.25vw;
}
@media (max-width: 767px){
  .chose_of_login_or_register_text{
    font-size: 2.4vw;
  }
}
.chose_of_login_or_register_line{
    display: grid;
    grid-template-columns: 50% 50%;
    align-items: center;
}
.chose_of_login_or_register_line_first {
    background-color: black;
    height: 100%;
}
.chose_of_login_or_register_line_second{
    background-color: black;
    height: 50%;
}
.chose_enter{
    display: grid;
    place-items: center;
}
.register{
    display: grid;
    place-items: center;
}

.info_about_account{
    display: grid;
    grid-template-rows: 40% 40%;
    gap: 20%;

}

#email_or_phone, #password{
    border: 0.15vh solid #b241d1;
    padding-left: 2.5%;
    font-family: Evolventa;
    color: black;
}
#email_or_phone:focus, #password:focus{
     outline: none;
    border: 0.2vh solid #b241d1;
}
input::placeholder{
    color: black;
    opacity: 1;
}

.enter_or_forget_password{
    display: grid;
    grid-template-columns: 20% 30%;
    gap: 50%;
}

.enter_button {
  background-color: #b241d1;
  color: white;
  display: grid;
  place-items: center;
  transition: all 0.5s ease;
  width: fit-content; /* Изменено с фиксированной ширины */
  padding: 10%;
}

/* Специальный стиль для кнопки регистрации */
.register-button {
  width: fit-content; /* Ширина, достаточная для текста "Зарегистрироваться" */
  padding: 10%;
}
.forget_password{
    display: grid;
    place-items: center;
}
.enter_by_telegram{
display: grid;
grid-template-rows: 1% 75%;
gap: 20%;
}
.enter_by_telegram_line{
    background-color: black;
}
.enter_by_telegram_menu{
    background-color: #b241d1;
    color: white;
    display: grid;
    place-items: center;
}
.consent{
    color: grey;
    text-align: center;
}
@media (max-width: 767px){
  .consent{
    font-size: 9px;
  }
}
.bottominfo{
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 40% 40%;
    gap: 20%;
    padding-left: 5%;
    padding-right: 5%;
}
.logo_and_privacy{
    display: grid;
    place-items: center;
    grid-template-columns: 30% 50%;
    gap: 20%;
}
.contact{
    display: grid;
    grid-template-columns: 30% 35% 30%;
    gap: 5%;
    font-size: 1.5vh;
}
.phone, .mail {
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
}
.icons{
    display: grid;
    grid-template-columns: 30% 30% 30%;
    place-items: center;
    gap: 5%;
}
.icon{
    height: 60%;
    width: 60%;
}
.logoicon{
  height: 10vh;
  width: 10vh;
}
.logo_without_circle{
  height: 3.5vh;
  width: 3.5vh;
}

@media (max-width: 767px) {
  .bottominfo{
    grid-template-columns: 40% 55%;
    gap: 5%;
  }
   .contact{
    font-size: 9px;
    gap: 7%
   }
.logo_without_circle{
  height: 2vh;
  width: 2vh;
}
   .circle{
    height: 3vh;
    width: 3vh;
   }
}


/* Добавляем новые стили для сообщений */
.error-message {
  color: #ff3333;
  text-align: center;
  margin-top: -3%;
}

.success-message {
  color: #33cc33;
  text-align: center;
  margin-top: -3%;
}

/* Делаем кнопки кликабельными */
.enter_button, 
.forget_password,
.enter_by_telegram_menu,
.chose_enter,
.register {
  cursor: pointer;
  user-select: none;
}

.chose_enter:hover,
.register:hover {
  text-decoration: none;
  transform: scale(1.05); /* Легкое увеличение */
  transition: all 0.2s ease; /* Плавный переход */
}
</style>