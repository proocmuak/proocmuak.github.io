<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase.js'

// Состояния формы
const isLoginForm = ref(true)
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const telegramVerificationCode = ref('')
const showTelegramVerification = ref(false)
const telegramUsername = ref('')
const isTelegramAuthAvailable = ref(false)

// Проверяем доступность Telegram Web App API при загрузке
onMounted(() => {
  if (window.Telegram?.WebApp) {
    isTelegramAuthAvailable.value = true
    initTelegramAuth()
  }
})

// Инициализация Telegram авторизации
const initTelegramAuth = () => {
  const tg = window.Telegram.WebApp
  tg.expand()
  tg.enableClosingConfirmation()
  
  // Получаем данные пользователя Telegram
  const user = tg.initDataUnsafe?.user
  if (user) {
    telegramUsername.value = user.username
    handleTelegramAuth(user)
  }
}

// Обработка авторизации через Telegram
const handleTelegramAuth = async (tgUser) => {
  try {
    const { username } = tgUser
    
    // Проверяем, есть ли пользователь в базе
    const { data: existingUser, error: checkError } = await supabase
      .from('personalities')
      .select('*')
      .eq('telegram', username)
      .maybeSingle()

    if (checkError) throw checkError

    if (existingUser) {
      // Пользователь существует - входим
      await completeTelegramLogin(existingUser)
    } else {
      // Новый пользователь - показываем форму регистрации
      showTelegramVerification.value = true
      email.value = `${username}@telegram.com`
      await generateVerificationCode(username)
    }
  } catch (error) {
    errorMessage.value = 'Ошибка авторизации через Telegram'
    console.error('Telegram auth error:', error)
  }
}

// Генерация кода верификации
const generateVerificationCode = async (username) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Сохраняем код в базе
    const { error } = await supabase
      .from('telegram_verification')
      .upsert({
        telegram_username: username,
        verification_code: code,
        expires_at: new Date(Date.now() + 15 * 60 * 1000)
      })

    if (error) throw error

    successMessage.value = 'Код верификации отправлен в Telegram!'
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = 'Ошибка генерации кода'
    console.error('Code generation error:', error)
  }
}

// Завершение входа через Telegram
const completeTelegramLogin = async (userData) => {
  try {
    // Устанавливаем сессию или перенаправляем
    localStorage.setItem('userEmail', userData.email)
    localStorage.setItem('telegramAuth', 'true')
    
    // Перенаправляем в зависимости от роли
    switch (userData.role) {
      case 'tutor':
        window.location.href = '/tutor_menu.html'
        break
      case 'teacher':
        window.location.href = '/teacher_menu.html'
        break
      default:
        window.location.href = '/student_menu.html'
        break
    }
  } catch (error) {
    errorMessage.value = 'Ошибка входа'
    console.error('Login error:', error)
  }
}

// Проверка кода верификации
const verifyTelegramCode = async () => {
  try {
    if (!telegramVerificationCode.value || telegramVerificationCode.value.length !== 6) {
      errorMessage.value = 'Введите 6-значный код'
      return false
    }

    const { data: verification, error } = await supabase
      .from('telegram_verification')
      .select('*')
      .eq('telegram_username', telegramUsername.value)
      .eq('verification_code', telegramVerificationCode.value.toUpperCase())
      .gt('expires_at', new Date())
      .single()

    if (error || !verification) {
      errorMessage.value = 'Неверный или просроченный код'
      return false
    }

    return true
  } catch (error) {
    errorMessage.value = 'Ошибка верификации'
    console.error('Verification error:', error)
    return false
  }
}

// Создание пользователя с Telegram
const createUserWithTelegram = async () => {
  try {
    // Создаем auth запись
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: Math.random().toString(36) + Math.random().toString(36)
    })

    if (authError) throw authError

    // Создаем запись в personalities
    const { error: profileError } = await supabase
      .from('personalities')
      .insert({
        email: email.value,
        telegram: telegramUsername.value,
        role: 'student',
        user_id: authData.user.id,
        is_telegram_verified: true
      })

    if (profileError) {
      // Если пользователь уже существует, пытаемся обновить
      const { error: updateError } = await supabase
        .from('personalities')
        .update({
          telegram: telegramUsername.value,
          is_telegram_verified: true
        })
        .eq('email', email.value)

      if (updateError) throw updateError
    }

    successMessage.value = 'Аккаунт успешно создан! Перенаправление...'
    errorMessage.value = ''
    
    setTimeout(() => {
      window.location.href = '/student_menu.html'
    }, 2000)

  } catch (error) {
    errorMessage.value = 'Ошибка создания аккаунта'
    console.error('Create user error:', error)
  }
}

// Обычная регистрация
const handleSignUp = async () => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value
    })
    
    if (authError) {
      if (authError.message.includes('Email logins are disabled')) {
        errorMessage.value = 'Регистрация по email временно недоступна. Пожалуйста, используйте другой метод входа.'
      } else {
        throw authError
      }
      return
    }
    
    // Добавляем пользователя в таблицу personalities
    if (authData.user) {
      const { data: existingData, error: checkError } = await supabase
        .from('personalities')
        .select('user_id')
        .eq('email', email.value)
        .maybeSingle()
      
      if (checkError) throw checkError
      
      if (!existingData) {
        const { error: insertError } = await supabase
          .from('personalities')
          .insert([
            {
              email: email.value,
              role: 'student',
              user_id: authData.user.id
            }
          ])
        
        if (insertError) throw insertError
      }
    }
    
    successMessage.value = 'Проверьте вашу почту для подтверждения!'
    errorMessage.value = ''
    email.value = ''
    password.value = ''
  } catch (error) {
    errorMessage.value = error.message
    console.error('Ошибка регистрации:', error)
  }
}

// Обработка входа
const handleLogin = async () => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    
    if (authError) {
      if (authError.message.includes('Email logins are disabled')) {
        errorMessage.value = 'Вход по email временно недоступен. Пожалуйста, используйте другой метод входа.'
      } else {
        throw authError
      }
      return
    }
    
    localStorage.setItem('userEmail', email.value)
    
    // Проверяем существование записи
    const { data: existingData, error: checkError } = await supabase
      .from('personalities')
      .select('user_id, role')
      .eq('email', email.value)
      .maybeSingle()
    
    if (checkError) throw checkError
    
    // Если записи нет, создаем ее
    if (!existingData) {
      const { error: insertError } = await supabase
        .from('personalities')
        .insert([
          {
            email: email.value,
            role: 'student',
            user_id: authData.user.id
          }
        ])
      
      if (insertError) console.error('Ошибка при создании профиля:', insertError)
      
      window.location.href = '/student_menu.html'
      return
    }

    // Используем существующие данные
    const userData = existingData

    // Перенаправляем в зависимости от роли
    switch (userData.role) {
      case 'tutor':
        window.location.href = '/tutor_menu.html'
        break
      case 'teacher':
        window.location.href = '/teacher_menu.html'
        break
      default:
        window.location.href = '/student_menu.html'
        break
    }

  } catch (error) {
    errorMessage.value = error.message
    console.error('Ошибка входа:', error)
  }
}

// Регистрация с Telegram
const handleSignUpWithTelegram = async () => {
  if (showTelegramVerification.value) {
    const isValid = await verifyTelegramCode()
    if (isValid) {
      await createUserWithTelegram()
    }
  } else {
    await handleSignUp()
  }
}

// Переключение между формами
const toggleForm = () => {
  isLoginForm.value = !isLoginForm.value
  errorMessage.value = ''
  successMessage.value = ''
  showTelegramVerification.value = false
  telegramVerificationCode.value = ''
}

// Вход через Telegram
const handleTelegramLogin = () => {
  if (isTelegramAuthAvailable.value) {
    window.Telegram.WebApp.openTelegramLink('https://t.me/schoolpurtobot?start=web_auth')
  } else {
    // Fallback для десктопов
    window.open('https://t.me/schoolpurtobot?start=web_auth', '_blank')
  }
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
          :disabled="showTelegramVerification"
        >
        <input 
          v-model="password"
          type="password" 
          id="password" 
          placeholder="Пароль"
          v-if="!showTelegramVerification"
        >
        
        <!-- Поле для кода верификации Telegram -->
        <div v-if="showTelegramVerification" class="telegram-verification">
          <input
            v-model="telegramVerificationCode"
            type="text"
            placeholder="Введите код из Telegram"
            maxlength="6"
            class="verification-input"
          >
          <div class="verification-hint" v-if="telegramUsername">
            Код отправлен в Telegram @{{ telegramUsername }}
          </div>
        </div>
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
          @click="isLoginForm ? handleLogin() : handleSignUpWithTelegram()"
        >
          {{ isLoginForm ? 'Войти' : 
             showTelegramVerification ? 'Подтвердить' : 'Зарегистрироваться' }}
        </div>
        <div class="forget_password" v-if="isLoginForm && !showTelegramVerification">
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
  border-radius: 8px;
  color: white;
  display: grid;
  place-items: center;
  transition: all 0.5s ease;
  width: fit-content;
  padding: 10%;
  cursor: pointer;
}

.register-button {
  width: fit-content;
  padding: 10%;
}
.forget_password{
    display: grid;
    place-items: center;
    cursor: pointer;
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
    border-radius: 8px;
    cursor: pointer;
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

.error-message {
  color: #ff3333;
  text-align: center;
  margin-top: -3%;
  font-size: 0.9em;
}

.success-message {
  color: #33cc33;
  text-align: center;
  margin-top: -3%;
  font-size: 0.9em;
}

.chose_enter,
.register {
  cursor: pointer;
  user-select: none;
}

.chose_enter:hover,
.register:hover {
  text-decoration: none;
  transform: scale(1.05);
  transition: all 0.2s ease;
}

.enter_button:hover,
.enter_by_telegram_menu:hover {
  background-color: #9a36b5;
  transform: scale(1.05);
  transition: all 0.2s ease;
}

/* Стили для Telegram верификации */
.telegram-verification {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.verification-input {
  border: 0.15vh solid #b241d1;
  padding: 10px;
  font-family: Evolventa;
  text-align: center;
  letter-spacing: 2px;
  font-size: 18px;
  text-transform: uppercase;
}

.verification-hint {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.verification-input:focus {
  outline: none;
  border: 0.2vh solid #b241d1;
}

/* Адаптивность для мобильных */
@media (max-width: 767px) {
  .centerpart_for_enter {
    width: 90%;
    height: auto;
    padding: 5%;
  }
  
  .enter_or_forget_password {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .verification-input {
    font-size: 16px;
    padding: 8px;
  }
}
</style>