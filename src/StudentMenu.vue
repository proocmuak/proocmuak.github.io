<script>
import { markRaw } from 'vue';
import Left_student_menu from './components/left_student_menu.vue';
import settings from './components/settings.vue';
import main_student_page from './components/main_student_page.vue';
import SubjectRating from './components/SubjectRating.vue';
import StudentStatic from './components/StudentStatic.vue';
import HomeworkList from './components/HomeworkList.vue';
import { supabase } from './supabase';

export default{
    components: {
        Left_student_menu,
        settings,
        main_student_page,
        SubjectRating, 
        HomeworkList,
        StudentStatic 
    },
    data() {
        return {
            currentComponent: markRaw(main_student_page), // <-- Используем markRaw
            userAccess: true,
            userData: null,
            isLoading: true,
            error: null,
            isMobileMenuOpen: false,
            isMobile: window.innerWidth <= 768
        }
    },
    methods: {
        setCurrentComponent(componentName) {
            // Используем switch для выбора компонента
            switch(componentName) {
                case 'main_student_page':
                    this.currentComponent = markRaw(main_student_page);
                    break;
                case 'settings':
                    this.currentComponent = markRaw(settings);
                    break;
                case 'SubjectRating':
                    this.currentComponent = markRaw(SubjectRating);
                    break;
                case 'HomeworkList':
                    this.currentComponent = markRaw(HomeworkList);
                    break;
                case 'StudentStatic':
                    this.currentComponent = markRaw(StudentStatic);
                    break;
                default:
                    this.currentComponent = markRaw(main_student_page);
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
        },
        async fetchUserData() {
            try {
                this.isLoading = true;
                this.error = null;
                
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                
                if (authError) {
                    throw new Error('Ошибка аутентификации: ' + authError.message);
                }
                
                if (!user) {
                    throw new Error('Пользователь не аутентифицирован');
                }
                
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                
                if (studentError) {
                    if (studentError.code === 'PGRST116') {
                        const { data: newStudent, error: insertError } = await supabase
                            .from('students')
                            .insert([
                                {
                                    user_id: user.id,
                                    email: user.email,
                                    first_name: null,
                                    last_name: null,
                                    created_at: new Date(),
                                    access: true
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
                this.userAccess = false;
            } finally {
                this.isLoading = false;
            }
        },
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
        this.fetchUserData();
        window.addEventListener('resize', this.handleResize);
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.handleResize);
    }
}
</script>

<template>
    <div class="allpage">
        <div class="topmenu">
            <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
            <div class="rightparttopmenu">
                <div class="courses"></div>
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
                <Left_student_menu @component-change="setCurrentComponent"/>
            </div>

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
    position: relative;
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

/* Кнопка закрытия внутри меню */
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

/* Оверлей */
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

/* === ОБЕРТКА ДЛЯ МЕНЮ === */
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

/* Маленькие телефоны */
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