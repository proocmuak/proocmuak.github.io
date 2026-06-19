<script setup>
import { ref } from 'vue'
import { supabase } from './supabase.js'

// Состояния формы
const isLoginForm = ref(true)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)

// Проверка соединения
const checkNetworkConnection = async () => {
  try {
    await fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', mode: 'no-cors' })
    return true
  } catch {
    return false
  }
}

// Обработка ошибок
const handleNetworkError = (error) => {
  console.error('Network error:', error)
  
  if (error.message?.includes('Failed to fetch')) return 'Ошибка соединения. Проверьте интернет.'
  if (error.message?.includes('NetworkError')) return 'Проблемы с сетью. Проверьте подключение.'
  if (error.message?.includes('abort')) return 'Превышено время ожидания ответа от сервера.'
  
  return error.message || 'Произошла непредвиденная ошибка'
}

// Плавное переключение формы
const toggleForm = () => {
  if (isLoading.value) return
  
  errorMessage.value = ''
  successMessage.value = ''
  confirmPassword.value = ''
  isLoginForm.value = !isLoginForm.value
}

// Валидация паролей
const validatePasswords = () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Пароли не совпадают'
    return false
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Пароль должен содержать минимум 6 символов'
    return false
  }
  return true
}

// Создание профиля
const createUserProfileIfNotExists = async (userId, userEmail) => {
  try {
    const { data: existingProfile, error: checkError } = await supabase
      .from('personalities')
      .select('user_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') throw checkError

    if (existingProfile) {
      return { success: true, existing: true, role: existingProfile.role }
    }

    const { error: insertError } = await supabase
      .from('personalities')
      .insert({
        user_id: userId,
        email: userEmail,
        role: 'student',
        updated_at: new Date().toISOString()
      })

    if (insertError && insertError.code !== '23505') throw insertError

    return { success: true, existing: false, role: 'student' }
  } catch (error) {
    console.error('Ошибка профиля:', error)
    return { success: false, error }
  }
}

// Вход
const handleLogin = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const isConnected = await checkNetworkConnection()
    if (!isConnected) {
      errorMessage.value = 'Отсутствует интернет-соединение.'
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    
    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        errorMessage.value = 'Неверный email или пароль.'
      } else {
        errorMessage.value = handleNetworkError(authError)
      }
      return
    }
    
    localStorage.setItem('userEmail', email.value)
    
    await createUserProfileIfNotExists(authData.user.id, email.value)
    
    const { data: userData } = await supabase
      .from('personalities')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle()
    
    const userRole = userData?.role || 'student'
    
    const redirectMap = {
      tutor: '/tutor_menu.html',
      teacher: '/teacher_menu.html',
      student: '/student_menu.html'
    }
    
    window.location.href = redirectMap[userRole]

  } catch (error) {
    errorMessage.value = handleNetworkError(error)
  } finally {
    isLoading.value = false
  }
}

// Регистрация
const handleSignUp = async () => {
  if (isLoading.value) return
  
  if (!validatePasswords()) return
  
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const isConnected = await checkNetworkConnection()
    if (!isConnected) {
      errorMessage.value = 'Отсутствует интернет-соединение.'
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: { emailRedirectTo: `${window.location.origin}/auth-confirm` }
    })
    
    if (authError) {
      if (authError.message.includes('User already registered')) {
        errorMessage.value = 'Пользователь с таким email уже зарегистрирован.'
      } else {
        errorMessage.value = handleNetworkError(authError)
      }
      return
    }
    
    if (authData.user) {
      await createUserProfileIfNotExists(authData.user.id, email.value)
      
      // ✅ Изменено: теперь просто сообщаем об успешной регистрации
      successMessage.value = '✅ Аккаунт успешно создан! Теперь вы можете войти.'
      email.value = ''
      password.value = ''
      confirmPassword.value = ''
      
      // Автоматически переключаем на форму входа через 2 секунды
      setTimeout(() => {
        if (isLoginForm.value === false) {
          toggleForm()
        }
      }, 2000)
    }
    
  } catch (error) {
    errorMessage.value = handleNetworkError(error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <nav class="nav">
        <a href="https://purtoschool.ru/"><button class="nav-link">Курсы</button></a>
        <button class="nav-link">На главную</button>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="main">
      <div class="auth-card">
        <!-- Tabs -->
        <div class="auth-tabs">
          <button 
            class="tab"
            :class="{ active: isLoginForm }"
            @click="!isLoginForm && toggleForm()"
            :disabled="isLoading"
          >
            Вход
          </button>
          <button 
            class="tab"
            :class="{ active: !isLoginForm }"
            @click="isLoginForm && toggleForm()"
            :disabled="isLoading"
          >
            Регистрация
          </button>
        </div>

        <!-- Form with smooth transition -->
        <transition name="form" mode="out-in">
          <form 
            :key="isLoginForm ? 'login' : 'register'"
            class="auth-form" 
            @submit.prevent="isLoginForm ? handleLogin() : handleSignUp()"
          >
            <div class="form-group">
              <input 
                v-model="email"
                type="email"
                class="form-input"
                placeholder="Email"
                :disabled="isLoading"
                required
              >
            </div>

            <div class="form-group">
              <input 
                v-model="password"
                type="password"
                class="form-input"
                placeholder="Пароль"
                :disabled="isLoading"
                required
              >
            </div>

            <transition name="field">
              <div v-if="!isLoginForm" class="form-group">
                <input 
                  v-model="confirmPassword"
                  type="password"
                  class="form-input"
                  placeholder="Повторите пароль"
                  :disabled="isLoading"
                  required
                >
              </div>
            </transition>

            <div v-if="errorMessage" class="message error">
              {{ errorMessage }}
            </div>

            <div v-if="successMessage" class="message success">
              {{ successMessage }}
            </div>

            <button 
              type="submit"
              class="submit-btn"
              :disabled="isLoading"
            >
              {{ isLoading ? 'Загрузка...' : (isLoginForm ? 'Войти' : 'Зарегистрироваться') }}
            </button>

            <div v-if="isLoginForm" class="forgot-password">
              <button type="button" class="link-btn" @click="alert('Функция восстановления пароля будет реализована позже')">
                Забыли пароль?
              </button>
            </div>

            <p class="consent">
              Осуществляя вход или регистрацию, вы выражаете согласие на обработку персональных данных
            </p>
          </form>
        </transition>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-logo">
          <img src="/src/assets/logovector.svg" class="footer-logo-img" alt="Логотип Purto">
          <a href="https://purto.tilda.ws/privacy" class="footer-link">Политика конфиденциальности</a>
        </div>
        <div class="footer-contacts">
          <div class="contact-item">
            <img src="/src/assets/pinkphone.svg" alt="Телефон"> 
            <span>+7 (963) 643 4241</span>
          </div>
          <div class="contact-item">
            <img src="/src/assets/pinkmail.svg" alt="Email">
            <span>Purtoea@gmail.com</span>
          </div>
          <div class="social-icons">
            <a href="https://t.me/katerinaegechembio" target="_blank" class="social-icon">
              <img src="/src/assets/telegramvector.svg" alt="Telegram">
            </a>
            <a href="https://instagram.com/katerinaege.chembio" target="_blank" class="social-icon">
              <img src="/src/assets/instavector.svg" alt="Instagram">
            </a>
            <a href="https://www.youtube.com/@katerinaege.chembio" target="_blank" class="social-icon">
              <img src="/src/assets/youtubevector.svg" alt="YouTube">
            </a>
          </div>
        </div>
      </div>
    </footer>
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
  font-family: Evolventa, system-ui, -apple-system, sans-serif;
  background-image: url(/src/assets/background.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  background-image: url(/src/assets/background_line.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.logo {
  color: white;
  font-size: 1.25rem;
  font-weight: bold;
  font-family: Evolventa;
}

.nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  background: none;
  border: none;
  color: white;
  font-family: Evolventa;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.8;
}

/* Main */
.main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* Auth Card */
.auth-card {
  background: white;
  border-radius: 24px;
  width: 100%;
  max-width: 450px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

/* Tabs */
.auth-tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #eee;
}

.tab {
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1.125rem;
  font-family: Evolventa;
  font-weight: 500;
  color: #999;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.tab.active {
  color: #b241d1;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #b241d1;
}

.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Form transition - ПЛАВНАЯ АНИМАЦИЯ */
.form-enter-active,
.form-leave-active {
  transition: all 0.35s ease;
  overflow: hidden;
}

.form-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.form-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Field transition - для поля "Повторите пароль" */
.field-enter-active,
.field-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.field-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.field-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  width: 100%;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1rem;
  font-family: Evolventa;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 3px rgba(178, 65, 209, 0.1);
}

.form-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

/* Messages */
.message {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  text-align: center;
  font-family: Evolventa;
}

.message.error {
  background: #fff3f3;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
}

.message.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

/* Submit Button */
.submit-btn {
  background: #b241d1;
  color: white;
  border: none;
  padding: 0.875rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  font-family: Evolventa;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #9a36b8;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Forgot Password */
.forgot-password {
  text-align: center;
}

.link-btn {
  background: none;
  border: none;
  color: #b241d1;
  font-family: Evolventa;
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: underline;
}

.link-btn:hover {
  color: #9a36b8;
}

/* Consent */
.consent {
  text-align: center;
  color: #999;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  font-family: Evolventa;
}

/* Footer */
.footer {
  background: rgba(255, 255, 255, 0.9);
  padding: 1.5rem 2rem;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.footer-logo-img {
  height: 50px;
  width: 50px;
}

.footer-link {
  color: #333;
  text-decoration: none;
  font-family: Evolventa;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #b241d1;
}

.footer-contacts {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  align-items: center;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
  font-size: 0.875rem;
  font-family: Evolventa;
}

.contact-item img {
  height: 20px;
  width: 20px;
}

.social-icons {
  display: flex;
  gap: 0.75rem;
}

.social-icon {
  width: 36px;
  height: 36px;
  background: #b241d1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.social-icon:hover {
  transform: scale(1.05);
  background: #9a36b8;
}

.social-icon img {
  width: 18px;
  height: 18px;
  filter: brightness(0) invert(1);
}

/* Адаптивность */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    text-align: center;
    padding: 1rem;
  }
  
  .auth-card {
    margin: 0 1rem;
    padding: 1.5rem;
  }
  
  .footer-content {
    flex-direction: column;
    text-align: center;
  }
  
  .footer-logo {
    flex-direction: column;
  }
  
  .footer-contacts {
    justify-content: center;
  }
  
  .contact-item {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .auth-tabs {
    justify-content: center;
  }
  
  .tab {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }
  
  .form-input {
    padding: 0.75rem;
  }
}
</style>