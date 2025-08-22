
<template>
  <div class="allpage">
    <div class="topmenu">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <div class="rightparttopmenu">
        <div class="courses">Курсы</div>
        <div class="go_back"><a href="index.html">Выйти</a></div>
      </div>
    </div> 
    
    <div class="centerpartpage">
      <div class="homework-content">
        <!-- Заголовок домашнего задания -->
        <div class="homework-header">
          <h1>{{ homeworkName }}</h1>
          <div class="homework-meta">
            <span class="lesson-info">Урок {{ lessonNumber }}: {{ lessonName }}</span>
            <span class="deadline" :class="deadlineStatus">
              Дедлайн: {{ formatDate(deadline) }}
            </span>
          </div>
        </div>

        <!-- Список заданий -->
        <div class="tasks-container">
          <div v-if="loading" class="loading">Загрузка заданий...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          
          <div v-else class="tasks-list">
            <div 
              v-for="task in sortedTasks" 
              :key="task.task_id"
              class="task-item"
            >
              <div class="task-card">
                <div class="task-header">
                  <div class="task-meta">
                    <span class="task-topic">Тема: {{ task.topic }}</span>
                    <span class="task-id">#{{ task.number }}</span>
                  </div>
                  <div class="task-status" :class="getTaskStatusClass(task)">
                    {{ getTaskStatusText(task) }}
                  </div>
                </div>

                <div class="task-content">
                  <div class="task-text" v-html="sanitizeHtml(getTaskTextWithoutTables(task))"></div>
                  
                  <div v-if="task.has_table && task.table_data" class="task-table-container">
                    <table :class="{ 'with-borders': task.table_data.borders }">
                      <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
                        <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
                          <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <div class="task-images" v-if="task.images && task.images.length">
                    <div class="image-grid">
                      <div 
                        class="image-container" 
                        v-for="(image, index) in task.images" 
                        :key="index"
                      >
                        <img 
                          :src="getImageUrl(image)" 
                          :alt="'Изображение задания ' + task.number" 
                          class="task-image"
                          @click="openImageModal(getImageUrl(image))"
                          loading="lazy"
                        >
                      </div>
                    </div>
                  </div>

                  <div class="answer-section">
                    <div class="answer-input-container" v-if="task.points <= 2 && !task.userAnswer">
                      <input 
                        v-model="task.userAnswerInput" 
                        type="text" 
                        :placeholder="`Введите ответ (${task.points} балла)`" 
                        class="answer-input"
                        @keyup.enter="checkAnswer(task)"
                      >
                      <button @click="checkAnswer(task)" class="submit-button">Проверить</button>
                    </div>
                    
                    <div v-if="task.userAnswer" class="answer-feedback" :class="getFeedbackClass(task)">
                      <div class="feedback-content">
                        <span v-if="task.isCorrect" class="correct-icon">✓</span>
                        <span v-else-if="task.isPartiallyCorrect" class="partial-icon">±</span>
                        <span v-else class="incorrect-icon">✗</span>
                        {{ getFeedbackText(task) }}
                      </div>
                    </div>
                    
                    <div v-else-if="task.points >= 3" class="correct-answer">
                      Правильный ответ: {{ task.answer }}
                    </div>
                  </div>
                </div>

                <div v-if="task.userAnswer && task.explanation" class="explanation-section">
                  <div class="explanation-title">Пояснение:</div>
                  <div class="explanation-content" v-html="sanitizeHtml(task.explanation)"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Кнопка завершения -->
        <div class="completion-section" v-if="!isCompleted && hasAnswers">
          <button @click="completeHomework" class="complete-btn">
            Завершить домашнее задание
          </button>
        </div>

        <div v-if="isCompleted" class="completion-result">
          <h3>Домашнее задание завершено!</h3>
          <p>Набрано баллов: {{ totalScore }}/{{ maxScore }}</p>
        </div>
      </div>
    </div>

    <!-- Модальное окно для изображений -->
    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { supabase } from '../supabase.js'
import DOMPurify from 'dompurify'

export default {
  name: 'Homework',
  setup() {
    const homeworkData = ref({
      homework_name: '',
      lesson_number: '',
      lesson_name: '',
      deadline: null
    })
    const tasks = ref([])
    const loading = ref(true)
    const error = ref(null)
    const user_id = ref(null)
    const isCompleted = ref(false)
    const totalScore = ref(0)
    const showImageModal = ref(false)
    const selectedImage = ref('')

    // Получаем параметры из URL
    const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      return {
        subject: params.get('subject'),
        homework_id: params.get('homework_id'),
        homework_name: params.get('homework_name'),
        lesson_number: params.get('lesson_number'),
        lesson_name: params.get('lesson_name')
      }
    }

    const urlParams = getUrlParams()
    const subject = urlParams.subject
    const homeworkId = urlParams.homework_id

    // Заполняем базовые данные из URL параметров
    homeworkData.value = {
      homework_name: urlParams.homework_name || '',
      lesson_number: urlParams.lesson_number || '',
      lesson_name: urlParams.lesson_name || '',
      deadline: null
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

    // Санитизация HTML
    const sanitizeHtml = (html) => {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span'],
        ALLOWED_ATTR: ['style', 'class']
      })
    }

    // Получение URL изображения
    const getImageUrl = (imagePath) => {
      if (imagePath.startsWith('http')) return imagePath;
      
      const { data: { publicUrl } } = supabase
        .storage
        .from('task-images')
        .getPublicUrl(imagePath);
      
      return publicUrl;
    }

    // Удаление таблиц из текста задания
    const getTaskTextWithoutTables = (task) => {
      if (!task.text) return '';
      return task.has_table ? task.text.replace(/<table[\s\S]*?<\/table>/gi, '') : task.text;
    }

    // Загрузка заданий домашнего задания
    const fetchHomeworkTasks = async () => {
      try {
        loading.value = true
        user_id.value = await getCurrentUserId()

        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        if (!subject || !homeworkId) {
          throw new Error('Не указаны параметры домашнего задания')
        }

        // Загружаем задания домашнего задания
        const { data: homeworkTasks, error: homeworkError } = await supabase
          .from(`${subject}_homework_tasks`)
          .select('*')
          .eq('homework_id', homeworkId)

        if (homeworkError) throw homeworkError

        if (!homeworkTasks || homeworkTasks.length === 0) {
          throw new Error('Задания для этого домашнего задания не найдены')
        }

        // Загружаем детали заданий из банка задач
        const taskIds = homeworkTasks.map(task => task.task_id)
        const { data: taskDetails, error: taskError } = await supabase
          .from('biology_ege_task_bank')
          .select('*')
          .in('id', taskIds)

        if (taskError) throw taskError

        // Объединяем данные
        tasks.value = homeworkTasks.map(homeworkTask => {
          const taskDetail = taskDetails.find(t => t.id === homeworkTask.task_id)
          return {
            ...homeworkTask,
            ...taskDetail,
            userAnswerInput: '',
            userAnswer: null,
            isCorrect: false,
            isPartiallyCorrect: false,
            awardedPoints: 0
          }
        })

        // Загружаем прогресс выполнения
        await loadTasksProgress()

        // Проверяем статус выполнения домашнего задания
        await checkHomeworkCompletion()

      } catch (err) {
        error.value = err.message
        console.error('Ошибка загрузки заданий:', err)
      } finally {
        loading.value = false
      }
    }

    // Загрузка прогресса выполнения заданий
    const loadTasksProgress = async () => {
      if (!user_id.value) return

      try {
        const taskIds = tasks.value.map(task => task.task_id)
        const { data: progressData, error: progressError } = await supabase
          .from('biology_ege_progress')
          .select('*')
          .eq('user_id', user_id.value)
          .in('task_id', taskIds)

        if (progressError) throw progressError

        // Обновляем задачи с данными о прогрессе
        tasks.value = tasks.value.map(task => {
          const progress = progressData?.find(p => p.task_id === task.task_id)
          if (progress) {
            return {
              ...task,
              userAnswer: progress.user_answer,
              isCorrect: progress.score === task.points,
              isPartiallyCorrect: progress.score > 0 && progress.score < task.points,
              awardedPoints: progress.score || 0
            }
          }
          return task
        })

      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err)
      }
    }

    // Проверка ответа на задание
    const checkAnswer = async (task) => {
      if (!task.userAnswerInput.trim()) return

      const userAnswer = task.userAnswerInput.trim()
      const correctAnswer = task.answer.toString().trim()
      
      task.userAnswer = userAnswer
      task.isCorrect = userAnswer === correctAnswer
      
      // Для 2-балльных заданий проверяем частичное совпадение
      if (task.points === 2 && !task.isCorrect) {
        task.isPartiallyCorrect = checkPartialMatch(userAnswer, correctAnswer)
      } else {
        task.isPartiallyCorrect = false
      }

      // Определяем начисляемые баллы
      task.awardedPoints = task.isCorrect ? task.points 
                        : task.isPartiallyCorrect ? 1 
                        : 0

      // Сохраняем прогресс
      await saveTaskProgress(task)
    }

    // Проверка частичного совпадения
    const checkPartialMatch = (userAnswer, correctAnswer) => {
      if (userAnswer === correctAnswer) return false
      
      // Для числовых ответов
      if (/^\d+$/.test(userAnswer)) {
        if (userAnswer.length !== correctAnswer.length) return false
        
        let diffCount = 0
        for (let i = 0; i < userAnswer.length; i++) {
          if (userAnswer[i] !== correctAnswer[i]) {
            diffCount++
            if (diffCount > 1) return false
          }
        }
        return diffCount === 1
      }
      
      // Для текстовых ответов
      const correctParts = correctAnswer.split(/[,;]/).map(part => part.trim())
      const userParts = userAnswer.split(/[,;]/).map(part => part.trim())
      
      return userParts.some(part => correctParts.includes(part))
    }

    // Сохранение прогресса выполнения задания
    const saveTaskProgress = async (task) => {
      if (!user_id.value) return

      try {
        const { error } = await supabase
          .from('biology_ege_progress')
          .upsert({
            user_id: user_id.value,
            task_id: task.task_id,
            is_completed: task.isCorrect || task.isPartiallyCorrect,
            score: task.awardedPoints,
            user_answer: task.userAnswer,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'user_id,task_id'
          })

        if (error) throw error

      } catch (err) {
        console.error('Ошибка сохранения прогресса:', err)
        throw err
      }
    }

    // Завершение домашнего задания
    const completeHomework = async () => {
      try {
        // Сохраняем все ответы
        for (const task of tasks.value) {
          if (task.userAnswerInput && !task.userAnswer) {
            await checkAnswer(task)
          }
        }

        // Обновляем статус домашнего задания
        const { error } = await supabase
          .from(`${subject}_homework_completed`)
          .upsert({
            homework_id: homeworkId,
            user_id: user_id.value,
            is_completed: true,
            score: totalScore.value,
            completed_at: new Date().toISOString()
          }, {
            onConflict: 'homework_id,user_id'
          })

        if (error) throw error

        isCompleted.value = true
        alert('Домашнее задание завершено!')

      } catch (err) {
        error.value = err.message
        console.error('Ошибка завершения домашнего задания:', err)
      }
    }

    // Проверка статуса выполнения домашнего задания
    const checkHomeworkCompletion = async () => {
      if (!user_id.value) return

      try {
        const { data: completionData, error: completionError } = await supabase
          .from(`${subject}_homework_completed`)
          .select('*')
          .eq('homework_id', homeworkId)
          .eq('user_id', user_id.value)
          .single()

        if (completionError && completionError.code !== 'PGRST116') {
          throw completionError
        }

        if (completionData) {
          isCompleted.value = completionData.is_completed
          totalScore.value = completionData.score || 0
        }

      } catch (err) {
        console.error('Ошибка проверки статуса выполнения:', err)
      }
    }

    // Открытие модального окна с изображением
    const openImageModal = (imageUrl) => {
      selectedImage.value = imageUrl
      showImageModal.value = true
      document.body.style.overflow = 'hidden'
    }

    const closeImageModal = () => {
      showImageModal.value = false
      document.body.style.overflow = ''
    }

    // Форматирование даты
    const formatDate = (dateString) => {
      if (!dateString) return 'Не указан'
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    // Обновляем общий балл
    const updateTotalScore = () => {
      totalScore.value = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
    }

    // Статус дедлайна
    const deadlineStatus = computed(() => {
      if (!homeworkData.value.deadline) return 'no-deadline'
      const deadline = new Date(homeworkData.value.deadline)
      const today = new Date()
      
      today.setHours(0, 0, 0, 0)
      deadline.setHours(0, 0, 0, 0)
      
      if (deadline < today) return 'overdue'
      if (deadline.getTime() === today.getTime()) return 'today'
      return 'future'
    })

    // Отсортированные задания по номеру
    const sortedTasks = computed(() => {
      return [...tasks.value].sort((a, b) => a.number - b.number)
    })

    // Есть ли ответы на задания
    const hasAnswers = computed(() => {
      return tasks.value.some(task => task.userAnswer)
    })

    // Максимальный возможный балл
    const maxScore = computed(() => {
      return tasks.value.reduce((sum, task) => sum + task.points, 0)
    })

    // Статус задания
    const getTaskStatusClass = (task) => {
      if (!task.userAnswer) return 'status-not-completed'
      if (task.isCorrect) return 'status-correct'
      if (task.isPartiallyCorrect) return 'status-partial'
      return 'status-incorrect'
    }

    const getTaskStatusText = (task) => {
      if (!task.userAnswer) return 'Не решено'
      if (task.isCorrect) return `✓ Верно (${task.awardedPoints}/${task.points} балла)`
      if (task.isPartiallyCorrect) return `± Частично (${task.awardedPoints}/${task.points} балла)`
      return `✗ Неверно (0/${task.points} балла)`
    }

    // Класс для фидбека
    const getFeedbackClass = (task) => {
      if (task.isCorrect) return 'correct-feedback'
      if (task.isPartiallyCorrect) return 'partial-feedback'
      return 'incorrect-feedback'
    }

    const getFeedbackText = (task) => {
      if (task.isCorrect) return `Верно! Ответ: ${task.answer} (${task.awardedPoints}/${task.points} балла)`
      if (task.isPartiallyCorrect) return `Частично верно! Ответ: ${task.answer} (${task.awardedPoints}/${task.points} балла)`
      return `Неверно. Ответ: ${task.answer} (0/${task.points} балла)`
    }

    // Следим за изменениями баллов
    onMounted(() => {
      if (subject && homeworkId) {
        fetchHomeworkTasks()
      } else {
        error.value = 'Не указаны параметры домашнего задания'
        loading.value = false
      }
    })

    // Обновляем общий балл при изменениях
    watch(() => tasks.value.map(t => t.awardedPoints), () => {
      updateTotalScore()
    }, { deep: true })

    return {
      homeworkName: homeworkData.value.homework_name,
      lessonNumber: homeworkData.value.lesson_number,
      lessonName: homeworkData.value.lesson_name,
      deadline: homeworkData.value.deadline,
      sortedTasks,
      loading,
      error,
      isCompleted,
      totalScore,
      maxScore,
      showImageModal,
      selectedImage,
      sanitizeHtml,
      getImageUrl,
      getTaskTextWithoutTables,
      checkAnswer,
      completeHomework,
      formatDate,
      deadlineStatus,
      getTaskStatusClass,
      getTaskStatusText,
      getFeedbackClass,
      getFeedbackText,
      openImageModal,
      closeImageModal,
      updateTotalScore,
      hasAnswers
    }
  }
}
</script>
