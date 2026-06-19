<template>
  <div v-if="loading" class="loading">Проверка доступа...</div>
  <div v-else-if="!isTeacher" class="access-denied">
    <h2>Доступ запрещён</h2>
    <p>Эта страница доступна только преподавателям.</p>
    <a class="isntTeacher" href="../index.html">Вернуться к регистрации</a>
  </div>
  <div v-else>
    <div class="allpage">
      <div class="topmenu">
        <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
        <div class="rightparttopmenu">
          <div class="courses">На главную</div>
          <div class="go_back"><a href="../index.html">Выйти</a></div>
        </div>
      </div> 
      <div class="centerpartpage">
        <!-- Кнопка бургер-меню для мобильных -->
        <button 
          v-if="isMobile && !isMobileMenuOpen"
          class="burger-button"
          @click="toggleMobileMenu"
        >
          <span class="burger-line"></span>
          <span class="burger-line"></span>
          <span class="burger-line"></span>
        </button>

        <!-- Оверлей для мобильного меню -->
        <div 
          v-if="isMobile && isMobileMenuOpen"
          class="mobile-overlay"
          @click="closeMobileMenu"
        ></div>

        <!-- Боковое меню -->
        <div 
          class="left-menu-wrapper"
          :class="{ 
            'mobile-open': isMobile && isMobileMenuOpen,
            'mobile-closed': isMobile && !isMobileMenuOpen
          }"
        >
          <!-- Кнопка закрытия внутри меню -->
          <button 
            v-if="isMobile"
            class="menu-close-button"
            @click="closeMobileMenu"
          >
            ✕
          </button>
          <left_teacher_menu @component-change="handleComponentChange"/>
        </div>
        
        <div class="mainpart">
          <!-- Основной компонент -->
          <component :is="currentComponent" />
          
          <!-- Модальное окно студентов -->
          <editor_students 
            v-if="showStudentsModal" 
            @close="showStudentsModal = false" 
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import left_teacher_menu from './components/left_teacher_menu.vue';
import settings from './components/settings.vue';
import main_teacher_page from './components/change_courses.vue';
import editor_students from './components/editor_students.vue'
import editor_bank_task from './components/editor_bank_task.vue';
import editor_homework from './components/editor_homework.vue';
import all_students from './components/all_students.vue';
import UploadUsefulMaterials from './components/upload_useful_materials.vue';

import { supabase } from './supabase.js'

const components = {
  main_teacher_page: markRaw(main_teacher_page),
  settings: markRaw(settings),
  editor_bank_task: markRaw(editor_bank_task),
  editor_homework: markRaw(editor_homework),
  all_students: markRaw(all_students),
  upload_useful_materials: markRaw(UploadUsefulMaterials)
}

export default {
  components: {
    left_teacher_menu,
    settings,
    main_teacher_page,
    editor_students,
    editor_bank_task,
    editor_homework, 
    all_students,
    UploadUsefulMaterials
  },
  data() {
    return {
      currentComponent: components.main_teacher_page,
      loading: true,
      isTeacher: false,
      error: null,
      componentMap: components,
      showStudentsModal: false,
      isMobileMenuOpen: false,
      isMobile: window.innerWidth <= 768
    }
  },
  async mounted() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        this.$router.push('/login')
        return
      }

      const { data: personality, error: profileError } = await supabase
        .from('personalities')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError
      if (!personality) throw new Error('Профиль пользователя не найден')

      this.isTeacher = personality.role === 'teacher'

      if (!this.isTeacher) {
        console.warn(`Пользователь ${user.email} пытался получить доступ к TeacherMenu`)
      }
      
      window.addEventListener('resize', this.handleResize);
    } catch (err) {
      this.error = err.message
      console.error('Ошибка проверки доступа:', err)
      this.$router.push('/')
    } finally {
      this.loading = false
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    handleComponentChange(componentName) {
      if (componentName === 'editor_students') {
        this.showStudentsModal = true;
        this.currentComponent = components.main_teacher_page;
      } else {
        const component = this.componentMap[componentName] || components.main_teacher_page;
        this.currentComponent = component;
        this.showStudentsModal = false;
      }
      
      if (this.isMobile) {
        this.isMobileMenuOpen = false;
      }
    },
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    },
    closeMobileMenu() {
      this.isMobileMenuOpen = false;
    },
    handleResize() {
      this.isMobile = window.innerWidth <= 768;
      if (!this.isMobile) {
        this.isMobileMenuOpen = false;
      }
    }
  }
}
</script>

<style>
.loading {
  padding: 20px;
  text-align: center;
  font-size: 1.2rem;
}

.error-container {
  max-width: 500px;
  margin: 50px auto;
  padding: 20px;
  text-align: center;
  background: #fff3f3;
  border: 1px solid #ffcccc;
  border-radius: 8px;
}

.error-container h2 {
  color: #ff4444;
}

.access-denied {
  max-width: 500px;
  margin: 50px auto;
  padding: 20px;
  text-align: center;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.retry-button, .home-button {
  margin-top: 15px;
  padding: 8px 16px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.retry-button:hover, .home-button:hover {
  background: #9a35b5;
}

.teacher-content {
  padding: 20px;
}
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
  background: white;
  font-family: Evolventa;
  width: 100%;
  height: 100%;
}
a{
  color: white;
  text-decoration: none;
}
.isntTeacher{
  color: #b241d1;
  text-decoration: none;
}
.allpage{
  display: grid;
  height: 100vh;
  grid-template-rows: 7% 81% 12%;
  gap: 0px;
}
.topmenu{
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 20% 22%;
  column-gap: 55%;
  padding-left: 8%;
  color: white;
  font-size: 1.25vw;
  background-image: url(./assets/background_line.png);
  background-size: cover;
  background-position:center;
  background-repeat: no-repeat;
}
.logo{
  display: grid;
  place-content: center;
}
.rightparttopmenu{
  display: grid; 
  grid-template-columns: 30% 30%;
  column-gap: 7%;
  font-size: 1vw;
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
}
.centerpartpage{
  height: 100%;
  width: 100%;
  display: grid;
  grid-template-columns: 20% 63%;
  padding-left: 8%;
  padding-top: 2%;
  gap: 5%;
  position: relative;
}
.mainpart{
  display: grid;
  grid-template-rows: 10% 85%;
  gap: 1%;
}

/* === БУРГЕР-МЕНЮ === */
.burger-button {
  display: none;
  position: fixed;
  top: 75px;
  left: 15px;
  z-index: 1001;
  width: 44px;
  height: 44px;
  background: white;
  border: 2px solid #b241d1;
  border-radius: 8px;
  cursor: pointer;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  padding: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.burger-button:hover {
  background: #f9f8ff;
}

.burger-line {
  display: block;
  width: 24px;
  height: 2.5px;
  background: #b241d1;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.menu-close-button {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 10;
  width: 36px;
  height: 36px;
  background: #f9f8ff;
  border: 2px solid #b241d1;
  border-radius: 50%;
  font-size: 20px;
  color: #b241d1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.menu-close-button:hover {
  background: #b241d1;
  color: white;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.left-menu-wrapper {
  transition: all 0.3s ease;
}

/* Десктопная версия */
@media (min-width: 769px) {
  .left-menu-wrapper {
    display: block;
  }
  
  .burger-button {
    display: none !important;
  }
  
  .mobile-overlay {
    display: none !important;
  }
  
  .menu-close-button {
    display: none !important;
  }
}

/* Мобильная версия */
@media (max-width: 768px) {
  .centerpartpage {
    grid-template-columns: 1fr;
    padding-left: 0;
    padding-top: 0;
    gap: 0;
  }
  
  .topmenu {
    grid-template-columns: 1fr 1fr;
    column-gap: 0;
    padding-left: 15px;
    font-size: 2.5vw;
  }
  
  .rightparttopmenu {
    font-size: 2vw;
    grid-template-columns: 1fr 1fr;
    padding-right: 15px;
  }
  
  .burger-button {
    display: flex !important;
  }
  
  .left-menu-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 85%;
    max-width: 360px;
    z-index: 999;
    transform: translateX(-100%);
    overflow-y: auto;
    padding: 16px 12px 20px 12px;
    background: white;
    box-shadow: 2px 0 30px rgba(0, 0, 0, 0.2);
    transition: transform 0.3s ease;
  }
  
  .left-menu-wrapper.mobile-open {
    transform: translateX(0);
  }
  
  .left-menu-wrapper.mobile-closed {
    transform: translateX(-100%);
  }
  
  .left-menu-wrapper :deep(.leftpartpage) {
    height: 100%;
    padding: 0;
    display: block;
    position: static;
  }
  
  .left-menu-wrapper :deep(.leftmenu) {
    min-width: unset;
    max-width: 100%;
    border-radius: 12px;
    gap: 14px;
    padding: 20px 0;
    box-shadow: none;
    height: 100%;
  }
  
  .left-menu-wrapper :deep(.about_student_big) {
    padding: 0 20px;
    gap: 14px;
  }
  
  .left-menu-wrapper :deep(.photo_avatar) {
    height: 56px;
    width: 56px;
  }
  
  .left-menu-wrapper :deep(.user-info) {
    font-size: 16px;
  }
  
  .left-menu-wrapper :deep(.number_of_points) {
    font-size: 13px;
  }
  
  .left-menu-wrapper :deep(.menu) {
    padding: 0 16px;
    gap: 4px;
  }
  
  .left-menu-wrapper :deep(.menu_button) {
    font-size: 15px;
    padding: 10px 16px;
    border-radius: 8px;
    white-space: normal;
    word-break: break-word;
  }
  
  .left-menu-wrapper :deep(.line) {
    width: calc(100% - 40px);
    margin: 0 auto;
  }
  
  .mainpart {
    padding: 15px;
    padding-top: 70px;
  }
}

@media (max-width: 480px) {
  .left-menu-wrapper {
    width: 92%;
    max-width: 320px;
    padding: 12px 8px 16px 8px;
  }
  
  .left-menu-wrapper :deep(.leftmenu) {
    padding: 16px 0;
    gap: 12px;
  }
  
  .left-menu-wrapper :deep(.about_student_big) {
    padding: 0 14px;
    gap: 12px;
  }
  
  .left-menu-wrapper :deep(.photo_avatar) {
    height: 48px;
    width: 48px;
  }
  
  .left-menu-wrapper :deep(.user-info) {
    font-size: 15px;
  }
  
  .left-menu-wrapper :deep(.number_of_points) {
    font-size: 12px;
  }
  
  .left-menu-wrapper :deep(.menu) {
    padding: 0 12px;
    gap: 3px;
  }
  
  .left-menu-wrapper :deep(.menu_button) {
    font-size: 14px;
    padding: 8px 14px;
  }
  
  .left-menu-wrapper :deep(.line) {
    width: calc(100% - 28px);
  }
  
  .topmenu {
    font-size: 3vw;
    padding-left: 10px;
  }
  
  .rightparttopmenu {
    font-size: 2.5vw;
    padding-right: 10px;
  }
  
  .burger-button {
    top: 65px;
    left: 10px;
    width: 38px;
    height: 38px;
    padding: 8px;
  }
  
  .burger-line {
    width: 20px;
    height: 2px;
  }
  
  .menu-close-button {
    top: 8px;
    right: 12px;
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .centerpartpage {
    grid-template-columns: 1fr;
    padding-left: 0;
    padding-top: 0;
    gap: 0;
  }
  
  .left-menu-wrapper {
    width: 70%;
    max-width: 300px;
  }
  
  .left-menu-wrapper :deep(.leftmenu) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 10px 16px;
    gap: 8px;
  }
  
  .left-menu-wrapper :deep(.about_student_big) {
    margin-bottom: 0;
    width: auto;
    padding: 0;
  }
  
  .left-menu-wrapper :deep(.line) {
    display: none;
  }
  
  .left-menu-wrapper :deep(.menu) {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    padding: 0;
  }
  
  .left-menu-wrapper :deep(.menu_button) {
    width: auto;
    padding: 6px 12px;
    font-size: 13px;
    white-space: nowrap;
  }
}
</style>