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
        <left_teacher_menu @component-change="handleComponentChange"/>
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


import { supabase } from './supabase.js'

const components = {
  main_teacher_page: markRaw(main_teacher_page),
  settings: markRaw(settings),
  editor_bank_task: markRaw(editor_bank_task),
  editor_homework: markRaw(editor_homework),
  all_students: markRaw(all_students)
}

export default {
  components: {
    left_teacher_menu,
    settings,
    main_teacher_page,
    editor_students,
    editor_bank_task,
    editor_homework, 
    all_students
  },
  data() {
    return {
      currentComponent: components.main_teacher_page,
      loading: true,
      isTeacher: false,
      error: null,
      componentMap: components,
      showStudentsModal: false
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
    } catch (err) {
      this.error = err.message
      console.error('Ошибка проверки доступа:', err)
      this.$router.push('/')
    } finally {
      this.loading = false
    }
  },
  methods: {
    handleComponentChange(componentName) {
      if (componentName === 'editor_students') {
        // Показываем модальное окно для редактора студентов
        this.showStudentsModal = true;
        this.currentComponent = components.main_teacher_page; // Оставляем основной компонент
      } else {
        // Для других компонентов используем обычный рендеринг
        const component = this.componentMap[componentName] || components.main_teacher_page;
        this.currentComponent = component;
        this.showStudentsModal = false; // Скрываем модальное окно
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
}
.mainpart{
    display: grid;
    grid-template-rows: 10% 85%;
    gap: 1%;
}
</style>