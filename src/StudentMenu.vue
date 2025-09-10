<script>
import Left_student_menu from './components/left_student_menu.vue';
import settings from './components/settings.vue';
import main_student_page from './components/main_student_page.vue';
import SubjectRating from './components/SubjectRating.vue';
import HomeworkList from './components/HomeworkList.vue';
import { supabase } from './supabase'; // Импортируем Supabase клиент

export default{
    components: {
        Left_student_menu,
        settings,
        main_student_page,
        SubjectRating, 
        HomeworkList,
    },
    data() {
        return {
            currentComponent: main_student_page,
            userAccess: true, // По умолчанию доступ разрешен
            userData: null,
            isLoading: true,
            error: null
        }
    },
    methods: {
        setCurrentComponent(componentName) {
            this.currentComponent = componentName;
        },
        // Метод для получения данных пользователя из Supabase
        async fetchUserData() {
            try {
                this.isLoading = true;
                this.error = null;
                
                // Получаем текущего аутентифицированного пользователя
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                
                if (authError) {
                    throw new Error('Ошибка аутентификации: ' + authError.message);
                }
                
                if (!user) {
                    throw new Error('Пользователь не аутентифицирован');
                }
                
                // Получаем данные студента из таблицы students
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                
                if (studentError) {
                    if (studentError.code === 'PGRST116') {
                        // Запись не найдена - создаем новую
                        const { data: newStudent, error: insertError } = await supabase
                            .from('students')
                            .insert([
                                {
                                    user_id: user.id,
                                    email: user.email,
                                    first_name: null,
                                    last_name: null,
                                    created_at: new Date(),
                                    access: true // По умолчанию даем доступ
                                }
                            ])
                            .select()
                            .single();
                        
                        if (insertError) {
                            throw new Error('Ошибка создания записи студента: ' + insertError.message);
                        }
                        
                        this.userData = newStudent;
                        this.userAccess = newStudent.access;
                    } else {
                        throw new Error('Ошибка получения данных студента: ' + studentError.message);
                    }
                } else {
                    this.userData = studentData;
                    this.userAccess = studentData.access;
                }
                
            } catch (error) {
                console.error('Ошибка при получении данных пользователя:', error);
                this.error = error.message;
                this.userAccess = false; // В случае ошибки запрещаем доступ
            } finally {
                this.isLoading = false;
            }
        },
        // Метод для выхода из системы
        async logout() {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.error('Ошибка при выходе:', error);
                }
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Ошибка при выходе:', error);
            }
        }
    },
    mounted() {
        // При загрузке компонента получаем данные пользователя
        this.fetchUserData();
    }
}
</script>

<template>
    <div class="allpage">
        <div class="topmenu">
            <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
            <div class="rightparttopmenu">
                <div class="courses">Курсы</div>
                <div class="go_back" @click="logout">
                    <a href="#" @click.prevent="logout">Выйти</a>
                </div>
            </div>
        </div> 
        
        <!-- Загрузка -->
        <div v-if="isLoading" class="loading">
            <div class="loading-spinner"></div>
            <p>Загрузка данных...</p>
        </div>
        
        <!-- Ошибка -->
        <div v-else-if="error" class="error-message">
            <h2>Ошибка</h2>
            <p>{{ error }}</p>
            <button @click="fetchUserData" class="retry-button">Попробовать снова</button>
        </div>
        
        <!-- Доступ разрешен -->
        <div v-else-if="userAccess" class="centerpartpage">
            <Left_student_menu @component-change="setCurrentComponent"/>
            <div class="mainpart">
                <component :is="currentComponent" />
            </div>
        </div>
        
        <!-- Доступ запрещен -->
        <div v-else class="access-denied">
            <div class="access-denied-message">
                <h2>Доступ запрещен</h2>
                <p>Обратитесь к преподавателю для получения доступа</p>
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
    background: white;
    font-family: Evolventa;
    width: 100%;
    height: 100%;
}
a{
    color: white;
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
    cursor: pointer;
}
.go_back{
    display: grid;
    place-items: center;
    cursor: pointer;
}
.go_back:hover {
    opacity: 0.8;
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

/* Стили для сообщения о запрете доступа */
.access-denied {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
}

.access-denied-message {
    text-align: center;
    padding: 2rem;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    color: #721c24;
    max-width: 500px;
}

.access-denied-message h2 {
    margin-bottom: 1rem;
    font-size: 2rem;
}

.access-denied-message p {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
}

/* Стили для загрузки */
.loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Стили для ошибки */
.error-message {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    text-align: center;
    padding: 2rem;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 8px;
    color: #721c24;
    max-width: 600px;
    margin: 0 auto;
}

.error-message h2 {
    margin-bottom: 1rem;
    font-size: 2rem;
}

.error-message p {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
}

.retry-button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

.retry-button:hover {
    background-color: #0056b3;
}
</style>