<script setup>
import { ref } from 'vue'
import { supabase } from './supabase.js'

// Состояния формы
const isLoginForm = ref(true)
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)

// Проверка соединения
const checkNetworkConnection = async () => {
  try {
    const response = await fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors'
    })
    return true
  } catch {
    return false
  }
}

// Улучшенная обработка ошибок
const handleNetworkError = (error) => {
  console.error('Network error:', error)
  
  if (error.message?.includes('Failed to fetch')) {
    return 'Ошибка соединения. Проверьте интернет и попробуйте снова.'
  }
  
  if (error.message?.includes('NetworkError')) {
    return 'Проблемы с сетью. Проверьте подключение к интернету.'
  }
  
  if (error.message?.includes('abort')) {
    return 'Превышено время ожидания ответа от сервера.'
  }
  
  return error.message || 'Произошла непредвиденная ошибка'
}

// Переключение между формами
const toggleForm = () => {
  isLoginForm.value = !isLoginForm.value
  errorMessage.value = ''
  successMessage.value = ''
}

// ИСПРАВЛЕННАЯ функция: создает профиль только если его нет
const createUserProfileIfNotExists = async (userId, userEmail) => {
  console.log('Создание профиля для:', userId, userEmail)
  
  try {
    // Сначала проверяем существование профиля
    const { data: existingProfile, error: checkError } = await supabase
      .from('personalities')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    console.log('Результат проверки профиля:', existingProfile, checkError)

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 - не найдено, это нормально
      console.error('Ошибка при проверке профиля:', checkError)
      throw checkError
    }

    // Если профиль уже существует, НЕ перезаписываем его
    if (existingProfile) {
      console.log('Профиль уже существует, роль:', existingProfile.role)
      return { success: true, existing: true, role: existingProfile.role }
    }

    console.log('Создаем новый профиль...')
    // Создаем новый профиль только если его нет
    const { data, error: insertError } = await supabase
      .from('personalities')
      .insert({
        user_id: userId,
        email: userEmail,
        role: 'student', // Только для новых пользователей
        updated_at: new Date().toISOString()
      })
      .select()

    console.log('Результат создания профиля:', data, insertError)

    if (insertError) {
      console.error('Ошибка при создании профиля:', insertError)
      // Если это ошибка дублирования, игнорируем (на случай race condition)
      if (insertError.code !== '23505') {
        throw insertError
      }
    }

    return { success: true, existing: false, role: 'student' }
  } catch (error) {
    console.error('Критическая ошибка профиля:', error)
    return { success: false, error }
  }
}

// Обработка входа с улучшенной обработкой ошибок
const handleLogin = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Проверка соединения
    const isConnected = await checkNetworkConnection()
    if (!isConnected) {
      errorMessage.value = 'Отсутствует интернет-соединение. Проверьте подключение.'
      return
    }

    // Аутентификация с таймаутом
    const authPromise = supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    
    // Таймаут для запроса
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 15000)
    )
    
    const { data: authData, error: authError } = await Promise.race([
      authPromise,
      timeoutPromise
    ])
    
    if (authError) {
      if (authError.message.includes('Email logins are disabled')) {
        errorMessage.value = 'Вход по email временно недоступен.'
      } else if (authError.message.includes('Invalid login credentials')) {
        errorMessage.value = 'Неверный email или пароль.'
      } else {
        errorMessage.value = handleNetworkError(authError)
      }
      return
    }
    
    localStorage.setItem('userEmail', email.value)
    
    // Создаем профиль только если его нет (НЕ перезаписываем существующий)
    const profileResult = await createUserProfileIfNotExists(authData.user.id, email.value)
    
    if (!profileResult.success) {
      console.warn('Профиль не был создан/обновлен, но продолжаем вход')
    }
    
    // Получаем актуальную роль пользователя из базы
    const { data: userData, error: userError } = await supabase
      .from('personalities')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle()
    
    let userRole = 'student' // значение по умолчанию
    if (!userError && userData) {
      userRole = userData.role || 'student'
    }
    
    console.log('Роль пользователя для редиректа:', userRole)
    
    // Перенаправляем
    switch (userRole) {
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
    console.error('Ошибка входа:', error)
    errorMessage.value = handleNetworkError(error)
  } finally {
    isLoading.value = false
  }
}

// Обработка регистрации с улучшенной обработкой ошибок
const handleSignUp = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Проверка соединения
    const isConnected = await checkNetworkConnection()
    if (!isConnected) {
      errorMessage.value = 'Отсутствует интернет-соединение. Проверьте подключение.'
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth-confirm`
      }
    })
    
    if (authError) {
      if (authError.message.includes('Email logins are disabled')) {
        errorMessage.value = 'Регистрация по email временно недоступна.'
      } else if (authError.message.includes('User already registered')) {
        errorMessage.value = 'Пользователь с таким email уже зарегистрирован.'
      } else {
        errorMessage.value = handleNetworkError(authError)
      }
      return
    }
    
    if (authData.user) {
      // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Создаем профиль сразу при регистрации
      const profileResult = await createUserProfileIfNotExists(authData.user.id, email.value)
      
      if (profileResult.success) {
        if (profileResult.existing) {
          console.log('Профиль уже существовал (необычный случай)')
        } else {
          console.log('Профиль успешно создан для нового пользователя')
        }
      } else {
        console.error('Не удалось создать профиль:', profileResult.error)
        // В зависимости от важности профиля можно либо прервать регистрацию,
        // либо продолжить с предупреждением
        if (profileResult.error?.code === '42501') {
          errorMessage.value = 'Ошибка прав доступа к базе данных.'
          return
        }
      }
      
      successMessage.value = 'Регистрация успешна! Проверьте вашу почту для подтверждения.'
      email.value = ''
      password.value = ''
    }
    
  } catch (error) {
    console.error('Ошибка регистрации:', error)
    errorMessage.value = handleNetworkError(error)
  } finally {
    isLoading.value = false
  }
}

// Вход через Telegram
const handleTelegramLogin = async () => {
  if (isLoading.value) return
  alert('Функция входа через Telegram будет реализована позже')
}
</script>

<template>
<div class="allpage">
  <!-- Остальная разметка без изменений -->
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
            :class="{ 'disabled': isLoading }"
          >
            Вход
          </div>
          <div 
            class="register"
            :style="{ color: !isLoginForm ? 'black' : 'grey' }"
            @click="!isLoginForm ? null : toggleForm()"
            :class="{ 'disabled': isLoading }"
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
          :disabled="isLoading"
          @keyup.enter="isLoginForm ? handleLogin() : handleSignUp()"
        >
        <input 
          v-model="password"
          type="password" 
          id="password" 
          placeholder="Пароль"
          :disabled="isLoading"
          @keyup.enter="isLoginForm ? handleLogin() : handleSignUp()"
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
          :class="{ 
            'register-button': !isLoginForm,
            'loading': isLoading
          }"
          @click="isLoginForm ? handleLogin() : handleSignUp()"
        >
          {{ isLoading ? 'Загрузка...' : (isLoginForm ? 'Войти' : 'Зарегистрироваться') }}
        </div>
        <div 
          class="forget_password" 
          v-if="isLoginForm && !isLoading"
          @click="!isLoading ? alert('Функция восстановления пароля будет реализована позже') : null"
        >
          Забыли пароль?
        </div>
      </div>

      <div class="enter_by_telegram">
        <div class="enter_by_telegram_line"></div>
        <div 
          class="enter_by_telegram_menu"
          @click="handleTelegramLogin"
          :class="{ 'disabled': isLoading }"
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
      <img src="/src/assets/logovector.svg" class="logoicon" alt="Логотип Purto">
      <div class="privacy_policy"><a href="https://purto.tilda.ws/privacy" class="black_text_href">Политика конфиденциальности</a></div>
    </div>
    <div class="contact">
      <div class="phone">
        <img src="/src/assets/pinkphone.svg" class="logo_without_circle" alt="Телефон"> 
        +7 (963) 643 4241
      </div>
      <div class="mail"><img src="/src/assets/pinkmail.svg" class="logo_without_circle" alt="Email">Purtoea@gmail.com</div>
      <div class="icons">
        <a href="https://t.me/katerinaegechembio" target="_blank" rel="noopener noreferrer">
            <div class="circle">
                <img src="/src/assets/telegramvector.svg" class="icon" alt="Telegram">
            </div>
        </a>
        <a href="https://instagram.com/katerinaege.chembio" target="_blank" rel="noopener noreferrer">
            <div class="circle">
             <img src="/src/assets/instavector.svg" class="icon" alt="Instagram">
            </div>
        </a>
        <a href="https://www.youtube.com/@katerinaege.chembio" target="_blank" rel="noopener noreferrer">
            <div class="circle">
            <img src="/src/assets/youtubevector.svg" class="icon" alt="YouTube">
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
    height: 100vh;
    min-height: 100vh;
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
    min-height: 100vh;
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
    cursor: pointer;
}

.go_back{
    display: grid;
    place-items: center;
    white-space: nowrap;
    cursor: pointer;
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
    transition: all 0.2s ease;
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

@media (max-width: 767px) {
  .centerpart_for_enter {
    width: 90%;
    height: auto;
    padding: 5%;
  }
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
    transition: height 0.3s ease;
}

.chose_of_login_or_register_line_second{
    background-color: black;
    height: 50%;
    transition: height 0.3s ease;
}

.chose_enter{
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.register{
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.chose_enter:hover,
.register:hover {
    transform: scale(1.05);
}

.chose_enter.disabled,
.register.disabled {
    cursor: not-allowed;
    opacity: 0.5;
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
    font-size: 1em;
    border-radius: 4px;
    height: 45px;
}

#email_or_phone:focus, #password:focus{
     outline: none;
    border: 0.2vh solid #b241d1;
}

input::placeholder{
    color: black;
    opacity: 1;
}

input:disabled {
    background-color: #f0f0f0;
    cursor: not-allowed;
}

.enter_or_forget_password{
    display: grid;
    grid-template-columns: 20% 30%;
    gap: 50%;
}

@media (max-width: 767px) {
  .enter_or_forget_password {
    grid-template-columns: 1fr;
    gap: 15px;
  }
}

.enter_button {
  background-color: #b241d1;
  border-radius: 8px;
  color: white;
  display: grid;
  place-items: center;
  transition: all 0.3s ease;
  width: fit-content;
  padding: 10%;
  cursor: pointer;
  min-height: 45px;
  font-weight: bold;
}

.enter_button:hover {
  background-color: #9a36b5;
  transform: scale(1.05);
}

.enter_button:active {
  transform: scale(0.95);
}

.enter_button.loading {
  opacity: 0.7;
  cursor: not-allowed;
  position: relative;
}

.enter_button.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  border-left-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.register-button {
  width: fit-content;
  padding: 10%;
}

.forget_password{
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #b241d1;
    text-decoration: underline;
    transition: all 0.2s ease;
}

.forget_password:hover {
    color: #9a36b5;
}

.enter_by_telegram{
  display: grid;
  grid-template-rows: 1% 75%;
  gap: 20%;
}

.enter_by_telegram_line{
    background-color: black;
    height: 1px;
}

.enter_by_telegram_menu{
    background-color: #b241d1;
    color: white;
    display: grid;
    place-items: center;
    border-radius: 8px;
    cursor: pointer;
    min-height: 45px;
    font-weight: bold;
    transition: all 0.3s ease;
}

.enter_by_telegram_menu:hover {
  background-color: #9a36b5;
  transform: scale(1.05);
}

.enter_by_telegram_menu:active {
  transform: scale(0.95);
}

.enter_by_telegram_menu.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.consent{
    color: grey;
    text-align: center;
    font-size: 0.9em;
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
    background-color: rgba(255, 255, 255, 0.9);
}

@media (max-width: 767px) {
  .bottominfo{
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }
}

.logo_and_privacy{
    display: grid;
    place-items: center;
    grid-template-columns: 30% 50%;
    gap: 20%;
}

@media (max-width: 767px) {
  .logo_and_privacy {
    grid-template-columns: 1fr;
    gap: 10px;
    text-align: center;
  }
}

.contact{
    display: grid;
    grid-template-columns: 30% 35% 30%;
    gap: 5%;
    font-size: 1.5vh;
}

@media (max-width: 767px) {
  .contact {
    grid-template-columns: 1fr;
    gap: 15px;
    font-size: 12px;
  }
}

.phone, .mail {
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
}

.icons{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    place-items: center;
    gap: 5%;
}

.icon{
    height: 60%;
    width: 60%;
}

.black_text_href{
  color: black;
  text-decoration: none;
  transition: all 0.2s ease;
}

.black_text_href:hover {
  color: #b241d1;
  text-decoration: underline;
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
  padding: 8px;
  background-color: #fff3f3;
  border-radius: 4px;
  border: 1px solid #ffcdd2;
}

.success-message {
  color: #33cc33;
  text-align: center;
  margin-top: -3%;
  font-size: 0.9em;
  padding: 8px;
  background-color: #f3fff3;
  border-radius: 4px;
  border: 1px solid #c8e6c9;
}

.error-message.network-error {
  background-color: #fff3f3;
  border: 1px solid #ffcdd2;
  padding: 10px;
  border-radius: 5px;
}

.chose_enter,
.register {
  cursor: pointer;
  user-select: none;
}

.chose_enter:hover,
.register:hover {
  text-decoration: none;
}

.enter_button:hover,
.enter_by_telegram_menu:hover {
  background-color: #9a36b5;
}
</style>