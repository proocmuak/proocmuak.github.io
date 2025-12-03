<script setup>
import { ref, onMounted, onUnmounted, defineEmits, computed, onBeforeUnmount } from 'vue'
import { supabase } from '../supabase.js'

const emit = defineEmits(['component-change'])
const userEmail = ref('')
const firstName = ref('Добавьте имя')
const lastName = ref('в настройках')
const avatarUrl = ref(null)
const loading = ref(true)
const error = ref(null)
const studentData = ref({})
const currentCardIndex = ref(0)
const cardInterval = ref(null)
const transitionDirection = ref('next') // 'next' или 'prev' для анимации
let subscription = null

const switchComponent = (componentName) => {
  emit('component-change', componentName)
}

// Функция для загрузки данных пользователя
const fetchUserData = async () => {
  try {
    if (!userEmail.value) return
    
    const { data, error: supabaseError } = await supabase
      .from('personalities')
      .select('first_name, last_name, avatar_id, user_id')
      .eq('email', userEmail.value)
      .single()

    if (supabaseError) throw supabaseError
    
    firstName.value = data?.first_name || 'Добавьте имя'
    lastName.value = data?.last_name || 'в настройках'
    
    if (data?.avatar_id) {
      const { data: avatarData, error: avatarError } = await supabase
        .from('avatar')
        .select('id, name, ref')
        .eq('id', data.avatar_id)
        .single()
      
      if (!avatarError && avatarData) {
        avatarUrl.value = avatarData.ref
      }
    }
    
  } catch (err) {
    console.error('Ошибка:', err)
    error.value = err.message
  }
}

// Функция для загрузки данных о предметах из таблицы students
const fetchStudentData = async () => {
  try {
    if (!userEmail.value) {
      console.log('Нет email для загрузки данных студента')
      studentData.value = {}
      return
    }
    
    const { data: userData, error: userError } = await supabase
      .from('personalities')
      .select('user_id')
      .eq('email', userEmail.value)
      .maybeSingle()
    
    if (userError) {
      console.error('Ошибка при получении user_id:', userError)
      throw userError
    }
    
    if (!userData?.user_id) {
      console.log('user_id не найден для email:', userEmail.value)
      studentData.value = {}
      return
    }
    
    const { data, error: studentsError } = await supabase
      .from('students')
      .select('subject1, subject2')
      .eq('user_id', userData.user_id)
      .maybeSingle()
    
    if (studentsError && studentsError.code !== 'PGRST116') {
      console.error('Ошибка при запросе students:', studentsError)
      throw studentsError
    }
    
    console.log('Данные студента из БД:', data)
    studentData.value = data || {}
    
  } catch (err) {
    console.error('Ошибка при загрузке данных студента:', err)
    studentData.value = {}
  }
}

// Проверяем, заполнено ли поле (не null, не undefined, не пустая строка)
const isFieldFilled = (field) => {
  return field !== null && field !== undefined && String(field).trim() !== ''
}

// Извлекаем тип экзамена из строки предмета
const getExamType = (subject) => {
  if (!subject) return ''
  const subjectLower = String(subject).toLowerCase()
  if (subjectLower.includes('огэ')) return 'ОГЭ'
  if (subjectLower.includes('егэ')) return 'ЕГЭ'
  return ''
}

// Логика для определения текста и ссылки для первой карточки (ВСЕГДА МАТЕМАТИКА)
const getFirstCardData = () => {
  if (!studentData.value || Object.keys(studentData.value).length === 0) {
    return null
  }
  
  const subjects = [studentData.value.subject1, studentData.value.subject2]
  
  // Проверяем, есть ли ОГЭ в любом из предметов
  const hasOGE = subjects.some(subject => 
    subject && String(subject).toLowerCase().includes('огэ')
  )
  
  // Проверяем, есть ли ЕГЭ в любом из предметов
  const hasEGE = subjects.some(subject => 
    subject && String(subject).toLowerCase().includes('егэ')
  )
  
  if (hasOGE) {
    return {
      text: 'Подготовка к ОГЭ по математике',
      link: 'https://t.me/math_probaschool',
      type: 'telegram',
      compact: true,
      hasButton: true
    }
  }
  
  if (hasEGE) {
    return {
      text: 'Подготовка к ЕГЭ по базовой математике',
      link: 'https://t.me/math_probaschool',
      type: 'telegram',
      compact: true,
      hasButton: true
    }
  }
  
  return null
}

// Логика для определения текста и ссылки для второй карточки
const getSecondCardData = () => {
  if (!studentData.value || Object.keys(studentData.value).length === 0) {
    return null
  }
  
  const subject1 = studentData.value.subject1
  const subject2 = studentData.value.subject2
  
  // Если оба предмета заполнены - не показываем вторую карточку
  if (isFieldFilled(subject1) && isFieldFilled(subject2)) {
    return null
  }
  
  // Определяем недостающий предмет
  
  // Если нет химии (subject1 пусто), а биология есть
  if (!isFieldFilled(subject1) && isFieldFilled(subject2)) {
    // Определяем тип экзамена из биологии (предполагаем, что будет тот же тип)
    const examType = getExamType(subject2)
    
    return {
      text: `Записаться на курс по Химии ${examType}`,
      link: 'https://purtoschool.ru/',
      type: 'course',
      compact: true,
      hasButton: true
    }
  }
  
  // Если есть химия, а биологии нет
  if (isFieldFilled(subject1) && !isFieldFilled(subject2)) {
    // Определяем тип экзамена из химии
    const examType = getExamType(subject1)
    
    return {
      text: `Записаться на курс по Биологии ${examType}`,
      link: 'https://purtoschool.ru/',
      type: 'course',
      compact: true,
      hasButton: true
    }
  }
  
  // Если оба пустые
  return {
    text: 'Записаться на курс по химии или биологии',
    link: 'https://purtoschool.ru/',
    type: 'course',
    compact: true,
    hasButton: true
  }
}

// Третья карточка - пригласи друга (без кнопки)
const getThirdCardData = () => {
  return {
    text: 'Приведи друга - получите скидку 500₽ каждый!',
    description: 'Учитесь вместе выгоднее',
    link: 'https://purtoschool.ru/invite',
    type: 'invite',
    emoji: '🎁',
    compact: false,
    hasButton: false // НЕТ КНОПКИ
  }
}

// Все доступные карточки
const allCards = computed(() => {
  const cards = []
  const firstCard = getFirstCardData()
  const secondCard = getSecondCardData()
  const thirdCard = getThirdCardData()
  
  if (firstCard) cards.push(firstCard)
  if (secondCard) cards.push(secondCard)
  cards.push(thirdCard) // Всегда показываем карточку с приглашением
  
  return cards
})

// Показываем текущую карточку
const currentCard = computed(() => {
  if (allCards.value.length === 0) return null
  return allCards.value[currentCardIndex.value]
})

// Переключение на следующую карточку с анимацией
const nextCard = () => {
  if (allCards.value.length <= 1) return
  transitionDirection.value = 'next'
  currentCardIndex.value = (currentCardIndex.value + 1) % allCards.value.length
  resetTimer()
}

// Переключение на предыдущую карточку с анимацией
const prevCard = () => {
  if (allCards.value.length <= 1) return
  transitionDirection.value = 'prev'
  currentCardIndex.value = (currentCardIndex.value - 1 + allCards.value.length) % allCards.value.length
  resetTimer()
}

// Переход к конкретной карточке
const goToCard = (index) => {
  if (index === currentCardIndex.value) return
  
  transitionDirection.value = index > currentCardIndex.value ? 'next' : 'prev'
  currentCardIndex.value = index
  resetTimer()
}

// Сброс таймера автоматического переключения
const resetTimer = () => {
  if (cardInterval.value) {
    clearInterval(cardInterval.value)
  }
  startCarousel()
}

// Запуск автоматической карусели
const startCarousel = () => {
  if (allCards.value.length <= 1) return
  
  cardInterval.value = setInterval(() => {
    nextCard()
  }, 5000) // 5 секунд
}

// Подписка на изменения в реальном времени
const setupRealtime = () => {
  subscription = supabase
    .channel('personal_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'personalities',
        filter: `email=eq.${userEmail.value}`
      },
      () => {
        fetchUserData()
        fetchStudentData()
      }
    )
    .subscribe()
}

onMounted(async () => {
  try {
    userEmail.value = localStorage.getItem('userEmail') || ''
    
    if (!userEmail.value) throw new Error('Email не найден в localStorage')
    
    await Promise.all([fetchUserData(), fetchStudentData()])
    setupRealtime()
    
    // Запускаем карусель после загрузки данных
    setTimeout(() => {
      startCarousel()
    }, 1000)
    
  } catch (err) {
    console.error('Ошибка инициализации:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (cardInterval.value) {
    clearInterval(cardInterval.value)
  }
})

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
})
</script>

<template>
  <div class="leftpartpage">
    <div class="leftmenu">
      <div class="about_student_big" @click="switchComponent('main_student_page')">
        <div class="avatar" @click="switchComponent('main_student_page')">
          <img v-if="avatarUrl" :src="avatarUrl" class="photo_avatar">
          <div v-else class="default-avatar">Выберите аватарку</div>
        </div>
        <div class="about_student" @click="switchComponent('main_student_page')">
            <div class="user-info" 
     :class="{ 'settings-message': firstName === 'Добавьте имя' && lastName === 'в настройках' }" @click="switchComponent('main_student_page')">
  {{ firstName }} {{ lastName }}
</div>
        </div>
      </div>

      <div class="line"></div>
      <div class="menu">
        <div class="menu_button"> <a href="/task_bank.html" class="black_text_href">Банк заданий</a></div>
        <div class="menu_button" @click="switchComponent('SubjectRating')">Рейтинг</div>
        <div class="menu_button" @click="switchComponent('HomeworkList')">Домашние задания</div>
        <div class="menu_button">Уведомления</div>
        <button @click="switchComponent('settings')" class="menu_button">Настройки</button>
        <div class="exit">Выйти</div>
      </div>
    </div>
    
    <div class="aboutcourses">
      <div class="about_courses_bold">Курсы по другим предметам</div>  
      <div class="second_line"></div>
      
      <!-- Карусель с карточками -->
      <div class="carousel-container">
        <!-- Стрелка назад -->
        <button 
          v-if="allCards.length > 1" 
          @click="prevCard" 
          class="carousel-arrow carousel-arrow-prev"
          aria-label="Предыдущая карточка"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <!-- Контейнер для карточек с внутренними отступами -->
        <div class="carousel-inner-container">
          <div class="carousel">
            <!-- Текущая карточка -->
            <div 
              v-if="currentCard" 
              class="course-card"
              :class="`card-type-${currentCard.type} slide-${transitionDirection} ${currentCard.compact ? 'card-compact' : 'card-normal'} ${currentCard.hasButton ? 'with-button' : 'no-button'}`"
              :key="currentCardIndex"
            >
              <div class="course-card-content">
                <!-- Эмодзи для карточки приглашения -->
                <div v-if="currentCard.emoji" class="card-emoji">
                  {{ currentCard.emoji }}
                </div>
                
                <div class="course-text">{{ currentCard.text }}</div>
                
                <!-- Описание для карточки приглашения -->
                <div v-if="currentCard.description" class="course-description">
                  {{ currentCard.description }}
                </div>
                
                <!-- Кнопка только для карточек с hasButton: true -->
                <a 
                  v-if="currentCard.hasButton" 
                  :href="currentCard.link" 
                  target="_blank" 
                  class="course-button"
                >
                  {{ currentCard.type === 'telegram' ? 'Перейти в Telegram' : 'Записаться на курс' }}
                </a>
              </div>
            </div>
            
            <!-- Если нет карточек для показа -->
            <div v-if="!currentCard" class="no-courses">
              <div class="about_courses_main_text">Тут будет что-то грандиозное</div>
              <a href="https://purtoschool.ru/" target="_blank" class="about_courses_button_chose">Выбрать курс</a>
            </div>
          </div>
        </div>
        
        <!-- Стрелка вперед -->
        <button 
          v-if="allCards.length > 1" 
          @click="nextCard" 
          class="carousel-arrow carousel-arrow-next"
          aria-label="Следующая карточка"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        
        <!-- Индикаторы (точки) -->
        <div v-if="allCards.length > 1" class="carousel-indicators">
          <button 
            v-for="(card, index) in allCards" 
            :key="index"
            @click="goToCard(index)"
            :class="['carousel-indicator', { active: currentCardIndex === index }]"
            :aria-label="`Перейти к карточке ${index + 1}`"
          >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Существующие стили остаются без изменений */
*{
  font-family: Evolventa;
}
.leftpartpage{
    display: grid;
    place-content: center;
    grid-template-rows: 40% 55%;
    gap: 5%;
    height: 80vh;
    position: sticky;
    top: 0;
  }
.error-message {
  color: #ff0000;
  padding: 10px;
  background-color: #ffeeee;
  border-radius: 4px;
  margin: 10px 0;
}
.leftmenu{
    display: grid;
    grid-template-rows: 20% 0.65% 60%;
    gap: 7.5%;
    background-color: #f9f8ff;
    border-radius: 5%;
}

.about_student_big{
    display: grid;
    align-items: center;
    grid-template-columns: 25% 70%;
    gap: 5%;
    padding-left: 10%;
    padding-top: 2%;
    cursor: pointer;
}
.photo_avatar{
    height: 7vh;
    width: 7vh;
    border-radius: 50%;
    object-fit: cover;
}
.default-avatar {
    height: 7vh;
    width: 7vh;
    border-radius: 50%;
    background-color: #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7vw;
    text-align: center;
    color: #666;
}
.about_student{
    display: grid;
    grid-template-rows: 45% 15%;
    gap: 5%;
}

.number_of_points{
    font-size: 0.9vw;
}
.line{
    background-color: #b241d1;
    width: 80%;
    margin-left: 10%;
}
.second_line{
    background-color: #b241d1;
    width: 100%;
}
.menu{
    display: grid;
    grid-template-rows: 12% 12% 12% 12% 12% 12% 12% 12% 12%;
    gap: 3%;
    padding-left: 10%;
}
.menu_button{
    background-color: #f9f8ff;
    border: 0px;
    font-family: Evolventa;
    font-size: 1.75vh;
    cursor: pointer;
    width: fit-content;
}
.aboutcourses{
    background-color: #f9f8ff;
    display: grid;
    grid-template-rows: 18% 0.5% auto;
    gap: 2%;
    padding-left: 10%;
    padding-right: 5%;
    padding-top: 5%;
    padding-bottom: 5%;
    border-radius: 5%;
    position: relative;
    overflow: hidden;
}
.about_courses_bold{
    font-size: 1.5vw;
    font-weight: bold;
}
.about_courses_main_text{
    font-size: 1vw;
}
.about_courses_button_chose{
    color: white;
    background-color: #b241d1;
    display: grid;
    place-content: center;
    border-radius: 5vw;
    padding: 8px 16px;
    text-decoration: none;
    text-align: center;
    font-size: 0.9vw;
    margin-top: 10px;
}
.user-info{
    font-weight: bold;
}
.user-info.settings-message {
  color: #b241d1;
  font-size: 1.5vh;
  font-weight: bold;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

.black_text_href{
  color: black;
}

/* Стили для карусели */
.carousel-container {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Внутренний контейнер для отступов */
.carousel-inner-container {
  width: 100%;
  height: 100%;
  padding: 0 25px; /* Увеличиваем отступы от стрелок */
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

/* Базовые стили для всех карточек */
.course-card {
  background: transparent !important;
  border-radius: 8px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  box-shadow: none !important;
  border: none !important;
  opacity: 0;
  transition: opacity 0.6s ease, transform 0.6s ease;
}

/* Компактные карточки (математика и курсы) */
.course-card.card-compact {
  padding: 15px;
}

.course-card.card-normal {
  padding: 10px 15px;
}

.course-card.slide-next {
  animation: slideInNext 0.6s ease forwards;
}

.course-card.slide-prev {
  animation: slideInPrev 0.6s ease forwards;
}

@keyframes slideInNext {
  0% {
    opacity: 0;
    transform: translateX(30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInPrev {
  0% {
    opacity: 0;
    transform: translateX(-30px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Контент карточек */
.course-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-align: center;
  max-width: 90%;
}

/* Для карточек с кнопкой */
.card-compact .course-card-content,
.with-button .course-card-content {
  gap: 12px;
}

/* Для карточек БЕЗ кнопки (приглашение) */
.card-normal .course-card-content,
.no-button .course-card-content {
  gap: 5px;
  justify-content: center;
}

/* ЕЩЁ УМЕНЬШЕННАЯ иконка подарка */
.card-emoji {
  font-size: 1.8vw; /* Ещё уменьшено с 2vw до 1.8vw */
  margin-bottom: 2px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* Текст для компактных карточек */
.card-compact .course-text {
  font-size: 1.2vw;
  font-weight: 700;
  color: #333;
  line-height: 1.3;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  margin: 3px 0;
}

/* Текст для нормальных карточек (приглашение) */
.card-normal .course-text {
  font-size: 1.1vw;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
  margin: 2px 0;
  padding: 0 5px;
}

.card-type-invite .course-text {
  color: #b241d1;
  background: linear-gradient(45deg, #b241d1, #9a2cb6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.course-description {
  font-size: 0.75vw; /* Уменьшено с 0.8vw */
  color: #666;
  line-height: 1.3;
  max-width: 85%;
  margin: 1px auto;
  font-weight: 400;
}

/* Кнопки для компактных карточек */
.card-compact .course-button {
  padding: 10px 20px;
  font-size: 0.85vw;
  min-width: 150px;
  margin-top: 5px;
}

/* Кнопки для нормальных карточек (приглашение) - СКРЫТЫ */
.card-normal .course-button {
  display: none; /* Скрываем кнопку для карточки приглашения */
}

/* Базовые стили кнопок */
.course-button {
  color: white;
  background: linear-gradient(135deg, #b241d1, #9a2cb6);
  border-radius: 22px;
  text-decoration: none;
  text-align: center;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(178, 65, 209, 0.2);
  position: relative;
  overflow: hidden;
}

.course-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s ease;
}

.course-button:hover::before {
  left: 100%;
}

.course-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(154, 44, 182, 0.3);
}

/* Цвета кнопок для разных типов карточек */
.card-type-invite .course-button {
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  box-shadow: 0 3px 8px rgba(255, 107, 107, 0.2);
}

.card-type-invite .course-button:hover {
  box-shadow: 0 5px 12px rgba(255, 107, 107, 0.3);
}

.card-type-telegram .course-button {
  background: linear-gradient(135deg, #0088cc, #00aced);
  box-shadow: 0 3px 8px rgba(0, 136, 204, 0.2);
}

.card-type-telegram .course-button:hover {
  box-shadow: 0 5px 12px rgba(0, 136, 204, 0.3);
}

.no-courses {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 15px;
}

/* Уменьшенные стрелки карусели с БОЛЬШИМИ ОТСТУПАМИ */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(255, 255, 255, 0.9);
  color: #b241d1;
  border: 1.5px solid #b241d1;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.carousel-arrow:hover {
  background-color: #b241d1;
  color: white;
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 3px 10px rgba(178, 65, 209, 0.2);
}

.carousel-arrow svg {
  width: 14px;
  height: 14px;
}

/* УВЕЛИЧЕННЫЕ ОТСТУПЫ СТРЕЛОК ОТ КОНТЕНТА */
.carousel-arrow-prev {
  left: 5px;
}

.carousel-arrow-next {
  right: 5px;
}

/* Индикаторы (точки) */
.carousel-indicators {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.carousel-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #b241d1;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.carousel-indicator.active {
  background-color: #b241d1;
  transform: scale(1.1);
  box-shadow: 0 0 6px rgba(178, 65, 209, 0.3);
}

.carousel-indicator:hover {
  background-color: rgba(178, 65, 209, 0.3);
}

/* Эффект свечения для активной карточки */
.course-card::after {
  content: '';
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border-radius: 8px;
  background: radial-gradient(circle at center, rgba(178, 65, 209, 0.06), transparent 70%);
  z-index: -1;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.course-card.slide-next::after,
.course-card.slide-prev::after {
  opacity: 1;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from {
    background: radial-gradient(circle at center, rgba(178, 65, 209, 0.06), transparent 70%);
  }
  to {
    background: radial-gradient(circle at center, rgba(178, 65, 209, 0.1), transparent 70%);
  }
}

/* Дополнительные стили для лучшего отображения */
.course-card-content {
  max-width: 85%;
}

/* Особые стили для карточки приглашения без кнопки */
.card-normal.no-button .card-emoji {
  margin-bottom: 3px;
}

.card-normal.no-button .course-text {
  margin-bottom: 3px;
}

.card-normal.no-button .course-description {
  margin-top: 2px;
}
</style>