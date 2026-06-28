<template>
  <div v-if="hasAdditionalCourses" class="block additional-courses-block" @click="openModal">
    <div class="subject_name">Дополнительные курсы</div>
    <div class="stats">
      <div class="stat-item">
        <span class="stat-value">{{ additionalCoursesCount }}</span>
        <span class="stat-label">Курсов</span>
      </div>
    </div>
    <div class="button">Посмотреть</div>
  </div>

  <!-- Модальное окно -->
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
              <div 
                v-for="(course, index) in additionalCoursesInfo" 
                :key="course.english_name"
                class="course-item"
                @click="openCourse(course)"
              >
                <div class="course-name">{{ course.name }}</div>
                <div class="course-subject">{{ course.subject }}</div>
                <div class="course-button">Перейти →</div>
              </div>
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
      this.closeModal()
      setTimeout(() => {
        window.location.href = `/additional_course.html?course=${course.english_name}`
      }, 300)
    }
  }
}
</script>

<style scoped>
.block {
  background-color: #b241d1;
  border-radius: 12px;
  padding: 14px 18px 12px 18px;
  color: white;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s ease;
  height: 100%;
  box-sizing: border-box;
  cursor: pointer;
  max-height: 240px;
  min-height: 180px;
}

.block:hover {
  opacity: 0.85;
}

.subject_name { 
  font-size: clamp(15px, 1.2vw, 19px);
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 6px;
  margin-bottom: 8px;
  word-break: break-word;
  line-height: 1.2;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  padding: 4px 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 14px;
}

.stat-value {
  font-size: clamp(22px, 2vw, 32px);
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  font-size: clamp(9px, 0.65vw, 11px);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.button {
  background-color: #fff;
  color: #b241d1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 20px;
  text-decoration: none;
  padding: 5px 14px;
  font-weight: 600;
  font-size: clamp(12px, 0.85vw, 14px);
  transition: all 0.3s ease;
  margin-top: 6px;
  min-height: 30px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 16px 20px;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.courses-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.course-item {
  background: linear-gradient(135deg, #b241d1 0%, #8a2be2 100%);
  border-radius: 10px;
  padding: 16px 18px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.course-item:hover {
  transform: translateX(4px);
}

.course-name {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 4px;
}

.course-subject {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 8px;
}

.course-button {
  display: inline-block;
  background-color: white;
  color: #b241d1;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.no-courses {
  text-align: center;
  padding: 30px;
  color: #666;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.3s ease;
}

.modal-slide-enter-from {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.modal-slide-leave-to {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

@media (max-width: 768px) {
  .block {
    max-height: 210px;
    min-height: 160px;
    padding: 12px 14px 10px 14px;
    border-radius: 10px;
  }
  
  .subject_name {
    font-size: clamp(14px, 2.5vw, 17px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  
  .stat-value {
    font-size: clamp(19px, 3.5vw, 26px);
  }
  
  .stat-label {
    font-size: clamp(8px, 1.4vw, 10px);
  }
  
  .stat-item {
    padding: 3px 10px;
  }
  
  .button {
    font-size: clamp(11px, 1.8vw, 13px);
    padding: 4px 10px;
    min-height: 26px;
    border-radius: 16px;
    margin-top: 4px;
  }
  
  .modal-content {
    max-width: 95%;
  }
}

@media (max-width: 480px) {
  .block {
    max-height: 180px;
    min-height: 140px;
    padding: 10px 10px 8px 10px;
    border-radius: 8px;
  }
  
  .subject_name {
    font-size: clamp(12px, 3vw, 15px);
    padding-bottom: 3px;
    margin-bottom: 4px;
  }
  
  .stat-item {
    padding: 2px 8px;
  }
  
  .stat-value {
    font-size: clamp(17px, 4.5vw, 22px);
  }
  
  .stat-label {
    font-size: clamp(7px, 1.6vw, 9px);
  }
  
  .button {
    font-size: clamp(10px, 2.8vw, 12px);
    padding: 3px 8px;
    min-height: 22px;
    border-radius: 14px;
    margin-top: 3px;
  }
}
</style>