<template>
  <div v-if="hasAdditionalCourses" class="block additional-courses-block" @click="openModal">
    <div class="subject_name">Дополнительные курсы</div>
    <div class="courses-count">Доступно курсов: {{ additionalCoursesCount }}</div>
    <div class="button">Посмотреть</div>
  </div>

  <!-- Модальное окно со списком курсов -->
  <Transition name="modal-fade" @after-leave="onModalClosed">
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <Transition name="modal-slide" appear>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Дополнительные курсы</h3>
            <button class="close-button" @click="closeModal">×</button>
          </div>
          
          <div class="modal-body">
            <div v-if="additionalCoursesInfo.length === 0" class="no-courses">
              Нет доступных курсов
            </div>
            <div v-else class="courses-list">
              <TransitionGroup name="course-list" tag="div" class="courses-list">
                <div 
                  v-for="(course, index) in additionalCoursesInfo" 
                  :key="course.english_name"
                  class="course-item"
                  :style="{ animationDelay: `${index * 0.05}s` }"
                  @click="openCourse(course)"
                >
                  <div class="course-name">{{ course.name }}</div>
                  <div class="course-subject">{{ course.subject }}</div>
                  <div class="course-button">Перейти →</div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script>
import { supabase } from '../supabase'

export default {
  emits: ['has-data', 'no-data'],
  
  data() {
    return {
      additionalCoursesInfo: [],
      showModal: false,
      loading: true,
      user_id: null
    }
  },
  
  computed: {
    hasAdditionalCourses() {
      return this.additionalCoursesInfo.length > 0
    },
    
    additionalCoursesCount() {
      return this.additionalCoursesInfo.length
    }
  },
  
  async mounted() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) throw new Error('Пользователь не авторизован')

      this.user_id = user.id
      await this.loadAdditionalCourses()
      
      if (this.hasAdditionalCourses) {
        this.$emit('has-data')
      } else {
        this.$emit('no-data')
      }
      
    } catch (err) {
      console.error('Ошибка при загрузке дополнительных курсов:', err)
      this.$emit('no-data')
    } finally {
      this.loading = false
    }
  },
  
  methods: {
    async loadAdditionalCourses() {
      try {
        // Сначала получаем список дополнительных курсов студента
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('additional_courses')
          .eq('user_id', this.user_id)
          .single()
        
        if (studentError) throw studentError
        
        let additionalCourseNames = []
        if (studentData?.additional_courses) {
          try {
            additionalCourseNames = typeof studentData.additional_courses === 'string' 
              ? JSON.parse(studentData.additional_courses) 
              : studentData.additional_courses
          } catch (e) {
            console.error('Ошибка парсинга additional_courses:', e)
            additionalCourseNames = []
          }
        }
        
        if (additionalCourseNames.length === 0) {
          this.additionalCoursesInfo = []
          return
        }
        
        // Загружаем полную информацию о курсах
        const { data, error } = await supabase
          .from('additional_course')
          .select('*')
          .in('name', additionalCourseNames)
        
        if (error) throw error
        
        this.additionalCoursesInfo = data || []
        
      } catch (err) {
        console.error('Ошибка при загрузке дополнительных курсов:', err)
        this.additionalCoursesInfo = []
      }
    },
    
    openModal() {
      this.showModal = true
      document.body.style.overflow = 'hidden'
    },
    
    closeModal() {
      this.showModal = false
    },
    
    onModalClosed() {
      document.body.style.overflow = ''
    },
    
    openCourse(course) {
      // Закрываем модальное окно и переходим к странице additional_course.html с параметром курса
      this.closeModal()
      setTimeout(() => {
        // Переход на страницу additional_course.html с параметром course
        window.location.href = `/additional_course.html?course=${course.english_name}`
      }, 300)
    }
  }
}
</script>

<style scoped>
.block {
  background-color: #b241d1;
  border-radius: 5%;
  padding: 5%;
  color: white;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 10%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 280px;
  cursor: pointer;
}

.block:hover {
  opacity: 0.9;
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.subject_name { 
  font-size: 1.5vw;
  font-weight: bold;
  border-bottom: #fff solid 0.25vh;
  padding-bottom: 10px;
  margin-bottom: 10px;
  text-align: center;
}

.courses-count {
  font-size: 1vw;
  text-align: center;
  opacity: 0.9;
  margin-bottom: 15px;
}

.button {
  background-color: #fff;
  color: #b241d1;
  display: grid;
  justify-content: center;
  align-items: center;
  border-radius: 5vw;
  text-decoration: none;
  padding: 12px 24px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  cursor: pointer;
}

.button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  background-color: #f5f5f5;
}

/* Анимации для модального окна */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-slide-enter-from {
  transform: translateY(-30px) scale(0.95);
  opacity: 0;
}

.modal-slide-leave-to {
  transform: translateY(30px) scale(0.95);
  opacity: 0;
}

/* Анимация для списка курсов */
.course-list-enter-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.course-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
}

.course-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.course-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.course-list-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: rotate(90deg);
}

.modal-body {
  padding: 20px;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #b241d1;
  border-radius: 10px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #8a2be2;
}

.courses-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.course-item {
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes slideIn {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.course-item:hover {
  transform: translateX(8px) scale(1.02);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
}

.course-name {
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
}

.course-subject {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 12px;
}

.course-button {
  display: inline-block;
  background-color: white;
  color: #8a2be2;
  padding: 8px 20px;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: fit-content;
}

.course-item:hover .course-button {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background-color: #f8f8f8;
}

.no-courses {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.1rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .subject_name {
    font-size: 3vw;
  }
  
  .courses-count {
    font-size: 2vw;
  }
  
  .button {
    padding: 10px 20px;
    font-size: 0.9rem;
  }
  
  .block {
    min-height: 240px;
  }
  
  .modal-content {
    width: 95%;
    margin: 10px;
  }
  
  .modal-header h3 {
    font-size: 1.2rem;
  }
  
  .course-name {
    font-size: 1rem;
  }
  
  .course-subject {
    font-size: 0.8rem;
  }
  
  .course-button {
    padding: 6px 16px;
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .subject_name {
    font-size: 4vw;
  }
  
  .courses-count {
    font-size: 3vw;
  }
  
  .block {
    min-height: 220px;
    gap: 8%;
  }
  
  .button {
    padding: 8px 16px;
    font-size: 0.85rem;
  }
  
  .course-item {
    padding: 15px;
  }
  
  .course-name {
    font-size: 0.95rem;
  }
}
</style>