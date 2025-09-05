<script>
import left_tutor_menu from './components/left_tutor_menu.vue';
import settings from './components/settings.vue';
import main_tutor_page from './components/main_tutor.vue';
import { supabase } from './supabase.js'
import editor_bank_task from './components/editor_bank_task.vue'
import MyStudents from './components/MyStudents.vue';
import TutorTaskBank from './TutorTaskBank.vue';

export default{
    components: {
        left_tutor_menu,
        settings,
        main_tutor_page,
        editor_bank_task,
        MyStudents,
        TutorTaskBank
    },
     data() {
    return {
      currentComponent:         MyStudents, // Изначально ничего не отображается
      loading: true,
      isTutor: false,
      error: null
    }
  },
  async mounted() {
    try {
      // 1. Проверяем авторизацию пользователя
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        this.$router.push('/login')
        return
      }

      // 2. Проверяем роль пользователя в таблице personalities
      const { data: personality, error: profileError } = await supabase
        .from('personalities')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError
      if (!personality) throw new Error('Профиль пользователя не найден')

      // 3. Проверяем, является ли пользователь учителем
      this.isTutor = personality.role === 'tutor'

      if (!this.isTutor) {
        console.warn(`Пользователь ${user.email} пытался получить доступ к Tutor`)
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
    setCurrentComponent(componentName) {
      this.currentComponent = componentName; // Меняем компонент
    }
  }
}
</script>  

<template>
    <div v-if="loading" class="loading">Проверка доступа...</div>
  <div v-else-if="!isTutor" class="access-denied">
    <h2>Доступ запрещён</h2>
    <p>Эта страница доступна только кураторам.</p>
    <a class="isntTutor" href="../index.html">Вернуться к регистрации</a>
  </div>
  <div v-else>
    <div class="allpage">
         <div class="topmenu">
            <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
            <div class="rightparttopmenu">
                <div class="courses">Училка</div>
                <div class="go_back"><a href="../index.html">Выйти</a></div>
            </div>
        </div> 
        <div class="centerpartpage">
            <left_tutor_menu @component-change="setCurrentComponent"/>
            <div class="mainpart">
        <component :is="currentComponent" />
    </div>
        </div>
  </div>

    </div>
</template>

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

.tutor-content {
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
.isntTutor{
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
    grid-template-columns: 25% 30%;
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

</style>