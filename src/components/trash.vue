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

// Telegram Bot initialization
const telegramBot = ref(null)
const isTelegramAuthAvailable = ref(false)

// Проверяем доступность Telegram Web App API
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
    const { id, username, first_name, last_name } = tgUser
    
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
      generateVerificationCode(username)
    }
  } catch (error) {
    errorMessage.value = 'Ошибка авторизации через Telegram'
    console.error('Telegram auth error:', error)
  }
}

// Генерация кода верификации
const generateVerificationCode = async (telegramUsername) => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Сохраняем код в базе (временная таблица или поле)
    const { error } = await supabase
      .from('telegram_verification')
      .upsert({
        telegram_username: telegramUsername,
        verification_code: code,
        expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 минут
      })

    if (error) throw error

    // Здесь должен быть код для отправки кода через Telegram бота
    // Например, через API вашего бота
    await sendTelegramCode(telegramUsername, code)
    
    successMessage.value = 'Код верификации отправлен в Telegram!'
  } catch (error) {
    errorMessage.value = 'Ошибка генерации кода'
    console.error('Code generation error:', error)
  }
}

// Отправка кода через Telegram бота (заглушка - реализуйте на стороне бота)
const sendTelegramCode = async (username, code) => {
  // Реализуйте отправку через ваш бот API
  console.log(`Send code ${code} to @${username}`)
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
    const { data: verification, error } = await supabase
      .from('telegram_verification')
      .select('*')
      .eq('telegram_username', telegramUsername.value)
      .eq('verification_code', telegramVerificationCode.value.toUpperCase())
      .gt('expires_at', new Date())
      .single()

    if (error || !verification) {
      errorMessage.value = 'Неверный или просроченный код'
      return
    }

    // Создаем аккаунт пользователя
    await createUserWithTelegram()
    
  } catch (error) {
    errorMessage.value = 'Ошибка верификации'
    console.error('Verification error:', error)
  }
}

// Создание пользователя с Telegram
const createUserWithTelegram = async () => {
  try {
    // Создаем auth запись
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: Math.random().toString(36) + Math.random().toString(36) // Случайный пароль
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

    if (profileError) throw profileError

    successMessage.value = 'Аккаунт успешно создан!'
    setTimeout(() => {
      window.location.href = '/student_menu.html'
    }, 2000)

  } catch (error) {
    errorMessage.value = 'Ошибка создания аккаунта'
    console.error('Create user error:', error)
  }
}

// Обычная регистрация с Telegram
const handleSignUpWithTelegram = async () => {
  if (showTelegramVerification.value) {
    await verifyTelegramCode()
  } else {
    await handleSignUp()
  }
}

// Остальные функции остаются без изменений, но добавьте:
const handleTelegramLogin = () => {
  if (isTelegramAuthAvailable.value) {
    window.Telegram.WebApp.openTelegramLink('https://t.me/your_bot?start=web_auth')
  } else {
    // Fallback для десктопов
    window.open('https://t.me/your_bot?start=web_auth', '_blank')
  }
}
</script>

<template>
<div class="allpage">
  <!-- ... остальная разметка без изменений ... -->

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
      <div class="verification-hint">
        Код отправлен в Telegram @{{ telegramUsername }}
      </div>
    </div>
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

  <!-- ... остальная разметка ... -->
</div>
</template>

<style>
/* Добавьте эти стили */
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
</style>