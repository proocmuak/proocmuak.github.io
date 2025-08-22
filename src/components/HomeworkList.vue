<template>
  <div class="homework-container">
    <!-- Выбор предмета -->
    <div class="subject-selector">
      <CustomDropdown
        :options="subjectOptions"
        v-model="selectedSubject"
        placeholder="Выберите предмет"
        class="subject-dropdown"
      />
    </div>

    <!-- Список домашних заданий -->
    <div v-if="selectedSubject">
      <div v-if="loading" class="loading-message">Загрузка домашних заданий...</div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="homeworks.length === 0" class="no-homeworks">
        Нет домашних заданий для выбранного предмета
      </div>
      
      <div v-else class="homeworks-grid">
        <div 
          v-for="homework in homeworks" 
          :key="homework.homework_id"
          class="homework-card"
          :class="{ 'completed': homework.is_completed }"
          @click="openHomework(homework)"
        >
          <div class="homework-header">
            <h3>{{ homework.homework_name }}</h3>
            <div class="completion-status" :class="getStatusClass(homework)">
              {{ getStatusText(homework) }}
            </div>
          </div>
          
          <p class="lesson-info">Урок {{ homework.lesson_number }}: {{ homework.lesson_name }}</p>
          
          <div class="homework-details">
            <div class="deadline" :class="deadlineStatus(homework.deadline)">
              Дедлайн: {{ formatDate(homework.deadline) }}
            </div>
            
            <div v-if="homework.score !== null" class="score">
              Оценка: {{ homework.score }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="select-subject-prompt">
      <p>Пожалуйста, выберите предмет для просмотра домашних заданий</p>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { supabase } from '../supabase.js'
import CustomDropdown from './CustomDropdown.vue'

export default {
  name: 'HomeworkList',
  components: {
    CustomDropdown
  },
  setup() {
    const homeworks = ref([])
    const selectedSubject = ref(null)
    const loading = ref(false)
    const error = ref(null)
    const user_id = ref(null)

    const subjectOptions = [
      { value: 'biology_ege', label: 'Биология ЕГЭ' },
      { value: 'chemistry_ege', label: 'Химия ЕГЭ' }
    ]

    // Функция для открытия домашнего задания с использованием window.location
    const openHomework = (homework) => {
      const params = new URLSearchParams({
        subject: selectedSubject.value,
        homework_id: homework.homework_id,
        homework_name: homework.homework_name,
        lesson_number: homework.lesson_number,
        lesson_name: homework.lesson_name
      }).toString()
      
      window.location.href = `/homework.html?${params}`
    }

    // Остальной код остается без изменений
    const getCurrentUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    async function fetchHomeworks() {
      if (!selectedSubject.value) {
        homeworks.value = []
        return
      }

      try {
        loading.value = true
        error.value = null
        
        user_id.value = await getCurrentUserId()
        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        const { data: homeworkData, error: homeworkError } = await supabase
          .from(`${selectedSubject.value}_homework_list`)
          .select('*')
          .order('created_at', { ascending: false })

        if (homeworkError) throw homeworkError
        
        const { data: completionData, error: completionError } = await supabase
          .from(`${selectedSubject.value}_homework_completed`)
          .select('*')
          .eq('user_id', user_id.value)

        if (completionError) throw completionError

        homeworks.value = homeworkData.map(homework => {
          const completion = completionData?.find(c => c.homework_id === homework.homework_id)
          return {
            ...homework,
            is_completed: completion?.is_completed || false,
            score: completion?.score || null
          }
        })

      } catch (err) {
        error.value = err.message
        console.error('Ошибка загрузки домашних заданий:', err)
      } finally {
        loading.value = false
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Не указан'
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    const deadlineStatus = (dateString) => {
      if (!dateString) return 'no-deadline'
      const deadline = new Date(dateString)
      const today = new Date()
      
      today.setHours(0, 0, 0, 0)
      deadline.setHours(0, 0, 0, 0)
      
      if (deadline < today) return 'overdue'
      if (deadline.getTime() === today.getTime()) return 'today'
      return 'future'
    }

    const getStatusClass = (homework) => {
      if (homework.is_completed) {
        return homework.score !== null ? 'scored' : 'completed'
      }
      return 'not-completed'
    }

    const getStatusText = (homework) => {
      if (homework.is_completed) {
        return homework.score !== null ? `Выполнено (${homework.score} баллов)` : 'Выполнено'
      }
      return 'Не выполнено'
    }

    watch(selectedSubject, (newSubject) => {
      if (newSubject) {
        fetchHomeworks()
      }
    })

    onMounted(() => {
      getCurrentUserId()
    })

    return {
      homeworks,
      selectedSubject,
      subjectOptions,
      loading,
      error,
      formatDate,
      deadlineStatus,
      getStatusClass,
      getStatusText,
      openHomework
    }
  }
}
</script>

<!-- Стили остаются без изменений -->
<style scoped>
.homework-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.subject-selector {
  margin-bottom: 30px;
  max-width: 300px;
}

.subject-dropdown {
  width: 100%;
}

.homeworks-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.homework-card {
  background-color: #b241d1;
  border-radius: 12px;
  padding: 20px;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.2);
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.homework-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(178, 65, 209, 0.3);
}

.homework-card.completed {
  background-color: #f9f8ff;
  color: #000000;
  box-shadow: 0 4px 12px rgba(249, 248, 255, 0.3);
}

.homework-card.completed:hover {
  box-shadow: 0 6px 16px rgba(249, 248, 255, 0.4);
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 10px;
}

.homework-header h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  flex: 1;
}

.homework-card:not(.completed) .homework-header h3 {
  color: #ffffff;
}

.homework-card.completed .homework-header h3 {
  color: #000000;
}

.completion-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.homework-card:not(.completed) .completion-status {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.homework-card.completed .completion-status {
  background-color: rgba(178, 65, 209, 0.1);
  color: #000000;
}

.homework-card.completed .completion-status.scored {
  background-color: rgba(178, 65, 209, 0.2);
}

.lesson-info {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.homework-card:not(.completed) .lesson-info {
  color: rgba(255, 255, 255, 0.9);
}

.homework-card.completed .lesson-info {
  color: rgba(0, 0, 0, 0.8);
}

.homework-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.deadline {
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
}

.homework-card:not(.completed) .deadline {
  background-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.homework-card.completed .deadline {
  background-color: rgba(178, 65, 209, 0.1);
  color: #000000;
}

.homework-card:not(.completed) .deadline.overdue {
  background-color: rgba(255, 255, 255, 0.25);
}

.homework-card.completed .deadline.overdue {
  background-color: rgba(178, 65, 209, 0.2);
}

.homework-card:not(.completed) .deadline.today {
  background-color: rgba(255, 255, 255, 0.2);
}

.homework-card.completed .deadline.today {
  background-color: rgba(178, 65, 209, 0.15);
}

.homework-card:not(.completed) .deadline.future {
  background-color: rgba(255, 255, 255, 0.1);
}

.homework-card.completed .deadline.future {
  background-color: rgba(178, 65, 209, 0.05);
}

.homework-card:not(.completed) .deadline.no-deadline {
  background-color: rgba(255, 255, 255, 0.05);
}

.homework-card.completed .deadline.no-deadline {
  background-color: rgba(178, 65, 209, 0.02);
}

.score {
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
}

.homework-card:not(.completed) .score {
  background-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.homework-card.completed .score {
  background-color: rgba(178, 65, 209, 0.2);
  color: #000000;
}

.loading-message,
.error-message,
.no-homeworks,
.select-subject-prompt {
  padding: 40px;
  text-align: center;
  font-size: 1.2rem;
  color: #6c757d;
}

.error-message {
  color: #b241d1;
}

.select-subject-prompt {
  background-color: rgba(178, 65, 209, 0.1);
  border-radius: 12px;
  margin-top: 50px;
  color: #b241d1;
}

@media (max-width: 768px) {
  .homeworks-grid {
    grid-template-columns: 1fr;
  }
  
  .homework-container {
    padding: 15px;
  }
  
  .subject-selector {
    max-width: none;
  }
  
  .homework-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .homework-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>