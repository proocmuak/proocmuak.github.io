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
      <div v-else-if="!hasAccess" class="no-access-message">
        Домашние задания будут доступны с {{ formatAccessDate(studentAccessFrom) }}
      </div>
      <div v-else-if="filteredHomeworks.length === 0" class="no-homeworks">
        Нет доступных домашних заданий для выбранного предмета
      </div>
      
      <div v-else class="homeworks-grid">
        <div 
          v-for="homework in filteredHomeworks" 
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
          <p class="lesson-date" v-if="homework.lesson_date">
            Дата урока: {{ formatDate(homework.lesson_date) }}
          </p>
          
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
import { ref, watch, onMounted, computed } from 'vue'
import { supabase } from '../supabase.js'
import CustomDropdown from './CustomDropdown.vue'

export default {
  name: 'HomeworkList',
  components: {
    CustomDropdown
  },
  setup() {
    const homeworks = ref([])
    const lessons = ref([])
    const selectedSubject = ref(null)
    const subjectOptions = ref([])
    const loading = ref(false)
    const error = ref(null)
    const user_id = ref(null)
    const studentAccessFrom = ref(null)
    const studentData = ref(null)

    // Преобразование названия предмета в имя таблицы
    const getSubjectTableName = (subjectName) => {
      const subjectMap = {
        'Химия ЕГЭ': 'chemistry_ege',
        'Химия ОГЭ': 'chemistry_oge',
        'Биология ЕГЭ': 'biology_ege',
        'Биология ОГЭ': 'biology_oge'
      }
      return subjectMap[subjectName] || subjectName.toLowerCase().replace(/\s+/g, '_')
    }

    // Получение поля доступа для предмета
    const getAccessField = (subjectName) => {
      if (subjectName.includes('Химия')) return 'subject1_access_from'
      if (subjectName.includes('Биология')) return 'subject2_access_from'
      return 'access_from'
    }

    // Проверяем, есть ли у студента доступ к домашним заданиям
    const hasAccess = computed(() => {
      if (!studentAccessFrom.value) return false
      
      const today = new Date()
      const accessDate = new Date(studentAccessFrom.value)
      
      today.setHours(0, 0, 0, 0)
      accessDate.setHours(0, 0, 0, 0)
      
      return today >= accessDate
    })

    // Загрузка уроков для выбранного предмета
    const fetchLessons = async () => {
      if (!selectedSubject.value) {
        lessons.value = []
        return
      }

      try {
        const { data, error: lessonsError } = await supabase
          .from(selectedSubject.value)
          .select('number, date, title')
          .order('number', { ascending: true })

        if (lessonsError) throw lessonsError
        
        lessons.value = data || []
        console.log('Уроки загружены:', lessons.value)
      } catch (err) {
        console.error('Ошибка загрузки уроков:', err)
        lessons.value = []
      }
    }

    // Фильтруем домашние задания по дате доступа
    const filteredHomeworks = computed(() => {
      if (!hasAccess.value || !studentAccessFrom.value) {
        console.log('Нет доступа или даты доступа')
        return []
      }
      
      const accessDate = new Date(studentAccessFrom.value)
      accessDate.setHours(0, 0, 0, 0)
      
      const filtered = homeworks.value.filter(homework => {
        // Приводим lesson_number к number для сравнения
        const lessonNumber = Number(homework.lesson_number)
        const lesson = lessons.value.find(l => l.number === lessonNumber)
        
        if (!lesson || !lesson.date) {
          console.log(`Урок ${lessonNumber} не найден или нет даты`, {
            homeworkLesson: homework.lesson_number,
            lessonNumber: lessonNumber,
            lessons: lessons.value.map(l => l.number)
          })
          return false
        }
        
        const lessonDate = new Date(lesson.date)
        lessonDate.setHours(0, 0, 0, 0)
        
        const isAvailable = lessonDate >= accessDate
        console.log(`Урок ${lessonNumber}: дата урока ${lesson.date}, доступ с ${studentAccessFrom.value}, доступен: ${isAvailable}`)
        
        return isAvailable
      })
      
      console.log('Отфильтрованные задания:', filtered)
      return filtered
    })

    // Функция для открытия домашнего задания
    const openHomework = (homework) => {
      const subjectKey = getSubjectKeyFromTable(selectedSubject.value)
      const examType = getExamTypeFromTable(selectedSubject.value)
      
      const params = new URLSearchParams({
        subject: subjectKey,
        exam_type: examType,
        homework_id: homework.homework_id,
        homework_name: homework.homework_name,
        lesson_number: homework.lesson_number,
        lesson_name: homework.lesson_name
      }).toString()
      
      window.location.href = `/homework.html?${params}`
    }

    // Получение ID текущего пользователя
    const getCurrentUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    // Получение данных студента и даты доступа
    const fetchStudentData = async () => {
      try {
        user_id.value = await getCurrentUserId()
        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        const { data, error: studentError } = await supabase
          .from('students')
          .select('subject1, subject2, subject1_access_from, subject2_access_from')
          .eq('user_id', user_id.value)
          .single()

        if (studentError) throw studentError

        studentData.value = data
        return data

      } catch (err) {
        console.error('Ошибка загрузки данных студента:', err)
        return null
      }
    }

    // Получение предметов пользователя
    const fetchUserSubjects = async () => {
      try {
        const studentData = await fetchStudentData()
        if (!studentData) {
          throw new Error('Не удалось загрузить данные студента')
        }

        const options = []
        if (studentData.subject1) {
          options.push({
            value: getSubjectTableName(studentData.subject1),
            label: studentData.subject1,
            accessField: getAccessField(studentData.subject1)
          })
        }
        if (studentData.subject2) {
          options.push({
            value: getSubjectTableName(studentData.subject2),
            label: studentData.subject2,
            accessField: getAccessField(studentData.subject2)
          })
        }

        subjectOptions.value = options

      } catch (err) {
        console.error('Ошибка загрузки предметов:', err)
        error.value = 'Не удалось загрузить список предметов'
      }
    }

    // Обновление даты доступа при смене предмета
    const updateAccessDate = (subjectValue) => {
      if (!subjectValue || !studentData.value) {
        studentAccessFrom.value = null
        return
      }

      const subjectOption = subjectOptions.value.find(opt => opt.value === subjectValue)
      if (!subjectOption) {
        studentAccessFrom.value = null
        return
      }

      const accessField = subjectOption.accessField
      studentAccessFrom.value = studentData.value[accessField]
      console.log(`Дата доступа для ${subjectOption.label}:`, studentAccessFrom.value)
    }

    // Получение ключа предмета из имени таблицы
    const getSubjectKeyFromTable = (tableName) => {
      if (tableName.includes('chemistry')) return 'chemistry'
      if (tableName.includes('biology')) return 'biology'
      return 'biology'
    }

    // Получение типа экзамена из имени таблицы
    const getExamTypeFromTable = (tableName) => {
      if (tableName.includes('_ege')) return 'ege'
      if (tableName.includes('_oge')) return 'oge'
      return 'ege'
    }

    async function fetchHomeworks() {
      if (!selectedSubject.value) {
        homeworks.value = []
        lessons.value = []
        return
      }

      try {
        loading.value = true
        error.value = null
        
        user_id.value = await getCurrentUserId()
        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        // Обновляем дату доступа
        updateAccessDate(selectedSubject.value)

        // Загружаем уроки и домашние задания параллельно
        await Promise.all([fetchLessons()])

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

        // Обогащаем домашние задания данными об уроках
        homeworks.value = homeworkData.map(homework => {
          const completion = completionData?.find(c => c.homework_id === homework.homework_id)
          const lessonNumber = Number(homework.lesson_number)
          const lesson = lessons.value.find(l => l.number === lessonNumber)
          
          return {
            ...homework,
            is_completed: completion?.is_completed || false,
            score: completion?.score || null,
            lesson_date: lesson?.date || null,
            lesson_title: lesson?.title || null
          }
        })

        console.log('Все домашние задания:', homeworks.value)
        console.log('Все уроки:', lessons.value)

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

    const formatAccessDate = (dateString) => {
      if (!dateString) return 'даты не указана'
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

    onMounted(async () => {
      await fetchUserSubjects()
    })

    return {
      homeworks,
      filteredHomeworks,
      selectedSubject,
      subjectOptions,
      loading,
      error,
      hasAccess,
      studentAccessFrom,
      formatDate,
      formatAccessDate,
      deadlineStatus,
      getStatusClass,
      getStatusText,
      openHomework
    }
  }
}
</script>

<style scoped>
.homework-container {
  max-width: 75rem;
  margin: 0 auto;
  padding: 1.25rem;
  box-sizing: border-box;
}

.subject-selector {
  margin-bottom: 1.875rem;
  max-width: 18.75rem;
}

.subject-dropdown {
  width: 100%;
}

.homeworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 21.875rem), 1fr));
  gap: 1.25rem;
  margin-top: 1.25rem;
}

.homework-card {
  background-color: #b241d1;
  border-radius: 0.75rem;
  padding: 1.25rem;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 0.25rem 0.75rem rgba(178, 65, 209, 0.2);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 9.375rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.homework-card:hover {
  transform: translateY(-0.125rem);
  box-shadow: 0 0.375rem 1rem rgba(178, 65, 209, 0.3);
}

.homework-card.completed {
  background-color: #f9f8ff;
  color: #000000;
  box-shadow: 0 0.25rem 0.75rem rgba(249, 248, 255, 0.3);
}

.homework-card.completed:hover {
  box-shadow: 0 0.375rem 1rem rgba(249, 248, 255, 0.4);
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 0.625rem;
}

.homework-header h3 {
  margin: 0;
  font-size: clamp(1.1rem, 2.5vw, 1.3rem);
  font-weight: 600;
  flex: 1;
  line-height: 1.4;
  word-wrap: break-word;
}

.homework-card:not(.completed) .homework-header h3 {
  color: #ffffff;
}

.homework-card.completed .homework-header h3 {
  color: #000000;
}

.completion-status {
  padding: 0.25rem 0.5rem;
  border-radius: 0.75rem;
  font-size: clamp(0.75rem, 2vw, 0.8rem);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
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
  margin: 0 0 0.75rem 0;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  line-height: 1.4;
  opacity: 0.9;
}

.homework-card:not(.completed) .lesson-info {
  color: rgba(255, 255, 255, 0.9);
}

.homework-card.completed .lesson-info {
  color: rgba(0, 0, 0, 0.8);
}

.lesson-date {
  font-size: 0.8rem;
  opacity: 0.8;
  margin: 0.25rem 0 0.75rem 0;
}

.homework-card:not(.completed) .lesson-date {
  color: rgba(255, 255, 255, 0.8);
}

.homework-card.completed .lesson-date {
  color: rgba(0, 0, 0, 0.6);
}

.homework-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.deadline {
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
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
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
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
.select-subject-prompt,
.no-access-message {
  padding: 2.5rem;
  text-align: center;
  font-size: clamp(1.1rem, 3vw, 1.2rem);
  color: #6c757d;
}

.error-message {
  color: #b241d1;
}

.no-access-message {
  color: #ff9800;
  background-color: #fff3e0;
  border-radius: 0.75rem;
  border-left: 4px solid #ff9800;
  margin-top: 1.25rem;
}

.select-subject-prompt {
  background-color: rgba(178, 65, 209, 0.1);
  border-radius: 0.75rem;
  margin-top: 3.125rem;
  color: #b241d1;
  padding: 1.5rem;
}

/* Медиа-запросы для адаптивности */
@media (max-width: 1200px) {
  .homework-container {
    padding: 1rem;
    max-width: 90%;
  }
  
  .homeworks-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .homework-container {
    padding: 0.875rem;
    max-width: 95%;
  }
  
  .homeworks-grid {
    grid-template-columns: 1fr;
    gap: 0.875rem;
  }
  
  .subject-selector {
    max-width: 100%;
    margin-bottom: 1.5rem;
  }
  
  .homework-header {
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }
  
  .homework-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .homework-card {
    padding: 1rem;
    min-height: auto;
  }
  
  .completion-status {
    align-self: flex-start;
  }
}

@media (max-width: 480px) {
  .homework-container {
    padding: 0.625rem;
  }
  
  .homework-card {
    padding: 0.875rem;
    border-radius: 0.5rem;
  }
  
  .homework-header h3 {
    font-size: 1rem;
  }
  
  .lesson-info {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }
  
  .deadline,
  .score {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
  
  .loading-message,
  .error-message,
  .no-homeworks,
  .select-subject-prompt,
  .no-access-message {
    padding: 1.5rem;
    font-size: 1rem;
  }
  
  .select-subject-prompt {
    margin-top: 2rem;
    padding: 1rem;
  }
}

@media (max-width: 320px) {
  .homework-container {
    padding: 0.5rem;
  }
  
  .homework-card {
    padding: 0.75rem;
  }
}
</style>