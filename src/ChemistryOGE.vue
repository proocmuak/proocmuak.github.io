<template>
  <div class="chemistry-page">
    <div class="go_back">
      <a href="../student_menu.html">Вернуться на главный экран</a>
    </div>
    <div class="chemistry-container">
      <CalendarChemistryOge 
        v-if="!currentLessonNumber"
        @select-lesson="handleLessonSelect"
      />
      <LessonChemistryOge 
        v-else
        :lessonNumber="currentLessonNumber"
        @back-to-calendar="currentLessonNumber = null"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CalendarChemistryOge from './components/calendar_chemistry_oge.vue'
import LessonChemistryOge from './components/lesson.vue'

const currentLessonNumber = ref(null)

const handleLessonSelect = (number) => {
  currentLessonNumber.value = number
}
</script>

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
  background-position: center;
  background-repeat: no-repeat;
  font-family: Evolventa, sans-serif;
  width: 100%;
  min-height: 100vh;
}

.chemistry-page {
  min-height: 100vh;
  padding: 20px;
}

.chemistry-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.go_back {
  max-width: 1200px;
  margin: 0 auto 20px;
  width: fit-content;
  color: white;
  border-radius: 5px;
  background-color: #b241d1;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  transition: opacity 0.3s ease;
  cursor: pointer;
}

.go_back:hover {
  opacity: 0.85;
}

.go_back a {
  color: white;
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

@media (max-width: 1024px) {
  .chemistry-page {
    padding: 16px;
  }
  
  .chemistry-container {
    padding: 16px;
  }
  
  .go_back {
    height: 38px;
    padding: 0 18px;
  }
  
  .go_back a {
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .chemistry-page {
    padding: 12px;
  }
  
  .chemistry-container {
    padding: 12px;
  }
  
  .go_back {
    width: 100%;
    height: 36px;
    padding: 0 16px;
    margin-bottom: 16px;
    border-radius: 8px;
  }
  
  .go_back a {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media (max-width: 480px) {
  .chemistry-page {
    padding: 8px;
  }
  
  .chemistry-container {
    padding: 8px;
  }
  
  .go_back {
    height: 34px;
    padding: 0 12px;
    margin-bottom: 12px;
    border-radius: 6px;
  }
  
  .go_back a {
    font-size: 12px;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .chemistry-page {
    padding: 10px;
  }
  
  .chemistry-container {
    padding: 10px;
  }
  
  .go_back {
    height: 32px;
    padding: 0 14px;
    margin-bottom: 12px;
  }
  
  .go_back a {
    font-size: 12px;
  }
}
</style>