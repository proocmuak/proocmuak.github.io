<template>
  <div class="leftpartpage">
    <div class="leftmenu">
      <div class="about_student_big" @click="switchComponent('main_student_page')">
        <div class="avatar">
          <img v-if="avatarUrl" :src="avatarUrl" class="photo_avatar">
          <div v-else class="default-avatar">Выберите аватарку</div>
        </div>
        <div class="about_student">
          <div class="user-info" :class="{ 'settings-message': firstName === 'Добавьте имя' && lastName === 'в настройках' }">
            {{ firstName }} {{ lastName }}
          </div>
        </div>
      </div>

      <div class="line"></div>
      
      <div class="menu">
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'main_student_page' }"
          @click="switchComponent('main_student_page')"
        >
          Мои курсы
        </button>
        <a href="/task_bank.html" class="menu_button black_text_href">Банк заданий</a>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'SubjectRating' }"
          @click="switchComponent('SubjectRating')"
        >
          Рейтинг
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'HomeworkList' }"
          @click="switchComponent('HomeworkList')"
        >
          Домашние задания
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'StudentStatic' }"
          @click="switchComponent('StudentStatic')"
        >
          Статистика
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'settings' }"
          @click="switchComponent('settings')"
        >
          Настройки
        </button>
      </div>
    </div>
    
    <div class="aboutcourses">
      <div class="about_courses_bold">Курсы по другим предметам</div>  
      <div class="second_line"></div>
      
      <div class="carousel-container">
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
        
        <div class="carousel-inner-container">
          <div class="carousel">
            <div 
              v-if="currentCard" 
              class="course-card"
              :class="`card-type-${currentCard.type} slide-${transitionDirection} ${currentCard.compact ? 'card-compact' : 'card-normal'} ${currentCard.hasButton ? 'with-button' : 'no-button'}`"
              :key="currentCardIndex"
            >
              <div class="course-card-content">
                <div v-if="currentCard.emoji" class="card-emoji">
                  {{ currentCard.emoji }}
                </div>
                
                <div class="course-text">{{ currentCard.text }}</div>
                
                <div v-if="currentCard.description" class="course-description">
                  {{ currentCard.description }}
                </div>
                
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
            
            <div v-if="!currentCard" class="no-courses">
              <div class="about_courses_main_text">Тут будет что-то грандиозное</div>
              <a href="https://purtoschool.ru/" target="_blank" class="about_courses_button_chose">Выбрать курс</a>
            </div>
          </div>
        </div>
        
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

<script setup>
import { ref, onMounted, onUnmounted, defineEmits, computed, onBeforeUnmount, watch } from 'vue'
import { supabase } from '../supabase.js'

// === Конфигурация прокси сервера ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

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
const transitionDirection = ref('next')
const activeMenu = ref('main_student_page')
let subscription = null

const switchComponent = (componentName) => {
  activeMenu.value = componentName
  emit('component-change', componentName)
}

// === Функция для получения прокси-URL аватарки ===
const getAvatarProxyUrl = (ref) => {
  if (!ref) return null
  
  if (!ref.startsWith('http')) {
    if (PROXY_CONFIG.enabled) {
      return `${PROXY_CONFIG.baseUrl}/avatar/${ref}`
    }
    return ref
  }
  
  if (ref.includes('supabase.co')) {
    const match = ref.match(/\/storage\/v1\/object\/public\/avatar\/(.+)$/)
    if (match) {
      return `${PROXY_CONFIG.baseUrl}/avatar/${match[1]}`
    }
  }
  
  return ref
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
      try {
        const { data: avatarData, error: avatarError } = await supabase
          .from('avatar')
          .select('id, name, ref')
          .eq('id', data.avatar_id)
          .single()
        
        if (!avatarError && avatarData) {
          avatarUrl.value = getAvatarProxyUrl(avatarData.ref)
        } else {
          console.warn('Avatar not found:', avatarError)
          avatarUrl.value = null
        }
      } catch (err) {
        console.error('Avatar loading error:', err)
        avatarUrl.value = null
      }
    }
    
  } catch (err) {
    console.error('Ошибка:', err)
    error.value = err.message
  }
}

// Функция для загрузки данных о предметах
const fetchStudentData = async () => {
  try {
    if (!userEmail.value) {
      studentData.value = {}
      return
    }
    
    const { data: userData, error: userError } = await supabase
      .from('personalities')
      .select('user_id')
      .eq('email', userEmail.value)
      .maybeSingle()
    
    if (userError) throw userError
    
    if (!userData?.user_id) {
      studentData.value = {}
      return
    }
    
    const { data, error: studentsError } = await supabase
      .from('students')
      .select('subject1, subject2')
      .eq('user_id', userData.user_id)
      .maybeSingle()
    
    if (studentsError && studentsError.code !== 'PGRST116') throw studentsError
    
    studentData.value = data || {}
    
  } catch (err) {
    console.error('Ошибка при загрузке данных студента:', err)
    studentData.value = {}
  }
}

// Извлекаем тип экзамена
const getExamType = (subject) => {
  if (!subject) return ''
  const subjectLower = String(subject).toLowerCase()
  if (subjectLower.includes('огэ')) return 'ОГЭ'
  if (subjectLower.includes('егэ')) return 'ЕГЭ'
  return ''
}

const isFieldFilled = (field) => {
  return field !== null && field !== undefined && String(field).trim() !== ''
}

// Карточка 1: Математика (ОГЭ или ЕГЭ)
const getFirstCardData = () => {
  if (!studentData.value || Object.keys(studentData.value).length === 0) return null
  
  const subjects = [studentData.value.subject1, studentData.value.subject2]
  const hasOGE = subjects.some(s => s && s.toLowerCase().includes('огэ'))
  const hasEGE = subjects.some(s => s && s.toLowerCase().includes('егэ'))
  
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

// Карточка 2: Запись на недостающий курс
const getSecondCardData = () => {
  if (!studentData.value || Object.keys(studentData.value).length === 0) return null
  
  const subject1 = studentData.value.subject1
  const subject2 = studentData.value.subject2
  
  if (isFieldFilled(subject1) && isFieldFilled(subject2)) return null
  
  if (!isFieldFilled(subject1) && isFieldFilled(subject2)) {
    const examType = getExamType(subject2)
    return {
      text: `Записаться на курс по Химии ${examType}`,
      link: 'https://purtoschool.ru/',
      type: 'course',
      compact: true,
      hasButton: true
    }
  }
  
  if (isFieldFilled(subject1) && !isFieldFilled(subject2)) {
    const examType = getExamType(subject1)
    return {
      text: `Записаться на курс по Биологии ${examType}`,
      link: 'https://purtoschool.ru/',
      type: 'course',
      compact: true,
      hasButton: true
    }
  }
  
  return {
    text: 'Записаться на курс по химии или биологии',
    link: 'https://purtoschool.ru/',
    type: 'course',
    compact: true,
    hasButton: true
  }
}

// Карточка 3: Пригласи друга
const getThirdCardData = () => {
  return {
    text: 'Приведи друга - получите скидку 500₽ каждый!',
    description: 'Учитесь вместе выгоднее',
    link: 'https://purtoschool.ru/invite',
    type: 'invite',
    emoji: '🎁',
    compact: false,
    hasButton: false
  }
}

// Все карточки
const allCards = computed(() => {
  const cards = []
  const firstCard = getFirstCardData()
  const secondCard = getSecondCardData()
  const thirdCard = getThirdCardData()
  
  if (firstCard) cards.push(firstCard)
  if (secondCard) cards.push(secondCard)
  cards.push(thirdCard)
  
  return cards
})

// Следим за изменением количества карточек
watch(allCards, (newCards, oldCards) => {
  if (newCards.length !== oldCards?.length && currentCardIndex.value >= newCards.length) {
    currentCardIndex.value = 0
  }
})

const currentCard = computed(() => {
  if (allCards.value.length === 0) return null
  return allCards.value[currentCardIndex.value]
})

const nextCard = () => {
  if (allCards.value.length <= 1) return
  transitionDirection.value = 'next'
  currentCardIndex.value = (currentCardIndex.value + 1) % allCards.value.length
  resetTimer()
}

const prevCard = () => {
  if (allCards.value.length <= 1) return
  transitionDirection.value = 'prev'
  currentCardIndex.value = (currentCardIndex.value - 1 + allCards.value.length) % allCards.value.length
  resetTimer()
}

const goToCard = (index) => {
  if (index === currentCardIndex.value) return
  transitionDirection.value = index > currentCardIndex.value ? 'next' : 'prev'
  currentCardIndex.value = index
  resetTimer()
}

const resetTimer = () => {
  if (cardInterval.value) {
    clearInterval(cardInterval.value)
  }
  startCarousel()
}

const startCarousel = () => {
  if (allCards.value.length <= 1) return
  cardInterval.value = setInterval(() => {
    nextCard()
  }, 5000)
}

// Подписка на изменения в реальном времени
const setupRealtime = () => {
  subscription = supabase
    .channel('personal_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'personalities', filter: `email=eq.${userEmail.value}` },
      () => {
        fetchUserData()
        fetchStudentData()
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'avatar' },
      () => {
        fetchUserData()
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

<style scoped>
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

.leftpartpage {
  width: 100%;
  max-width: 280px;
  position: sticky;
  top: 20px;
}

.leftmenu {
  background-color: #f9f8ff;
  border-radius: 16px;
  padding: 20px 0;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.about_student_big {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  cursor: pointer;
  margin-bottom: 15px;
}

.photo_avatar {
  width: 55px;
  height: 55px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.default-avatar {
  width: 55px;
  height: 55px;
  border-radius: 50%;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  text-align: center;
  color: #888;
  padding: 5px;
  flex-shrink: 0;
}

.about_student {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.user-info {
  font-weight: bold;
  font-size: 14px;
  font-family: 'Evolventa', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info.settings-message {
  color: #b241d1;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.line {
  background-color: #b241d1;
  width: calc(100% - 32px);
  height: 1px;
  margin: 0 auto 15px;
}

.second_line {
  background-color: #b241d1;
  width: 100%;
  height: 1px;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
}

.menu_button {
  background: none;
  border: none;
  font-family: 'Evolventa', sans-serif;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  color: #333;
  transition: all 0.2s ease;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu_button.active {
  color: #b241d1;
  font-weight: bold;
  background-color: rgba(178, 65, 209, 0.1);
}

.menu_button:hover:not(.active) {
  background-color: rgba(178, 65, 209, 0.05);
  color: #b241d1;
}

.black_text_href {
  color: #333;
  text-decoration: none;
  display: block;
  width: 100%;
  font-family: 'Evolventa', sans-serif;
}

.black_text_href:hover {
  color: #b241d1;
}

/* Блок с курсами - увеличенный отступ сверху */
.aboutcourses {
  background-color: #f9f8ff;
  border-radius: 16px;
  padding: 16px;
  margin-top: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.about_courses_bold {
  font-size: 14px;
  font-weight: bold;
  font-family: 'Evolventa', sans-serif;
  margin-bottom: 10px;
}

.about_courses_main_text {
  font-size: 13px;
  font-family: 'Evolventa', sans-serif;
  color: #666;
  margin-top: 10px;
}

.about_courses_button_chose {
  color: white;
  background-color: #b241d1;
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  text-decoration: none;
  text-align: center;
  font-size: 13px;
  font-family: 'Evolventa', sans-serif;
  margin-top: 10px;
  transition: all 0.2s ease;
}

.about_courses_button_chose:hover {
  background-color: #9a36b8;
  transform: translateY(-2px);
}

.carousel-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  margin-top: 5px;
}

.carousel-inner-container {
  width: 100%;
  padding: 0 28px;
}

.carousel {
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.course-card {
  background: transparent !important;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  opacity: 0;
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.course-card.slide-next {
  animation: slideInNext 0.4s ease forwards;
}

.course-card.slide-prev {
  animation: slideInPrev 0.4s ease forwards;
}

@keyframes slideInNext {
  0% {
    opacity: 0;
    transform: translateX(15px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInPrev {
  0% {
    opacity: 0;
    transform: translateX(-15px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.course-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
}

.card-compact .course-card-content {
  gap: 6px;
}

.card-normal .course-card-content {
  gap: 4px;
}

.card-emoji {
  font-size: 28px;
}

.card-compact .course-text {
  font-size: 13px;
  font-weight: 700;
  font-family: 'Evolventa', sans-serif;
  color: #333;
}

.card-normal .course-text {
  font-size: 12px;
  font-weight: 700;
  font-family: 'Evolventa', sans-serif;
  color: #b241d1;
}

.course-description {
  font-size: 11px;
  font-family: 'Evolventa', sans-serif;
  color: #666;
}

.card-compact .course-button {
  padding: 6px 12px;
  font-size: 11px;
  font-family: 'Evolventa', sans-serif;
  min-width: 110px;
  margin-top: 4px;
}

.card-normal .course-button {
  display: none;
}

.course-button {
  color: white;
  background: linear-gradient(135deg, #b241d1, #9a2cb6);
  border-radius: 20px;
  text-decoration: none;
  text-align: center;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(178, 65, 209, 0.2);
}

.course-button:hover {
  transform: translateY(-2px);
}

.no-courses {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
  width: 100%;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: white;
  color: #b241d1;
  border: 1px solid #b241d1;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.carousel-arrow:hover {
  background-color: #b241d1;
  color: white;
}

.carousel-arrow-prev {
  left: 0;
}

.carousel-arrow-next {
  right: 0;
}

.carousel-arrow svg {
  width: 12px;
  height: 12px;
}

.carousel-indicators {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 10px;
}

.carousel-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid #b241d1;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.carousel-indicator.active {
  background-color: #b241d1;
  transform: scale(1.2);
}

/* ============================================ */
/* АДАПТАЦИЯ ДЛЯ БУРГЕР-МЕНЮ */
/* ============================================ */

/* Планшеты */
@media (max-width: 1024px) {
  .leftpartpage {
    max-width: 260px;
  }
  
  .photo_avatar, .default-avatar {
    width: 50px;
    height: 50px;
  }
  
  .user-info {
    font-size: 13px;
  }
  
  .menu_button {
    font-size: 13px;
    padding: 8px 10px;
  }
}

/* Мобильные устройства - когда меню в бургере */
@media (max-width: 768px) {
  .leftpartpage {
    max-width: 100%;
    position: relative;
    top: 0;
    margin-bottom: 0;
    padding: 0 4px;
  }
  
  .leftmenu {
    border-radius: 12px;
    padding: 16px 0;
    width: 100%;
    margin-bottom: 16px;
  }
  
  .about_student_big {
    padding: 0 16px;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .photo_avatar, .default-avatar {
    width: 52px;
    height: 52px;
  }
  
  .user-info {
    font-size: 15px;
  }
  
  .line {
    width: calc(100% - 32px);
    margin-bottom: 12px;
  }
  
  .menu {
    padding: 0 14px;
    gap: 2px;
  }
  
  .menu_button {
    font-size: 15px;
    padding: 10px 14px;
    white-space: normal;
    word-break: break-word;
    overflow: visible;
    text-overflow: clip;
  }
  
  .aboutcourses {
    padding: 14px;
    margin-top: 0;
    border-radius: 12px;
  }
  
  .about_courses_bold {
    font-size: 14px;
  }
  
  .carousel-container {
    min-height: 130px;
  }
  
  .carousel-inner-container {
    padding: 0 24px;
  }
  
  .card-compact .course-text {
    font-size: 13px;
  }
  
  .card-emoji {
    font-size: 24px;
  }
  
  .carousel-arrow {
    width: 26px;
    height: 26px;
  }
}

/* Маленькие телефоны */
@media (max-width: 480px) {
  .leftmenu {
    padding: 14px 0;
    border-radius: 10px;
    margin-bottom: 12px;
  }
  
  .about_student_big {
    padding: 0 14px;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .photo_avatar, .default-avatar {
    width: 46px;
    height: 46px;
  }
  
  .user-info {
    font-size: 14px;
  }
  
  .menu {
    padding: 0 12px;
    gap: 2px;
  }
  
  .menu_button {
    font-size: 14px;
    padding: 8px 12px;
    white-space: normal;
    word-break: break-word;
    overflow: visible;
    text-overflow: clip;
    border-radius: 6px;
  }
  
  .aboutcourses {
    padding: 12px;
    margin-top: 0;
    border-radius: 10px;
  }
  
  .about_courses_bold {
    font-size: 13px;
  }
  
  .carousel-container {
    min-height: 120px;
  }
  
  .carousel-inner-container {
    padding: 0 20px;
  }
  
  .card-compact .course-text {
    font-size: 12px;
  }
  
  .card-emoji {
    font-size: 20px;
  }
  
  .course-description {
    font-size: 10px;
  }
  
  .card-compact .course-button {
    padding: 4px 8px;
    font-size: 10px;
    min-width: 90px;
  }
  
  .carousel-arrow {
    width: 22px;
    height: 22px;
  }
  
  .carousel-arrow svg {
    width: 10px;
    height: 10px;
  }
}

/* Очень маленькие телефоны */
@media (max-width: 360px) {
  .leftmenu {
    padding: 12px 0;
    margin-bottom: 10px;
  }
  
  .about_student_big {
    padding: 0 10px;
    gap: 8px;
  }
  
  .photo_avatar, .default-avatar {
    width: 40px;
    height: 40px;
  }
  
  .user-info {
    font-size: 13px;
  }
  
  .menu {
    padding: 0 8px;
  }
  
  .menu_button {
    font-size: 13px;
    padding: 6px 10px;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .leftpartpage {
    max-width: 100%;
  }
  
  .leftmenu {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 10px 16px;
    border-radius: 12px;
    margin-bottom: 12px;
  }
  
  .about_student_big {
    margin-bottom: 0;
    width: auto;
    padding: 0;
  }
  
  .line {
    display: none;
  }
  
  .menu {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    padding: 0;
  }
  
  .menu_button {
    width: auto;
    padding: 6px 12px;
    font-size: 13px;
    white-space: nowrap;
  }
  
  .aboutcourses {
    margin-top: 0;
    padding: 12px;
  }
}
</style>