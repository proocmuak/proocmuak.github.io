<template>
  <div class="allpage">
    <div class="topmenu">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <div class="rightparttopmenu">
        <div class="redirect_menu" @click="redirectToMenu">На главную</div>
        <div class="go_back"><a href="index.html">Выйти</a></div>
      </div>
    </div> 
    
    <div class="centerpartpage">
      <div class="homework-content">
        <!-- Заголовок домашнего задания -->
        <div class="homework-header">
          <h1>{{ homeworkName }}</h1>
          <div v-if="isTutorMode" class="tutor-mode-banner">
            📝 Режим проверки куратора
          </div>
          <div class="homework-meta">
            <span class="lesson-info">Урок {{ homeworkData.lesson_number || 'Н/Д' }}: {{ homeworkData.lesson_name || 'Н/Д' }}</span>
            <span class="deadline" :class="deadlineStatus">
              Дедлайн: {{ formatDate(homeworkData.deadline) }}
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
              :class="{ 'extended-task': isSecondPartTask(task) }"
              :data-task-id="task.task_id"
            >
              <div class="task-card">
                <div class="task-header">
                  <div class="task-meta">
                    <span class="task-topic">Тема: {{ task.topic }}</span>
                    <span class="task-id">#{{ task.number }} ({{ task.points }} балла)</span>
                    <span v-if="isSecondPartTask(task)" class="task-part-badge">Вторая часть</span>
                  </div>
                  <div class="task-status" :class="getTaskStatusClass(task)">
                    {{ getTaskStatusText(task) }}
                  </div>
                </div>

                <div class="task-content">
                  <div 
                    class="task-text" 
                    v-html="sanitizeHtml(getTaskTextWithoutTables(task))"
                    @copy.prevent
                    @cut.prevent
                    @dragstart.prevent
                  ></div>
                  
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
                    <!-- Режим редактирования -->
                    <div v-if="task.isEditing" class="edit-mode">
                      <div class="answer-input-container">
                        <textarea 
                          v-if="isSecondPartTask(task)"
                          v-model="task.editAnswerInput" 
                          :placeholder="'Введите развернутый ответ (' + task.points + ' балла)'" 
                          class="answer-textarea extended"
                          rows="6"
                          @keydown.ctrl.enter="saveEditedAnswer(task)"
                          ref="editInput"
                        ></textarea>
                        
                        <input 
                          v-else
                          v-model="task.editAnswerInput" 
                          type="text" 
                          :placeholder="'Введите ответ (' + task.points + ' балла)'" 
                          class="answer-input"
                          @keyup.enter="saveEditedAnswer(task)"
                          ref="editInput"
                        >
                        
                        <button @click="saveEditedAnswer(task)" class="submit-button">Сохранить</button>
                        <button @click="cancelEdit(task)" class="cancel-button">Отмена</button>
                      </div>
                      
                      <div v-if="isSecondPartTask(task)" class="image-upload-section">
                        <label class="upload-label">
                          📎 Прикрепить изображения
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            @change="handleImageUpload(task, $event)"
                            class="file-input"
                          >
                        </label>
                        
                        <div v-if="task.uploadingImages" class="upload-status-uploading">
                          ⏳ Загрузка изображений...
                        </div>
                        
                        <div v-if="task.uploadSuccess" class="upload-status-success">
                          ✅ Изображения успешно сохранены!
                        </div>
                        
                        <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images-preview">
                          <div class="images-title">Загруженные изображения:</div>
                          <div class="images-grid">
                            <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                              <img 
                                :src="getAnswerImageUrl(imagePath)" 
                                :alt="'Изображение ответа ' + (imgIndex + 1)"
                                class="answer-image"
                                @click="openImageModal(getAnswerImageUrl(imagePath))"
                              >
                              <button 
                                @click="removeAnswerImage(task, imgIndex)"
                                class="remove-image-btn"
                                title="Удалить изображение"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <button @click="saveAnswer(task)" class="save-images-btn">
                            💾 Сохранить изменения
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Режим ввода нового ответа -->
                    <div v-else-if="!task.userAnswer && !isViewMode && !isCompleted">
                      <div v-if="!task.answerImages || task.answerImages.length === 0" class="answer-input-container">
                        <textarea 
                          v-if="isSecondPartTask(task)"
                          v-model="task.userAnswerInput" 
                          :placeholder="'Введите развернутый ответ (' + task.points + ' балла)'" 
                          class="answer-textarea extended"
                          rows="6"
                          @keydown.ctrl.enter="saveAnswer(task)"
                        ></textarea>
                        
                        <input 
                          v-else
                          v-model="task.userAnswerInput" 
                          type="text" 
                          :placeholder="'Введите ответ (' + task.points + ' балла)'" 
                          class="answer-input"
                          @keyup.enter="saveAnswer(task)"
                        >
                        
                        <button @click="saveAnswer(task)" class="submit-button">Сохранить</button>
                      </div>
                      
                      <div v-if="isSecondPartTask(task)" class="image-upload-section">
                        <label class="upload-label">
                          📎 Прикрепить изображения
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            @change="handleImageUpload(task, $event)"
                            class="file-input"
                          >
                        </label>
                        <div v-if="task.uploadingImages" class="uploading-text">
                          Загрузка...
                        </div>
                        
                        <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images-preview">
                          <div class="images-title">Загруженные изображения:</div>
                          <div class="images-grid">
                            <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                              <img 
                                :src="getAnswerImageUrl(imagePath)" 
                                :alt="'Изображение ответа ' + (imgIndex + 1)"
                                class="answer-image"
                                @click="openImageModal(getAnswerImageUrl(imagePath))"
                              >
                              <button 
                                @click="removeAnswerImage(task, imgIndex)"
                                class="remove-image-btn"
                                title="Удалить изображение"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <button @click="saveAnswer(task)" class="submit-button">Сохранить ответ</button>
                        </div>
                      </div>
                      
                      <div v-if="task.saving" class="saving-status">Сохранение...</div>
                    </div>
                    
                    <!-- Отображаем ответы только после завершения работы -->
                    <div v-else-if="(isCompleted || task.userAnswer || (task.answerImages && task.answerImages.length > 0)) && showAnswers" class="answer-result">
                      <div class="answer-feedback" :class="getFeedbackClass(task)">
                        <div class="feedback-content">
                          <span v-if="task.isCorrect" class="correct-icon">✓</span>
                          <span v-else-if="task.isPartiallyCorrect" class="partial-icon">±</span>
                          <span v-else class="incorrect-icon">✗</span>
                          
                          <div v-if="task.userAnswer" class="user-answer-container">
                            <strong>Ответ студента:</strong> 
                            <div class="user-answer-text" :class="{ 'multiline': isSecondPartTask(task) }">
                              <pre v-if="isSecondPartTask(task)" style="white-space: pre-wrap; font-family: inherit; margin: 0.5rem 0;">{{ task.userAnswer }}</pre>
                              <span v-else>{{ task.userAnswer }}</span>
                            </div>
                          </div>
                          
                          <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images">
                            <div class="images-title">Прикрепленные изображения:</div>
                            <div class="images-grid">
                              <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                                <img 
                                  :src="getAnswerImageUrl(imagePath)" 
                                  :alt="'Изображение ответа ' + (imgIndex + 1)"
                                  class="answer-image"
                                  @click="openImageModal(getAnswerImageUrl(imagePath))"
                                >
                                <button 
                                  v-if="!isCompleted && !isTutorMode"
                                  @click="removeAnswerImage(task, imgIndex)"
                                  class="remove-image-btn"
                                  title="Удалить изображение"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>

                          <span class="correct-answer-text">
                            <strong>Правильный ответ:</strong> 
                            <span v-html="sanitizeHtml(formatAnswerText(task.answer))"></span>
                          </span>
                          
                          <div v-if="isTutorMode" class="tutor-scoring-panel">
                            <span class="score-label">Оценка куратора:</span>
                            <select 
                              v-model="task.manualScore" 
                              @change="setTutorScore(task, parseInt($event.target.value))"
                              class="score-select"
                              :disabled="task.saving"
                            >
                              <option v-for="n in task.points + 1" :value="n - 1" :key="n">
                                {{ n - 1 }} баллов
                              </option>
                            </select>
                            <span v-if="task.saving" class="saving-status">Сохранение...</span>
                          </div>
                          
                          <span class="current-score" v-if="task.awardedPoints !== null">
                            Набрано баллов: {{ task.awardedPoints }}/{{ task.points }}
                          </span>
                          
                          <button 
                            v-if="!isCompleted && !isTutorMode" 
                            @click="startEdit(task)" 
                            class="edit-answer-btn"
                            title="Редактировать ответ"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Ответ сохранен, но домашнее задание не завершено -->
                    <div v-else-if="(task.userAnswer || (task.answerImages && task.answerImages.length > 0) || task.answerSaved) && !showAnswers" class="answer-saved">
                      <span class="saved-icon">✓</span> Ответ сохранен
                      
                      <div v-if="task.userAnswer" class="user-answer-container">
                        <div class="user-answer-text" :class="{ 'multiline': isSecondPartTask(task) }">
                          <pre v-if="isSecondPartTask(task)" style="white-space: pre-wrap; font-family: inherit; margin: 0.5rem 0;">{{ task.userAnswer }}</pre>
                          <span v-else>{{ task.userAnswer }}</span>
                        </div>
                      </div>
                      
                      <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images">
                        <div class="images-title">Прикрепленные изображения:</div>
                        <div class="images-grid">
                          <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                            <img 
                              :src="getAnswerImageUrl(imagePath)" 
                              :alt="'Изображение ответа ' + (imgIndex + 1)"
                              class="answer-image"
                              @click="openImageModal(getAnswerImageUrl(imagePath))"
                            >
                            <button 
                              @click="removeAnswerImage(task, imgIndex)"
                              class="remove-image-btn"
                              title="Удалить изображение"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        @click="startEdit(task)" 
                        class="edit-answer-btn"
                        title="Редактировать ответ"
                      >
                        ✏️
                      </button>
                    </div>
                    
                  </div>
                </div>

                <!-- Пояснение к заданию -->
                <div v-if="showAnswers && (task.explanation || (task.image_explanation && task.image_explanation.length))" 
                     class="explanation-section">
                  <div class="explanation-header" @click="toggleExplanation(task)" style="cursor: pointer;">
                    <div class="explanation-title">
                      Пояснение: 
                      <span class="explanation-toggle">
                        {{ task.showExplanation ? '▲' : '▼' }}
                      </span>
                    </div>
                  </div>
                  
                  <transition name="slide">
                    <div v-if="task.showExplanation" class="explanation-content-container">
                      <div class="explanation-content">
                        <div v-if="task.explanation" v-html="sanitizeHtml(formatTextWithParagraphs(task.explanation))"></div>
                        
                        <div v-if="task.image_explanation && Array.isArray(task.image_explanation)" 
                             v-for="(imagePath, index) in task.image_explanation" :key="index">
                          <div class="explanation-image-container">
                            <img :src="getImageUrl(imagePath)" 
                                 alt="Пояснение к заданию" 
                                 class="explanation-image"
                                 @click="openImageModal(getImageUrl(imagePath))">
                          </div>
                        </div>
                        
                        <div v-else-if="typeof task.image_explanation === 'string'">
                          <div class="explanation-image-container">
                            <img :src="getImageUrl(task.image_explanation)" 
                                 alt="Пояснение к заданию" 
                                 class="explanation-image"
                                 @click="openImageModal(getImageUrl(task.image_explanation))">
                          </div>
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Блок итоговой оценки куратора -->
        <div v-if="isTutorMode" class="tutor-final-assessment">
          <h3>Итоговая оценка</h3>
          
          <div class="student-info">
            <div class="student-name">
              <strong>Ученик:</strong> {{ studentFullName }}
            </div>
          </div>
          
          <div class="final-score">
            Общий балл: {{ totalScore }}/{{ maxScore }}
            <div class="completion-percent">
              Выполнено на: {{ completionPercent }}%
            </div>
          </div>
          
          <div class="tutor-actions">
            <button @click="updateHomeworkCompletedOnly" class="save-final-score-btn">
              Сохранить итоговую оценку (без уведомления)
            </button>
          </div>
        </div>

        <!-- Кнопка завершения -->
        <div v-if="!isViewMode && !isCompleted && hasAnswers" class="completion-section">
          <button @click="completeHomework" class="complete-btn">
            Завершить домашнее задание
          </button>
        </div>

        <div v-if="isCompleted" class="completion-result">
          <h3>Домашнее задание завершено!</h3>
          <p>Набрано баллов: {{ totalScore }}/{{ maxScore }}</p>
          <p>Выполнено на: {{ completionPercent }}%</p>
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
// Весь script остается без изменений
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { supabase } from './supabase.js'
import DOMPurify from 'dompurify'

// === Конфигурация прокси сервера ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

// === Список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20]
}

// === Нормализация номера ===
function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null
  const s = String(taskNumber).trim()
  const m = s.match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isNaN(n) ? null : n
}

// === Короткий subject из названия таблицы ===
function shortSubjectFromProgressTable(progressTableName) {
  const s = String(progressTableName).toLowerCase()
  if (s.includes('chemistry')) return 'chemistry'
  if (s.includes('biology')) return 'biology'
  return null
}

// === Вспомогательные функции ===
function splitAnswerVariantsRaw(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[/]|ИЛИ/i)
    .map(s => s.trim())
    .filter(Boolean)
}

function isDigitSequence(s) {
  return /^[0-9]+$/.test(s)
}

function splitNumericElements(s) {
  return s.split('').filter(ch => /\d/.test(ch))
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '')
}

// === Проверка числовых ответов ===
function checkNumericAnswer(userRaw, variant, points, orderMatters) {
  const userElems = splitNumericElements(userRaw)
  const correctElems = splitNumericElements(variant)

  if (orderMatters) {
    let matches = 0
    for (let i = 0; i < correctElems.length; i++) {
      if (userElems[i] === correctElems[i]) matches++
    }
    const mistakes = correctElems.length - matches
    if (mistakes === 0) {
      return { correct: true, partial: false }
    }
    if (points === 2 && mistakes === 1) {
      return { correct: false, partial: true }
    }
  } else {
    if (points === 1 && correctElems.length === userElems.length) {
      let matches = 0
      for (let i = 0; i < correctElems.length; i++) {
        if (userElems[i] === correctElems[i]) matches++
      }
      if (matches === correctElems.length) {
        return { correct: true, partial: false }
      }
    }

    if (points === 2) {
      const sortedCorrect = [...correctElems].sort()
      const sortedUser = [...userElems].sort()

      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        return { correct: true, partial: false }
      }

      const matches = userElems.filter(e => correctElems.includes(e)).length
      if (
        ((matches === userElems.length || matches === correctElems.length) &&
          Math.abs(correctElems.length - userElems.length) === 1) ||
        Math.abs(matches - correctElems.length) === 1
      ) {
        return { correct: false, partial: true }
      }
    }
  }

  return { correct: false, partial: false }
}

// === Проверка ответа ===
function checkAnswerComponent(userAnswerRaw, correctAnswerRaw, points, shortSubject, taskNumberRaw) {
  const userRaw = userAnswerRaw == null ? '' : String(userAnswerRaw).trim()
  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false }
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw)
  let anyCorrect = false
  let anyPartial = false

  const taskNum = normalizeTaskNumber(taskNumberRaw)
  let orderMatters = false
  if (points === 2 && shortSubject && taskNum != null) {
    orderMatters = ORDERED_TASKS[shortSubject]?.includes(taskNum) || false
  }

  for (const variant of variants) {
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      const { correct, partial } = checkNumericAnswer(userRaw, variant, points, orderMatters)
      if (correct) {
        anyCorrect = true
        break
      }
      if (partial) {
        anyPartial = true
      }
    } else {
      if (normalizeText(userRaw) === normalizeText(variant)) {
        anyCorrect = true
        break
      }
    }
  }

  const isCorrect = anyCorrect
  const isPartiallyCorrect = !isCorrect && anyPartial
  const score = isCorrect ? points : isPartiallyCorrect ? 1 : 0

  return { score, isCorrect, isPartiallyCorrect }
}

// === Функция для конвертации старых URL в пути ===
function extractPathFromUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (!url.startsWith('http')) return url
  
  const patterns = [
    /\/storage\/v1\/object\/public\/task-images\/(.+)$/,
    /\/storage\/v1\/object\/public\/answers\/(.+)$/,
    /\/task-images\/(.+)$/,
    /\/answers\/(.+)$/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return url
}

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
    const showAnswers = ref(false)
    const subject = ref('')
    const examType = ref('')
    const homeworkId = ref('')
    const editInput = ref(null)
    const studentInfo = ref(null)

    const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      const subjectParam = params.get('subject')
      const examTypeParam = params.get('exam_type')
      
      let finalSubject = subjectParam
      let finalExamType = examTypeParam
      
      if (!finalExamType && subjectParam) {
        if (subjectParam.includes('_')) {
          const parts = subjectParam.split('_')
          finalSubject = parts[0]
          finalExamType = parts[1]
        } else {
          finalExamType = 'ege'
        }
      }

      return {
        subject: finalSubject,
        exam_type: finalExamType,
        homework_id: params.get('homework_id'),
        homework_name: params.get('homework_name'),
        lesson_number: params.get('lesson_number'),
        lesson_name: params.get('lesson_name'),
        view_mode: params.get('view_mode'),
        student_id: params.get('student_id')
      }
    }

    const getTutorName = async (studentId) => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('tutor')
          .eq('user_id', studentId)
          .single()

        if (error) throw error
        return data?.tutor || null
      } catch (err) {
        console.error('Ошибка получения tutor:', err)
        return null
      }
    }

    const createHomeworkNotification = async (score) => {
      if (!user_id.value) return

      try {
        const tutorName = await getTutorName(user_id.value)
        
        const notificationData = {
          student_id: user_id.value,
          homework_id: parseInt(homeworkId.value),
          subject: `${subject.value}_${examType.value}`,
          completed_at: new Date().toISOString(),
          score: score,
          is_read: false,
          tutor_name: tutorName
        }

        const { error } = await supabase
          .from('homework_notifications')
          .upsert(notificationData, {
            onConflict: 'tutor_name,student_id,homework_id'
          })

        if (error) throw error
      } catch (err) {
        console.error('Ошибка создания уведомления:', err)
      }
    }

    const urlParams = getUrlParams()
    subject.value = urlParams.subject
    examType.value = urlParams.exam_type
    homeworkId.value = urlParams.homework_id

    homeworkData.value = {
      homework_name: urlParams.homework_name || '',
      lesson_number: urlParams.lesson_number || '',
      lesson_name: urlParams.lesson_name || '',
      deadline: null
    }

    const getCurrentUserId = async () => {
      if (urlParams.view_mode === 'tutor' && urlParams.student_id) {
        return urlParams.student_id
      }
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) return null
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    const isViewMode = computed(() => urlParams.view_mode === 'tutor')
    const isTutorMode = computed(() => urlParams.view_mode === 'tutor')

    const loadStudentInfo = async () => {
      if (!user_id.value || !isTutorMode.value) return
      
      try {
        const { data, error } = await supabase
          .from('students')
          .select('first_name, last_name')
          .eq('user_id', user_id.value)
          .single()

        if (error) {
          const { data: personalityData } = await supabase
            .from('personalities')
            .select('full_name')
            .eq('user_id', user_id.value)
            .single()
            
          if (personalityData) {
            studentInfo.value = { first_name: personalityData.full_name, last_name: '' }
          } else {
            studentInfo.value = { first_name: 'Не указано', last_name: '' }
          }
        } else {
          studentInfo.value = data
        }
      } catch (err) {
        console.error('Ошибка при загрузке информации о студенте:', err)
        studentInfo.value = { first_name: 'Ошибка загрузки', last_name: '' }
      }
    }

    const getTableNames = () => {
      if (!subject.value || !examType.value) {
        throw new Error('Не указаны subject и exam_type')
      }
      const baseTable = `${subject.value}_${examType.value}`
      return {
        homeworkList: `${baseTable}_homework_list`,
        homeworkTasks: `${baseTable}_homework_tasks`,
        taskBank: `${baseTable}_task_bank`,
        progress: `${baseTable}_progress`,
        homeworkCompleted: `${baseTable}_homework_completed`
      }
    }

    async function redirectToMenu() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          window.location.href = '/login.html'
          return
        }

        const { data: personalityData, error: personalityError } = await supabase
          .from('personalities')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (personalityError) throw personalityError
        if (!personalityData) {
          alert('Профиль пользователя не найден')
          return
        }

        switch(personalityData.role) {
          case 'student': window.location.href = '/student_menu.html'; break
          case 'teacher': window.location.href = '/teacher_menu.html'; break
          case 'tutor': window.location.href = '/tutor_menu.html'; break
          default: alert('Неизвестная роль пользователя')
        }
      } catch (err) {
        console.error('Ошибка при перенаправлении:', err)
        alert('Произошла ошибка при переходе на главную')
      }
    }

    const sanitizeHtml = (html) => {
      if (!html) return ''
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span', 'table', 'tr', 'td', 'th', 'tbody', 'thead'],
        ALLOWED_ATTR: ['style', 'class', 'colspan', 'rowspan']
      })
    }

    const formatTextWithParagraphs = (text) => {
      if (!text) return ''
      const hasComplexHTML = /<(?!\/?(sub|sup|br|strong|em|p)\b)[^>]+>/i.test(text)
      if (hasComplexHTML) return text
      
      let formattedText = text
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
      
      if (!formattedText.startsWith('<p>') && !formattedText.includes('</p>')) {
        formattedText = `<p>${formattedText}</p>`
      }
      return formattedText
    }

    const formatAnswerText = (text) => {
      if (!text) return ''
      let formattedText = String(text)
      formattedText = formattedText.replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>')
      formattedText = formattedText.replace(/(\w)\^(\d+)/g, '$1<sup>$2</sup>')
      formattedText = formattedText.replace(/\[sub\](.*?)\[\/sub\]/g, '<sub>$1</sub>')
      formattedText = formattedText.replace(/\[sup\](.*?)\[\/sup\]/g, '<sup>$1</sup>')
      formattedText = formattedText.replace(/\n/g, '<br>')
      return formattedText
    }

    const getTaskTextWithoutTables = (task) => {
      if (!task.text) return ''
      if (task.has_table && task.table_data) {
        return formatTextWithParagraphs(task.text.replace(/<table[\s\S]*?<\/table>/gi, ''))
      }
      return formatTextWithParagraphs(task.text)
    }

const getImageUrl = (imagePath) => {
  if (!imagePath) return ''
  
  let path = String(imagePath)
  
  // Если это уже полный URL
  if (path.startsWith('http')) {
    // Если это старый URL Supabase, конвертируем в новый формат через прокси
    if (path.includes('supabase.co')) {
      const match = path.match(/\/storage\/v1\/object\/public\/task-images\/(.+)$/)
      if (match) {
        return `${PROXY_CONFIG.baseUrl}/task-images/${match[1]}`
      }
    }
    return path
  }
  
  // Очищаем путь от возможных префиксов
  let cleanPath = path
  
  // Убираем task-images/ если есть
  if (cleanPath.startsWith('task-images/')) {
    cleanPath = cleanPath.replace('task-images/', '')
  }
  
  // Если путь начинается с tasks/, оставляем как есть
  // Иначе добавляем tasks/ (для обратной совместимости)
  if (!cleanPath.startsWith('tasks/')) {
    cleanPath = `tasks/${cleanPath}`
  }
  
  // Если прокси включен, используем его
  if (PROXY_CONFIG.enabled) {
    return `${PROXY_CONFIG.baseUrl}/task-images/${cleanPath}`
  }
  
  // Fallback: прямой URL из Supabase
  try {
    const { data: { publicUrl } } = supabase
      .storage
      .from('task-images')
      .getPublicUrl(cleanPath)
    return publicUrl
  } catch (err) {
    console.error('Ошибка получения URL изображения:', err)
    return ''
  }
}

const getAnswerImageUrl = (imagePath) => {
  if (!imagePath) return ''
  
  let path = String(imagePath)
  
  if (path.startsWith('http')) {
    if (path.includes('supabase.co')) {
      const match = path.match(/\/storage\/v1\/object\/public\/answers\/(.+)$/)
      if (match) {
        return `${PROXY_CONFIG.baseUrl}/answers/${match[1]}`
      }
    }
    return path
  }
  
  let cleanPath = path
  if (cleanPath.startsWith('answers/')) {
    cleanPath = cleanPath.replace('answers/', '')
  }
  
  // Если путь не начинается с tasks/, добавляем (для обратной совместимости)
  if (!cleanPath.startsWith('tasks/')) {
    cleanPath = `tasks/${cleanPath}`
  }
  
  if (PROXY_CONFIG.enabled) {
    return `${PROXY_CONFIG.baseUrl}/answers/${cleanPath}`
  }
  
  try {
    const { data: { publicUrl } } = supabase
      .storage
      .from('answers')
      .getPublicUrl(cleanPath)
    return publicUrl
  } catch (err) {
    console.error('Ошибка получения URL изображения ответа:', err)
    return ''
  }
}

    const getExplanationContent = (task) => {
      let content = ''
      if (task.explanation) {
        content += formatTextWithParagraphs(task.explanation)
      }
      
      if (task.image_explanation && Array.isArray(task.image_explanation)) {
        task.image_explanation.forEach(imagePath => {
          if (typeof imagePath === 'string') {
            const imageUrl = getImageUrl(imagePath)
            content += `<div class="explanation-image-container">
              <img src="${imageUrl}" alt="Пояснение к заданию" class="explanation-image">
            </div>`
          }
        })
      } else if (typeof task.image_explanation === 'string') {
        const imageUrl = getImageUrl(task.image_explanation)
        content += `<div class="explanation-image-container">
          <img src="${imageUrl}" alt="Пояснение к заданию" class="explanation-image">
        </div>`
      }
      return content
    }

    const uploadAnswerImage = async (task, file) => {
      if (!user_id.value) return null
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user_id.value}/${task.task_id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase
          .storage
          .from('answers')
          .upload(fileName, file)

        if (uploadError) throw uploadError
        return fileName
      } catch (err) {
        console.error('Ошибка загрузки изображения:', err)
        error.value = 'Ошибка загрузки изображения: ' + err.message
        return null
      }
    }

    const deleteAnswerImage = async (imagePath) => {
      try {
        const { error: deleteError } = await supabase
          .storage
          .from('answers')
          .remove([imagePath])
        if (deleteError) throw deleteError
      } catch (err) {
        console.error('Ошибка удаления изображения:', err)
      }
    }

    const startEdit = (task) => {
      task.isEditing = true
      task.editAnswerInput = task.userAnswer || ''
      nextTick(() => {
        const input = document.querySelector(`.task-item[data-task-id="${task.task_id}"] .answer-input, .task-item[data-task-id="${task.task_id}"] .answer-textarea`)
        if (input) {
          input.focus()
          input.select()
        }
      })
    }

    const cancelEdit = (task) => {
      task.isEditing = false
      task.editAnswerInput = ''
    }

    const saveEditedAnswer = async (task) => {
      if (!task.editAnswerInput.trim() && (!task.answerImages || task.answerImages.length === 0)) {
        alert('Пожалуйста, введите ответ или прикрепите изображение')
        return
      }
      try {
        task.saving = true
        const userAnswer = task.editAnswerInput.trim()
        task.userAnswer = userAnswer 
        task.userAnswerInput = userAnswer
        task.isEditing = false
        
        await saveTaskProgress(task, false)
        task.saving = false
      } catch (err) {
        console.error('Ошибка сохранения отредактированного ответа:', err)
        task.saving = false
        error.value = 'Ошибка при сохранении ответа: ' + err.message
      }
    }

    const saveAnswer = async (task) => {
      if (!task.userAnswerInput.trim() && (!task.answerImages || task.answerImages.length === 0)) {
        alert('Пожалуйста, введите ответ или прикрепите изображение')
        return
      }
      try {
        task.saving = true
        const userAnswer = task.userAnswerInput.trim()
        task.userAnswer = userAnswer
        
        await saveTaskProgress(task, false)
        
        task.answerSaved = true
        setTimeout(() => {
          task.answerSaved = false
        }, 3000)
        task.saving = false
      } catch (err) {
        console.error('Ошибка сохранения ответа:', err)
        task.saving = false
        error.value = 'Ошибка при сохранении ответа: ' + err.message
      }
    }

    const saveTaskProgress = async (task, checkCorrectness = false) => {
      if (!user_id.value) return

      let score = 0
      let is_completed = false
      let counted_in_rating = false

      if (checkCorrectness) {
        const result = checkAnswerComponent(
          task.userAnswer,
          task.answer,
          task.points,
          subject.value,
          task.exam_task_number
        )
        score = result.score
        is_completed = result.isCorrect || result.isPartiallyCorrect
        counted_in_rating = result.isCorrect
        task.isCorrect = result.isCorrect
        task.isPartiallyCorrect = result.isPartiallyCorrect
        task.awardedPoints = score
      }

      try {
        const tableNames = getTableNames()
        const now = new Date().toISOString()
        
        const progressData = {
          user_id: user_id.value,
          task_id: task.task_id,
          is_completed: is_completed,
          score: score,
          user_answer: task.userAnswer || '',
          answer_images: task.answerImages || [],
          last_updated: now,
          counted_in_rating: counted_in_rating
        }

        const { error: progressError } = await supabase
          .from(tableNames.progress)
          .upsert(progressData, {
            onConflict: 'user_id,task_id'
          })

        if (progressError) throw progressError

        const mlTableName = `ml_${subject.value}_${examType.value}`
        const { data: taskData, error: taskError } = await supabase
          .from(tableNames.taskBank)
          .select('number, section, topic, difficulty, points')
          .eq('id', task.task_id)
          .single()

        if (!taskError && taskData) {
          const mlData = {
            user_id: user_id.value,
            task_id: task.task_id,
            number: taskData.number,
            section: taskData.section,
            topic: taskData.topic,
            difficulty: taskData.difficulty,
            max_score: taskData.points,
            is_correct: counted_in_rating,
            score: score,
            created_at: now
          }

          const { error: mlError } = await supabase
            .from(mlTableName)
            .insert([mlData])
            
          if (mlError) {
            console.error('Ошибка сохранения в ML таблицу:', mlError)
          }
        }
      } catch (err) {
        console.error('Ошибка сохранения прогресса:', err)
        throw err
      }
    }

    const setTutorScore = async (task, manualScore) => {
      if (!isTutorMode.value || !user_id.value) return
      
      try {
        task.saving = true
        task.awardedPoints = manualScore
        task.isCorrect = manualScore === task.points
        task.isPartiallyCorrect = manualScore > 0 && manualScore < task.points
        
        const counted_in_rating = manualScore === task.points
        const now = new Date().toISOString()
        const tableNames = getTableNames()
        
        const { error: progressError } = await supabase
          .from(tableNames.progress)
          .upsert({
            user_id: user_id.value,
            task_id: task.task_id,
            is_completed: manualScore > 0,
            score: manualScore,
            user_answer: task.userAnswer || '',
            answer_images: task.answerImages || [],
            last_updated: now,
            counted_in_rating: counted_in_rating
          }, {
            onConflict: 'user_id,task_id'
          })

        if (progressError) throw progressError
        
        const mlTableName = `ml_${subject.value}_${examType.value}`
        const { data: taskData, error: taskError } = await supabase
          .from(tableNames.taskBank)
          .select('number, section, topic, difficulty, points')
          .eq('id', task.task_id)
          .single()

        if (!taskError && taskData) {
          const mlData = {
            user_id: user_id.value,
            task_id: task.task_id,
            number: taskData.number,
            section: taskData.section,
            topic: taskData.topic,
            difficulty: taskData.difficulty,
            max_score: taskData.points,
            is_correct: counted_in_rating,
            score: manualScore,
            created_at: now
          }

          const { error: mlError } = await supabase.from(mlTableName).insert([mlData])
          if (mlError) console.error('Ошибка сохранения в ML таблицу (куратор):', mlError)
        }
        
        await updateHomeworkCompletedOnly()
      } catch (err) {
        console.error('Ошибка сохранения баллов куратора:', err)
        error.value = 'Ошибка при сохранении баллов: ' + err.message
      } finally {
        task.saving = false
      }
    }

    const updateHomeworkCompletedOnly = async () => {
      if (!user_id.value) return
      const newTotalScore = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
      try {
        const tableNames = getTableNames()
        const { error } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert({
            homework_id: parseInt(homeworkId.value),
            user_id: user_id.value,
            is_completed: true,
            score: newTotalScore,
            completed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,homework_id'
          })
        if (error) throw error
        totalScore.value = newTotalScore
      } catch (err) {
        console.error('Ошибка обновления общего балла:', err)
      }
    }

    const updateHomeworkTotalScore = async () => {
      if (!user_id.value) return
      const newTotalScore = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
      try {
        const tableNames = getTableNames()
        const { error } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert({
            homework_id: parseInt(homeworkId.value),
            user_id: user_id.value,
            is_completed: true,
            score: newTotalScore,
            completed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,homework_id'
          })

        if (error) throw error
        if (!isTutorMode.value) {
          await createHomeworkNotification(newTotalScore)
        }
        totalScore.value = newTotalScore
      } catch (err) {
        console.error('Ошибка обновления общего балла:', err)
      }
    }

    const completeHomework = async () => {
      try {
        error.value = null
        updateTotalScore()

        for (const task of tasks.value) {
          if (task.userAnswer || (task.answerImages && task.answerImages.length > 0)) {
            await saveTaskProgress(task, true)
          }
        }

        updateTotalScore()
        const tableNames = getTableNames()
        
        const completionData = {
          homework_id: parseInt(homeworkId.value),
          user_id: user_id.value,
          is_completed: true,
          score: totalScore.value,
          completed_at: new Date().toISOString()
        }

        const { error: completionError } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert(completionData, {
            onConflict: 'user_id,homework_id'
          })

        if (completionError) throw new Error(completionError.message)

        if (!isTutorMode.value) {
          await createHomeworkNotification(totalScore.value)
        }

        isCompleted.value = true
        showAnswers.value = true
        alert('Домашнее задание завершено! Набрано баллов: ' + totalScore.value + '/' + maxScore.value)

      } catch (err) {
        error.value = err.message
        console.error('Полная ошибка завершения домашнего задания:', err)
        alert('Ошибка: ' + err.message)
      }
    }

    const migrateOldImagePaths = () => {
      tasks.value = tasks.value.map(task => {
        if (task.answerImages && Array.isArray(task.answerImages)) {
          task.answerImages = task.answerImages.map(img => extractPathFromUrl(img))
        }
        if (task.images && Array.isArray(task.images)) {
          task.images = task.images.map(img => extractPathFromUrl(img))
        }
        if (task.image_explanation) {
          if (Array.isArray(task.image_explanation)) {
            task.image_explanation = task.image_explanation.map(img => extractPathFromUrl(img))
          } else if (typeof task.image_explanation === 'string') {
            task.image_explanation = extractPathFromUrl(task.image_explanation)
          }
        }
        return task
      })
    }

    const fetchHomeworkTasks = async () => {
      try {
        loading.value = true
        error.value = null
        user_id.value = await getCurrentUserId()

        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        if (!subject.value || !examType.value || !homeworkId.value) {
          throw new Error('Не указаны параметры домашнего задания (subject, exam_type, homework_id)')
        }

        const tableNames = getTableNames()
        
        const { data: homeworkInfo, error: homeworkInfoError } = await supabase
          .from(tableNames.homeworkList)
          .select('deadline, homework_name, lesson_number, lesson_name')
          .eq('homework_id', homeworkId.value)
          .single()

        if (!homeworkInfoError && homeworkInfo) {
          homeworkData.value = {
            ...homeworkData.value,
            deadline: homeworkInfo.deadline,
            homework_name: homeworkInfo.homework_name || homeworkData.value.homework_name,
            lesson_number: homeworkInfo.lesson_number || homeworkData.value.lesson_number,
            lesson_name: homeworkInfo.lesson_name || homeworkData.value.lesson_name
          }
        }

        const { data: homeworkTasks, error: homeworkError } = await supabase
          .from(tableNames.homeworkTasks)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .order('number', { ascending: true })

        if (homeworkError) throw new Error('Не удалось загрузить задания: ' + homeworkError.message)
        if (!homeworkTasks || homeworkTasks.length === 0) throw new Error('Задания для этого домашнего задания не найдены')

        const taskIds = homeworkTasks.map(task => task.task_id)
        const { data: taskDetails, error: taskError } = await supabase
          .from(tableNames.taskBank)
          .select('*')
          .in('id', taskIds)

        if (taskError) throw new Error('Не удалось загрузить детали заданий: ' + taskError.message)

        tasks.value = homeworkTasks.map(homeworkTask => {
          const taskDetail = taskDetails.find(t => t.id === homeworkTask.task_id)
          return {
            ...homeworkTask,
            ...taskDetail,
            number: homeworkTask.number, 
            exam_task_number: taskDetail.number,
            userAnswerInput: '',
            userAnswer: null,
            answerImages: [],
            answerSaved: false, 
            isCorrect: false,
            isPartiallyCorrect: false,
            awardedPoints: 0,
            saving: false,
            isEditing: false,
            editAnswerInput: '',
            manualScore: 0,
            uploadingImages: false,
            showExplanation: false
          }
        })

        await loadTasksProgress()
        migrateOldImagePaths()
        await checkHomeworkCompletion()

        if (isTutorMode.value) {
          await loadStudentInfo()
        }

        if (showAnswers.value) {
          nextTick(() => bindExplanationImageHandlers())
        }
      } catch (err) {
        error.value = err.message
        console.error('Ошибка загрузки заданий:', err)
      } finally {
        loading.value = false
      }
    }

    const loadTasksProgress = async () => {
      if (!user_id.value) return
      try {
        const tableNames = getTableNames()
        const taskIds = tasks.value.map(task => task.task_id)
        
        const { data: progressData, error: progressError } = await supabase
          .from(tableNames.progress)
          .select('*')
          .eq('user_id', user_id.value)
          .in('task_id', taskIds)

        if (progressError) {
          console.error('Ошибка загрузки прогресса:', progressError)
          return
        }

        const { data: completionData } = await supabase
          .from(tableNames.homeworkCompleted)
          .select('is_completed')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        showAnswers.value = completionData?.is_completed || isTutorMode.value

        tasks.value = tasks.value.map(task => {
          const progress = progressData?.find(p => p.task_id === task.task_id)
          if (progress) {
            return {
              ...task,
              userAnswer: progress.user_answer,
              answerImages: progress.answer_images || [],
              isCorrect: showAnswers.value ? progress.score === task.points : false,
              isPartiallyCorrect: showAnswers.value ? (progress.score > 0 && progress.score < task.points) : false,
              awardedPoints: showAnswers.value ? progress.score : 0,
              manualScore: progress.score || 0
            }
          }
          return task
        })
      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err)
      }
    }

    const checkHomeworkCompletion = async () => {
      if (!user_id.value) return
      try {
        const tableNames = getTableNames()
        const { data: completionData, error: completionError } = await supabase
          .from(tableNames.homeworkCompleted)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        if (completionError && completionError.code !== 'PGRST116') {
          console.error('Ошибка проверки статуса выполнения:', completionError)
          return
        }

        if (completionData) {
          isCompleted.value = completionData.is_completed
          totalScore.value = completionData.score || 0
          showAnswers.value = completionData.is_completed || isTutorMode.value
        }
      } catch (err) {
        console.error('Ошибка проверки статуса выполнения:', err)
      }
    }

    const handleImageUpload = async (task, event) => {
      const files = event.target.files
      if (!files || files.length === 0) return

      try {
        task.uploadingImages = true
        const newImages = []

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, загружайте только изображения')
            continue
          }
          if (file.size > 25 * 1024 * 1024) {
            alert('Размер файла не должен превышать 25MB')
            continue
          }
          const imagePath = await uploadAnswerImage(task, file)
          if (imagePath) newImages.push(imagePath)
        }

        if (newImages.length > 0) {
          task.answerImages = [...(task.answerImages || []), ...newImages]
          task.userAnswerInput = ''
          task.userAnswer = ''
          task.answerSaved = true
          await saveTaskProgress(task, false)
          setTimeout(() => task.answerSaved = false, 3000)
        }
      } catch (err) {
        console.error('Ошибка загрузки изображений:', err)
        error.value = 'Ошибка при загрузке изображений: ' + err.message
      } finally {
        task.uploadingImages = false
        event.target.value = ''
      }
    }

    const bindExplanationImageHandlers = () => {
      const explanationImages = document.querySelectorAll('.explanation-image')
      explanationImages.forEach(img => {
        img.onclick = null
        img.onclick = () => openImageModal(img.src)
      })
    }

    const toggleExplanation = (task) => {
      task.showExplanation = !task.showExplanation
      if (task.showExplanation) {
        nextTick(() => bindExplanationImageHandlers())
      }
    }

    const removeAnswerImage = async (task, imageIndex) => {
      try {
        const imageToRemove = task.answerImages[imageIndex]
        await deleteAnswerImage(imageToRemove)
        task.answerImages.splice(imageIndex, 1)
        await saveTaskProgress(task, false)
      } catch (err) {
        console.error('Ошибка удаления изображения:', err)
        error.value = 'Ошибка при удалении изображения: ' + err.message
      }
    }

    const openImageModal = (imageUrl) => {
      selectedImage.value = imageUrl
      showImageModal.value = true
      document.body.style.overflow = 'hidden'
    }

    const closeImageModal = () => {
      showImageModal.value = false
      document.body.style.overflow = ''
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'Не указан'
      try {
        return new Date(dateString).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      } catch (err) {
        return 'Неверный формат даты'
      }
    }

    const updateTotalScore = () => {
      totalScore.value = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
    }
    
    const completionPercent = computed(() => {
      if (maxScore.value === 0) return 0
      return Math.round((totalScore.value / maxScore.value) * 100)
    })

    const studentFullName = computed(() => {
      if (!studentInfo.value) return 'Загрузка...'
      const { first_name = '', last_name = '' } = studentInfo.value
      return `${last_name} ${first_name}`.trim() || 'Не указано'
    })

    const deadlineStatus = computed(() => {
      const deadline = homeworkData.value.deadline
      if (!deadline) return 'no-deadline'
      try {
        const deadlineDate = new Date(deadline)
        const today = new Date()
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
        if (deadlineDateOnly < todayDate) return 'overdue'
        if (deadlineDateOnly.getTime() === todayDate.getTime()) return 'today'
        return 'future'
      } catch (err) {
        return 'no-deadline'
      }
    })

    const sortedTasks = computed(() => [...tasks.value].sort((a, b) => a.number - b.number))
    const hasAnswers = computed(() => tasks.value.some(task => task.userAnswer || (task.answerImages && task.answerImages.length > 0)))
    const maxScore = computed(() => tasks.value.reduce((sum, task) => sum + (task.points || 0), 0))

    const getTaskStatusClass = (task) => {
      if (!task.userAnswer && (!task.answerImages || task.answerImages.length === 0)) return 'status-not-completed'
      if (!showAnswers.value) return 'status-saved'
      if (task.isCorrect) return 'status-correct'
      if (task.isPartiallyCorrect) return 'status-partial'
      return 'status-incorrect'
    }

    const getTaskStatusText = (task) => {
      if (!task.userAnswer && (!task.answerImages || task.answerImages.length === 0)) return 'Не решено'
      if (!showAnswers.value) return 'Ответ сохранен'
      if (task.isCorrect) return `✓ Верно (${task.awardedPoints}/${task.points} балла)`
      if (task.isPartiallyCorrect) return `± Частично (${task.awardedPoints}/${task.points} балла)`
      return `✗ Неверно (0/${task.points} балла)`
    }

    const getFeedbackClass = (task) => {
      if (task.isCorrect) return 'correct-feedback'
      if (task.isPartiallyCorrect) return 'partial-feedback'
      return 'incorrect-feedback'
    }

    const getFeedbackText = (task) => {
      return ''
    }

    const isSecondPartTask = (task) => task.part === 'Вторая часть'

    const getDisplaySubjectName = computed(() => {
      const subjectNames = { 'chemistry': 'Химия', 'biology': 'Биология' }
      const examTypeNames = { 'ege': 'ЕГЭ', 'oge': 'ОГЭ' }
      const subjectName = subjectNames[subject.value] || subject.value
      const examTypeName = examTypeNames[examType.value] || examType.value
      return `${subjectName} ${examTypeName}`
    })

    onMounted(() => {
      if (subject.value && examType.value && homeworkId.value) {
        fetchHomeworkTasks()
      } else {
        error.value = 'Не указаны параметры домашнего задания (subject, exam_type, homework_id)'
        loading.value = false
      }

      document.addEventListener('contextmenu', (e) => {
        const target = e.target
        if (target && typeof target.closest === 'function' && target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
      
      document.addEventListener('selectstart', (e) => {
        const target = e.target
        if (target && typeof target.closest === 'function' && target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
    })

    watch(() => tasks.value.map(t => t.awardedPoints), () => {
      updateTotalScore()
    }, { deep: true })

    watch(showAnswers, (newVal) => {
      if (newVal) {
        nextTick(() => bindExplanationImageHandlers())
      }
    })

    return {
      homeworkName: homeworkData.value.homework_name,
      homeworkData,
      sortedTasks,
      loading,
      error,
      isCompleted,
      totalScore,
      maxScore,
      showImageModal,
      selectedImage,
      showAnswers,
      sanitizeHtml,
      formatTextWithParagraphs,
      formatAnswerText,
      getImageUrl,
      getAnswerImageUrl,
      getTaskTextWithoutTables,
      getExplanationContent,
      saveAnswer,
      completeHomework,
      formatDate,
      deadlineStatus,
      getTaskStatusClass,
      getTaskStatusText,
      getFeedbackClass,
      getFeedbackText,
      openImageModal,
      closeImageModal,
      hasAnswers,
      redirectToMenu, 
      isViewMode,
      isTutorMode,
      startEdit,
      cancelEdit,
      saveEditedAnswer,
      setTutorScore,
      updateHomeworkTotalScore,
      handleImageUpload,
      removeAnswerImage,
      isSecondPartTask,
      toggleExplanation,
      getDisplaySubjectName,
      completionPercent,
      studentFullName,
      loadStudentInfo,
      updateHomeworkCompletedOnly
    }
  }
}
</script>

<style scoped>
/* ============================================ */
/* БАЗОВЫЕ СТИЛИ */
/* ============================================ */

.homework-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.homework-header {
  margin-bottom: 24px;
  text-align: center;
}

.homework-header h1 {
  color: #333;
  font-size: 2rem;
  margin-bottom: 8px;
  line-height: 1.2;
}

.homework-meta {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.lesson-info {
  color: #666;
  font-size: 1rem;
}

.deadline {
  padding: 4px 12px;
  border-radius: 16px;
  font-weight: 500;
  font-size: 0.9rem;
}

.deadline.overdue {
  background-color: #ffebee;
  color: #d32f2f;
}

.deadline.today {
  background-color: #fff3e0;
  color: #f57c00;
}

.deadline.future {
  background-color: #e8f5e8;
  color: #388e3c;
}

.deadline.no-deadline {
  background-color: #f5f5f5;
  color: #757575;
}

.tutor-mode-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  margin: 8px 0;
  font-weight: bold;
  text-align: center;
}

/* ===== ЗАДАНИЯ ===== */
.tasks-container {
  margin-bottom: 24px;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-item {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 100%;
}

.extended-task {
  border-left: 4px solid #b241d1;
}

.extended-task .task-header {
  background-color: rgba(178, 65, 209, 0.05);
  padding: 16px;
  margin: -20px -20px 16px -20px;
  border-radius: 12px 12px 0 0;
}

.extended-task .task-id {
  color: #b241d1;
  font-weight: bold;
}

.task-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.task-meta {
  flex: 1;
  min-width: 0;
}

.task-topic {
  font-weight: 500;
  color: #333;
  font-size: 1.1rem;
  display: block;
  line-height: 1.4;
  word-wrap: break-word;
}

.task-id {
  color: #888;
  font-size: 0.9rem;
  font-weight: bold;
  display: block;
  margin-top: 4px;
}

.task-part-badge {
  background: #b241d1;
  color: white;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 8px;
  display: inline-block;
}

.task-status {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-not-completed {
  background: #f5f5f5;
  color: #666;
}

.status-saved {
  background: #e3f2fd;
  color: #1565c0;
}

.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-partial {
  background: #fff3e0;
  color: #ff8f00;
}

.status-incorrect {
  background: #ffebee;
  color: #c62828;
}

/* ===== ТЕКСТ ЗАДАНИЯ ===== */
.task-content {
  margin-bottom: 16px;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 16px;
  font-size: 1rem;
  width: 100%;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
  position: relative;
}

.task-text ::selection {
  background: transparent;
}

.task-text ::-moz-selection {
  background: transparent;
}

.task-text :deep(sub),
.task-text :deep(sup) {
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-text :deep(sub) {
  bottom: -0.25em;
}

.task-text :deep(sup) {
  top: -0.5em;
}

.task-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.task-text :deep(table td) {
  padding: 8px;
  border: 1px solid #ddd;
  vertical-align: top;
}

.task-text :deep(strong) {
  font-weight: 600;
}

.task-text :deep(em) {
  font-style: italic;
}

/* ===== ТАБЛИЦЫ ===== */
.task-table-container {
  margin: 16px 0;
  overflow-x: auto;
  width: 100%;
}

.task-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  min-width: 300px;
}

.task-table-container table.with-borders {
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td {
  border: 1px solid #ddd;
  padding: 8px;
}

.task-table-container td {
  padding: 8px;
  vertical-align: top;
  font-size: 0.95rem;
}

.task-table-container :deep(sub),
.task-table-container :deep(sup) {
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-table-container :deep(sub) {
  bottom: -0.25em;
}

.task-table-container :deep(sup) {
  top: -0.5em;
}

.task-table-container :deep(p) {
  margin: 0;
  padding: 0;
}

.task-table-container :deep(strong) {
  font-weight: 600;
}

/* ===== ИЗОБРАЖЕНИЯ ===== */
.task-images {
  margin-bottom: 16px;
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid #eee;
  background: #f8f9fa;
  cursor: pointer;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.task-image:hover {
  transform: scale(1.03);
}

/* ===== ОТВЕТЫ ===== */
.answer-section {
  margin-top: 16px;
  width: 100%;
}

.answer-input-container {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  width: 100%;
  flex-wrap: wrap;
}

.answer-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 200px;
}

.answer-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.answer-textarea {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  min-width: 200px;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
  width: 100%;
}

.answer-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.answer-textarea.extended {
  min-height: 120px;
}

.submit-button {
  padding: 10px 20px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
  white-space: nowrap;
}

.submit-button:hover {
  background-color: #9a36b8;
}

.cancel-button {
  padding: 10px 20px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
  white-space: nowrap;
}

.cancel-button:hover {
  background-color: #5a6268;
}

/* ===== ФИДБЕК ===== */
.answer-feedback {
  padding: 12px;
  border-radius: 6px;
  font-weight: 500;
  margin-top: 10px;
  font-size: 1rem;
  width: 100%;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.correct-icon,
.partial-icon,
.incorrect-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.correct-icon {
  color: #2e7d32;
}

.partial-icon {
  color: #ff8f00;
}

.incorrect-icon {
  color: #c62828;
}

.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}

.correct-answer-text {
  width: 100%;
}

.current-score {
  font-weight: 600;
  color: #4a5568;
}

/* ===== ОТВЕТ СОХРАНЕН ===== */
.answer-saved {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background-color: #e8f5e9;
  border-radius: 6px;
  border-left: 4px solid #28a745;
  flex-direction: column;
  transition: all 0.3s ease;
}

.saved-icon {
  font-size: 1.2rem;
}

.user-answer-container {
  width: 100%;
}

.user-answer-text {
  margin-left: 4px;
  color: #155724;
}

.user-answer-text.multiline {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  border-left: 3px solid #b241d1;
  margin: 6px 0;
  line-height: 1.5;
  font-family: inherit;
}

.edit-answer-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  font-size: 1.1rem;
  transition: background-color 0.2s;
}

.edit-answer-btn:hover {
  background-color: rgba(178, 65, 209, 0.1);
}

.saving-status {
  color: #6c757d;
  font-style: italic;
  margin-top: 6px;
}

/* ===== ИЗОБРАЖЕНИЯ ОТВЕТОВ ===== */
.image-upload-section {
  margin: 12px 0;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px dashed #dee2e6;
}

.upload-label {
  display: inline-block;
  background: #b241d1;
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 10px;
}

.upload-label:hover {
  background: #9a36b8;
}

.file-input {
  display: none;
}

.uploading-text {
  color: #6c757d;
  font-style: italic;
  margin-top: 6px;
}

.upload-status-uploading {
  background-color: #fff3cd;
  color: #856404;
  padding: 8px;
  border-radius: 4px;
  margin: 6px 0;
  border: 1px solid #ffeaa7;
}

.upload-status-success {
  background-color: #d4edda;
  color: #155724;
  padding: 8px;
  border-radius: 4px;
  margin: 6px 0;
  border: 1px solid #c3e6cb;
}

.answer-images-preview {
  margin-top: 12px;
}

.images-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.image-item {
  position: relative;
  display: inline-block;
}

.answer-image {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.answer-image:hover {
  transform: scale(1.05);
}

.remove-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.remove-image-btn:hover {
  background: #c82333;
}

.save-images-btn {
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-images-btn:hover {
  background-color: #218838;
}

/* ===== ПОЯСНЕНИЕ ===== */
.explanation-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #b241d1;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  font-size: 1.05rem;
}

.explanation-toggle {
  font-size: 0.8rem;
  color: #b241d1;
}

.explanation-content-container {
  margin-top: 8px;
}

.explanation-content {
  line-height: 1.6;
  color: #444;
}

.explanation-content :deep(p) {
  margin-bottom: 10px;
}

.explanation-content :deep(p:last-child) {
  margin-bottom: 0;
}

.explanation-content :deep(br) {
  display: block;
  margin-bottom: 4px;
}

.explanation-content :deep(ul),
.explanation-content :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.explanation-content :deep(li) {
  margin-bottom: 4px;
}

.explanation-image-container {
  margin: 12px 0;
  text-align: center;
}

.explanation-image {
  max-width: 100%;
  height: auto;
  max-height: 300px;
  border-radius: 6px;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.explanation-image:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* ===== МОДАЛЬНОЕ ОКНО ===== */
.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: -20px;
  right: -20px;
  background: #b241d1;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

/* ===== КУРАТОР ===== */
.tutor-scoring-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(102, 126, 234, 0.1);
  border-radius: 6px;
  flex-wrap: wrap;
}

.score-label {
  font-weight: 600;
  color: #667eea;
}

.score-select {
  padding: 6px 12px;
  border: 1px solid #667eea;
  border-radius: 4px;
  background: white;
  color: #333;
}

.score-select:focus {
  outline: none;
  border-color: #5a67d8;
  box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.2);
}

.tutor-final-assessment {
  margin-top: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border-radius: 12px;
  text-align: center;
}

.tutor-final-assessment h3 {
  margin-bottom: 12px;
  font-size: 1.3rem;
}

.tutor-final-assessment .student-info {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  text-align: center;
  color: #333;
}

.tutor-final-assessment .student-info .student-name {
  font-size: 1.1rem;
  font-weight: 500;
}

.tutor-final-assessment .student-info strong {
  color: #667eea;
  margin-right: 4px;
}

.final-score {
  font-size: 1.4rem;
  font-weight: bold;
  margin: 12px 0;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
}

.completion-percent {
  font-size: 1rem;
  opacity: 0.9;
  margin-top: 4px;
}

.tutor-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.save-final-score-btn {
  padding: 10px 20px;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.save-final-score-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* ===== ЗАВЕРШЕНИЕ ===== */
.completion-section {
  margin-top: 24px;
  text-align: center;
  padding: 20px;
  border-top: 2px solid #eee;
  width: 100%;
}

.complete-btn {
  padding: 12px 32px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.05rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.complete-btn:hover {
  background-color: #218838;
}

.completion-result {
  margin-top: 24px;
  padding: 20px;
  background-color: #e8f5e9;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #28a745;
  width: 100%;
}

.completion-result h3 {
  color: #2e7d32;
  margin-bottom: 8px;
  font-size: 1.3rem;
}

.completion-result p {
  color: #388e3c;
  font-size: 1rem;
  font-weight: 500;
}

/* ===== ЗАГРУЗКА И ОШИБКИ ===== */
.loading {
  text-align: center;
  padding: 40px;
  font-size: 1.1rem;
  color: #666;
}

.error {
  color: #ff4757;
  padding: 16px;
  text-align: center;
  background: #ffe6e6;
  border-radius: 8px;
  border: 1px solid #ff4757;
}

/* ===== АНИМАЦИИ ===== */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

/* Планшеты и маленькие ноутбуки */
@media (max-width: 1024px) {
  .homework-content {
    padding: 20px;
  }
  
  .task-item {
    padding: 16px;
  }
  
  .extended-task .task-header {
    padding: 12px;
    margin: -16px -16px 12px -16px;
  }
}

/* Телефоны в портретной ориентации */
@media (max-width: 768px) {
  .homework-content {
    padding: 12px;
  }
  
  .homework-header h1 {
    font-size: 1.4rem;
  }
  
  .homework-meta {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .lesson-info {
    text-align: center;
    font-size: 0.9rem;
  }
  
  .deadline {
    text-align: center;
    font-size: 0.85rem;
  }
  
  .task-item {
    padding: 12px;
    border-radius: 8px;
    margin: 0 -6px;
    border-left: none;
    border-right: none;
  }
  
  .extended-task .task-header {
    padding: 10px;
    margin: -12px -12px 10px -12px;
    border-radius: 8px 8px 0 0;
  }
  
  .task-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .task-status {
    align-self: stretch;
    text-align: center;
  }
  
  .task-meta {
    width: 100%;
  }
  
  .task-topic {
    font-size: 0.95rem;
  }
  
  .task-id {
    font-size: 0.85rem;
  }
  
  .task-part-badge {
    font-size: 0.7rem;
    padding: 2px 8px;
  }
  
  .task-text {
    font-size: 0.95rem;
    line-height: 1.5;
  }
  
  .answer-input-container {
    flex-direction: column;
    gap: 8px;
  }
  
  .answer-input {
    font-size: 0.95rem;
    padding: 8px 12px;
    width: 100%;
    min-width: unset;
  }
  
  .answer-textarea {
    font-size: 0.95rem;
    padding: 8px 12px;
    min-height: 80px;
    min-width: unset;
  }
  
  .answer-textarea.extended {
    min-height: 120px;
  }
  
  .submit-button {
    font-size: 0.95rem;
    padding: 8px 16px;
    width: 100%;
    white-space: normal;
  }
  
  .cancel-button {
    font-size: 0.95rem;
    padding: 8px 16px;
    width: 100%;
    white-space: normal;
  }
  
  .answer-feedback {
    font-size: 0.95rem;
    padding: 10px;
  }
  
  .feedback-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .correct-icon,
  .partial-icon,
  .incorrect-icon {
    font-size: 1rem;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }
  
  .task-table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .task-table-container table {
    min-width: 400px;
    font-size: 0.9rem;
  }
  
  .task-table-container td {
    padding: 6px;
    font-size: 0.9rem;
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
  }
  
  .answer-image {
    height: 60px;
  }
  
  .answer-saved {
    flex-direction: column;
    align-items: flex-start;
    padding: 10px;
  }
  
  .user-answer-text {
    font-size: 0.9rem;
  }
  
  .user-answer-text.multiline {
    padding: 8px;
    font-size: 0.9rem;
  }
  
  .edit-answer-btn {
    margin-left: 0;
    margin-top: 6px;
  }
  
  .explanation-section {
    padding: 10px;
    margin-top: 12px;
  }
  
  .explanation-title {
    font-size: 0.95rem;
  }
  
  .explanation-content {
    font-size: 0.95rem;
  }
  
  .explanation-image {
    max-height: 200px;
  }
  
  .tutor-scoring-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 8px;
  }
  
  .score-select {
    width: 100%;
  }
  
  .current-score {
    margin-left: 0;
    margin-top: 4px;
    text-align: center;
  }
  
  .tutor-final-assessment {
    padding: 12px;
    margin-top: 16px;
  }
  
  .tutor-final-assessment h3 {
    font-size: 1.1rem;
  }
  
  .tutor-final-assessment .student-info {
    padding: 10px;
    font-size: 0.9rem;
  }
  
  .final-score {
    font-size: 1.2rem;
  }
  
  .completion-percent {
    font-size: 0.95rem;
  }
  
  .tutor-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .save-final-score-btn {
    padding: 8px 16px;
    width: 100%;
  }
  
  .completion-section {
    padding: 12px;
    margin-top: 16px;
  }
  
  .complete-btn {
    padding: 10px 20px;
    font-size: 0.95rem;
    width: 100%;
  }
  
  .completion-result {
    padding: 12px;
    margin-top: 16px;
  }
  
  .completion-result h3 {
    font-size: 1.1rem;
  }
  
  .completion-result p {
    font-size: 0.95rem;
  }
  
  .image-upload-section {
    padding: 10px;
    margin: 8px 0;
  }
  
  .upload-label {
    padding: 8px 14px;
    font-size: 0.9rem;
    width: 100%;
    text-align: center;
  }
  
  .remove-image-btn {
    width: 20px;
    height: 20px;
    font-size: 11px;
    top: -6px;
    right: -6px;
  }
  
  .close-modal {
    top: -14px;
    right: -14px;
    width: 32px;
    height: 32px;
    font-size: 1.2rem;
  }
}

/* Маленькие телефоны */
@media (max-width: 480px) {
  .homework-content {
    padding: 8px;
  }
  
  .homework-header h1 {
    font-size: 1.2rem;
  }
  
  .lesson-info {
    font-size: 0.8rem;
  }
  
  .deadline {
    font-size: 0.75rem;
    padding: 3px 8px;
  }
  
  .task-item {
    padding: 8px;
    border-radius: 4px;
  }
  
  .extended-task .task-header {
    padding: 6px;
    margin: -8px -8px 6px -8px;
  }
  
  .task-topic {
    font-size: 0.85rem;
  }
  
  .task-id {
    font-size: 0.75rem;
  }
  
  .task-text {
    font-size: 0.85rem;
  }
  
  .task-status {
    font-size: 0.7rem;
    padding: 3px 8px;
  }
  
  .answer-input {
    font-size: 0.85rem;
    padding: 6px 10px;
  }
  
  .answer-textarea {
    font-size: 0.85rem;
    padding: 6px 10px;
    min-height: 60px;
  }
  
  .answer-textarea.extended {
    min-height: 100px;
  }
  
  .submit-button {
    font-size: 0.85rem;
    padding: 6px 12px;
  }
  
  .cancel-button {
    font-size: 0.85rem;
    padding: 6px 12px;
  }
  
  .answer-feedback {
    font-size: 0.85rem;
    padding: 8px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 6px;
  }
  
  .answer-image {
    height: 50px;
  }
  
  .task-table-container table {
    min-width: 300px;
    font-size: 0.8rem;
  }
  
  .task-table-container td {
    padding: 4px;
    font-size: 0.8rem;
  }
  
  .explanation-section {
    padding: 8px;
  }
  
  .explanation-title {
    font-size: 0.85rem;
  }
  
  .explanation-content {
    font-size: 0.85rem;
  }
  
  .explanation-image {
    max-height: 150px;
  }
  
  .tutor-final-assessment {
    padding: 8px;
  }
  
  .final-score {
    font-size: 1rem;
  }
  
  .completion-percent {
    font-size: 0.85rem;
  }
  
  .complete-btn {
    font-size: 0.85rem;
    padding: 8px 16px;
  }
  
  .upload-label {
    font-size: 0.8rem;
    padding: 6px 12px;
  }
  
  .remove-image-btn {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }
  
  .close-modal {
    top: -10px;
    right: -10px;
    width: 28px;
    height: 28px;
    font-size: 1rem;
  }
}

/* Альбомная ориентация на телефонах */
@media (max-width: 768px) and (orientation: landscape) {
  .homework-content {
    padding: 12px;
  }
  
  .task-item {
    padding: 10px;
  }
  
  .answer-input-container {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .answer-input {
    flex: 1 1 60%;
    min-width: 150px;
  }
  
  .submit-button {
    flex: 1 1 30%;
    width: auto;
    min-width: 80px;
  }
  
  .cancel-button {
    flex: 1 1 30%;
    width: auto;
    min-width: 80px;
  }
  
  .answer-textarea {
    min-height: 60px;
  }
  
  .answer-textarea.extended {
    min-height: 80px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }
  
  .task-header {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .task-status {
    align-self: flex-start;
  }
}

/* Очень маленькие экраны (до 360px) */
@media (max-width: 360px) {
  .homework-content {
    padding: 4px;
  }
  
  .homework-header h1 {
    font-size: 1rem;
  }
  
  .task-item {
    padding: 6px;
    border-radius: 4px;
  }
  
  .task-topic {
    font-size: 0.8rem;
  }
  
  .task-text {
    font-size: 0.8rem;
  }
  
  .answer-input {
    font-size: 0.8rem;
    padding: 4px 8px;
  }
  
  .answer-textarea {
    font-size: 0.8rem;
    padding: 4px 8px;
    min-height: 50px;
  }
  
  .answer-textarea.extended {
    min-height: 70px;
  }
  
  .submit-button {
    font-size: 0.8rem;
    padding: 4px 8px;
  }
  
  .cancel-button {
    font-size: 0.8rem;
    padding: 4px 8px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 4px;
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 4px;
  }
  
  .answer-image {
    height: 40px;
  }
}
</style>

<style scoped>
/* ============================================ */
/* БАЗОВЫЕ СТИЛИ */
/* ============================================ */

.homework-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.homework-header {
  margin-bottom: 24px;
  text-align: center;
  width: 100%;
}

.homework-header h1 {
  color: #333;
  font-size: clamp(1.2rem, 4vw, 2rem);
  margin-bottom: 8px;
  line-height: 1.2;
  word-wrap: break-word;
}

.homework-meta {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.lesson-info {
  color: #666;
  font-size: clamp(0.8rem, 2vw, 1rem);
  word-wrap: break-word;
  text-align: center;
}

.deadline {
  padding: 4px 12px;
  border-radius: 16px;
  font-weight: 500;
  font-size: clamp(0.75rem, 1.8vw, 0.9rem);
  white-space: nowrap;
}

.deadline.overdue {
  background-color: #ffebee;
  color: #d32f2f;
}

.deadline.today {
  background-color: #fff3e0;
  color: #f57c00;
}

.deadline.future {
  background-color: #e8f5e8;
  color: #388e3c;
}

.deadline.no-deadline {
  background-color: #f5f5f5;
  color: #757575;
}

.tutor-mode-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  margin: 8px 0;
  font-weight: bold;
  text-align: center;
  font-size: clamp(0.85rem, 2vw, 1rem);
}

/* ===== ЗАДАНИЯ ===== */
.tasks-container {
  margin-bottom: 24px;
  width: 100%;
  overflow-x: hidden;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.task-item {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: clamp(12px, 2vw, 20px);
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.extended-task {
  border-left: 4px solid #b241d1;
}

.extended-task .task-header {
  background-color: rgba(178, 65, 209, 0.05);
  padding: clamp(10px, 1.5vw, 16px);
  margin: clamp(-12px, -2vw, -20px) clamp(-12px, -2vw, -20px) clamp(10px, 1.5vw, 16px) clamp(-12px, -2vw, -20px);
  border-radius: 12px 12px 0 0;
}

.extended-task .task-id {
  color: #b241d1;
  font-weight: bold;
}

.task-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.task-meta {
  flex: 1;
  min-width: 0;
}

.task-topic {
  font-weight: 500;
  color: #333;
  font-size: clamp(0.9rem, 2.5vw, 1.1rem);
  display: block;
  line-height: 1.4;
  word-wrap: break-word;
}

.task-id {
  color: #888;
  font-size: clamp(0.75rem, 2vw, 0.9rem);
  font-weight: bold;
  display: block;
  margin-top: 4px;
}

.task-part-badge {
  background: #b241d1;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: clamp(0.6rem, 1.5vw, 0.75rem);
  font-weight: bold;
  margin-left: 6px;
  display: inline-block;
}

.task-status {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: clamp(0.65rem, 1.5vw, 0.8rem);
  font-weight: bold;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-not-completed {
  background: #f5f5f5;
  color: #666;
}

.status-saved {
  background: #e3f2fd;
  color: #1565c0;
}

.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-partial {
  background: #fff3e0;
  color: #ff8f00;
}

.status-incorrect {
  background: #ffebee;
  color: #c62828;
}

/* ===== ТЕКСТ ЗАДАНИЯ ===== */
.task-content {
  margin-bottom: 12px;
  width: 100%;
  overflow-x: hidden;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 12px;
  font-size: clamp(0.85rem, 2vw, 1rem);
  width: 100%;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
  position: relative;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
}

.task-text ::selection {
  background: transparent;
}

.task-text ::-moz-selection {
  background: transparent;
}

.task-text :deep(sub),
.task-text :deep(sup) {
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-text :deep(sub) {
  bottom: -0.25em;
}

.task-text :deep(sup) {
  top: -0.5em;
}

.task-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  max-width: 100%;
}

.task-text :deep(table td) {
  padding: 8px;
  border: 1px solid #ddd;
  vertical-align: top;
  word-break: break-word;
}

.task-text :deep(strong) {
  font-weight: 600;
}

.task-text :deep(em) {
  font-style: italic;
}

/* ===== ТАБЛИЦЫ ===== */
.task-table-container {
  margin: 12px 0;
  overflow-x: auto;
  width: 100%;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
}

.task-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  min-width: 300px;
  max-width: 100%;
}

.task-table-container table.with-borders {
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td {
  border: 1px solid #ddd;
  padding: 6px 8px;
}

.task-table-container td {
  padding: 6px 8px;
  vertical-align: top;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
  word-break: break-word;
  overflow-wrap: break-word;
}

.task-table-container :deep(sub),
.task-table-container :deep(sup) {
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-table-container :deep(sub) {
  bottom: -0.25em;
}

.task-table-container :deep(sup) {
  top: -0.5em;
}

.task-table-container :deep(p) {
  margin: 0;
  padding: 0;
}

.task-table-container :deep(strong) {
  font-weight: 600;
}

/* ===== ИЗОБРАЖЕНИЯ ===== */
.task-images {
  margin-bottom: 12px;
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(100px, 15vw, 150px), 1fr));
  gap: 8px;
  margin-top: 8px;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid #eee;
  background: #f8f9fa;
  cursor: pointer;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.task-image:hover {
  transform: scale(1.03);
}

/* ===== ОТВЕТЫ ===== */
.answer-section {
  margin-top: 12px;
  width: 100%;
}

.answer-input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.answer-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: clamp(0.85rem, 2vw, 1rem);
  min-width: 150px;
  width: 100%;
  box-sizing: border-box;
}

.answer-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.answer-textarea {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: clamp(0.85rem, 2vw, 1rem);
  min-width: 150px;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
  width: 100%;
  box-sizing: border-box;
}

.answer-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.answer-textarea.extended {
  min-height: 120px;
}

.submit-button {
  padding: 8px 16px;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.85rem, 2vw, 1rem);
  white-space: nowrap;
}

.submit-button:hover {
  background-color: #9a36b8;
}

.cancel-button {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.85rem, 2vw, 1rem);
  white-space: nowrap;
}

.cancel-button:hover {
  background-color: #5a6268;
}

/* ===== ФИДБЕК ===== */
.answer-feedback {
  padding: 10px;
  border-radius: 6px;
  font-weight: 500;
  margin-top: 8px;
  font-size: clamp(0.85rem, 2vw, 1rem);
  width: 100%;
  box-sizing: border-box;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
}

.correct-icon,
.partial-icon,
.incorrect-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.correct-icon {
  color: #2e7d32;
}

.partial-icon {
  color: #ff8f00;
}

.incorrect-icon {
  color: #c62828;
}

.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}

.correct-answer-text {
  width: 100%;
  word-break: break-word;
}

.current-score {
  font-weight: 600;
  color: #4a5568;
}

/* ===== ОТВЕТ СОХРАНЕН ===== */
.answer-saved {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 6px;
  border-left: 4px solid #28a745;
  flex-direction: column;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
}

.saved-icon {
  font-size: 1.2rem;
}

.user-answer-container {
  width: 100%;
}

.user-answer-text {
  margin-left: 4px;
  color: #155724;
  word-break: break-word;
}

.user-answer-text.multiline {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #f8f9fa;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid #b241d1;
  margin: 6px 0;
  line-height: 1.5;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.user-answer-text.multiline pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  margin: 0;
  padding: 0;
  width: 100%;
}

.edit-answer-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 1.1rem;
  transition: background-color 0.2s;
}

.edit-answer-btn:hover {
  background-color: rgba(178, 65, 209, 0.1);
}

.saving-status {
  color: #6c757d;
  font-style: italic;
  margin-top: 4px;
}

/* ===== ИЗОБРАЖЕНИЯ ОТВЕТОВ ===== */
.image-upload-section {
  margin: 10px 0;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px dashed #dee2e6;
  width: 100%;
  box-sizing: border-box;
}

.upload-label {
  display: inline-block;
  background: #b241d1;
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
  width: auto;
}

.upload-label:hover {
  background: #9a36b8;
}

.file-input {
  display: none;
}

.uploading-text {
  color: #6c757d;
  font-style: italic;
  margin-top: 4px;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.upload-status-uploading {
  background-color: #fff3cd;
  color: #856404;
  padding: 6px 10px;
  border-radius: 4px;
  margin: 4px 0;
  border: 1px solid #ffeaa7;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.upload-status-success {
  background-color: #d4edda;
  color: #155724;
  padding: 6px 10px;
  border-radius: 4px;
  margin: 4px 0;
  border: 1px solid #c3e6cb;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.answer-images-preview {
  margin-top: 10px;
  width: 100%;
}

.images-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(70px, 12vw, 100px), 1fr));
  gap: 8px;
  margin-bottom: 10px;
  width: 100%;
}

.image-item {
  position: relative;
  display: inline-block;
}

.answer-image {
  width: 100%;
  height: clamp(60px, 10vw, 80px);
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.answer-image:hover {
  transform: scale(1.05);
}

.remove-image-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: clamp(18px, 3vw, 22px);
  height: clamp(18px, 3vw, 22px);
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  font-size: clamp(9px, 1.5vw, 12px);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.remove-image-btn:hover {
  background: #c82333;
}

.save-images-btn {
  padding: 6px 14px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
}

.save-images-btn:hover {
  background-color: #218838;
}

/* ===== ПОЯСНЕНИЕ ===== */
.explanation-section {
  margin-top: 16px;
  padding: clamp(10px, 1.5vw, 16px);
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #b241d1;
  width: 100%;
  box-sizing: border-box;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  font-size: clamp(0.9rem, 2vw, 1.05rem);
}

.explanation-toggle {
  font-size: 0.8rem;
  color: #b241d1;
}

.explanation-content-container {
  margin-top: 6px;
}

.explanation-content {
  line-height: 1.6;
  color: #444;
  font-size: clamp(0.85rem, 2vw, 1rem);
}

.explanation-content :deep(p) {
  margin-bottom: 8px;
}

.explanation-content :deep(p:last-child) {
  margin-bottom: 0;
}

.explanation-content :deep(br) {
  display: block;
  margin-bottom: 4px;
}

.explanation-content :deep(ul),
.explanation-content :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.explanation-content :deep(li) {
  margin-bottom: 4px;
}

.explanation-image-container {
  margin: 10px 0;
  text-align: center;
  width: 100%;
}

.explanation-image {
  max-width: 100%;
  height: auto;
  max-height: clamp(150px, 30vw, 300px);
  border-radius: 6px;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.explanation-image:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* ===== МОДАЛЬНОЕ ОКНО ===== */
.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: clamp(-14px, -2vw, -20px);
  right: clamp(-14px, -2vw, -20px);
  background: #b241d1;
  color: white;
  border: none;
  width: clamp(32px, 5vw, 40px);
  height: clamp(32px, 5vw, 40px);
  border-radius: 50%;
  font-size: clamp(1rem, 2vw, 1.5rem);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

/* ===== КУРАТОР ===== */
.tutor-scoring-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  background-color: rgba(102, 126, 234, 0.1);
  border-radius: 6px;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
}

.score-label {
  font-weight: 600;
  color: #667eea;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
}

.score-select {
  padding: 4px 10px;
  border: 1px solid #667eea;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
}

.score-select:focus {
  outline: none;
  border-color: #5a67d8;
  box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.2);
}

.tutor-final-assessment {
  margin-top: 20px;
  padding: clamp(12px, 2vw, 20px);
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border-radius: 12px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

.tutor-final-assessment h3 {
  margin-bottom: 10px;
  font-size: clamp(1rem, 2.5vw, 1.3rem);
}

.tutor-final-assessment .student-info {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  text-align: center;
  color: #333;
}

.tutor-final-assessment .student-info .student-name {
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  font-weight: 500;
}

.tutor-final-assessment .student-info strong {
  color: #667eea;
  margin-right: 4px;
}

.final-score {
  font-size: clamp(1rem, 2.5vw, 1.4rem);
  font-weight: bold;
  margin: 10px 0;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
}

.completion-percent {
  font-size: clamp(0.85rem, 2vw, 1rem);
  opacity: 0.9;
  margin-top: 4px;
}

.tutor-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.save-final-score-btn {
  padding: 8px 16px;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
  font-size: clamp(0.8rem, 1.8vw, 0.95rem);
}

.save-final-score-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* ===== ЗАВЕРШЕНИЕ ===== */
.completion-section {
  margin-top: 20px;
  text-align: center;
  padding: 16px;
  border-top: 2px solid #eee;
  width: 100%;
  box-sizing: border-box;
}

.complete-btn {
  padding: 10px 24px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: clamp(0.9rem, 2vw, 1.05rem);
  cursor: pointer;
  transition: background-color 0.3s ease;
  width: auto;
  min-width: 200px;
}

.complete-btn:hover {
  background-color: #218838;
}

.completion-result {
  margin-top: 20px;
  padding: 16px 20px;
  background-color: #e8f5e9;
  border-radius: 8px;
  text-align: center;
  border-left: 4px solid #28a745;
  width: 100%;
  box-sizing: border-box;
}

.completion-result h3 {
  color: #2e7d32;
  margin-bottom: 6px;
  font-size: clamp(1rem, 2.5vw, 1.3rem);
}

.completion-result p {
  color: #388e3c;
  font-size: clamp(0.85rem, 2vw, 1rem);
  font-weight: 500;
}

/* ===== ЗАГРУЗКА И ОШИБКИ ===== */
.loading {
  text-align: center;
  padding: 40px 20px;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  color: #666;
}

.error {
  color: #ff4757;
  padding: 14px 16px;
  text-align: center;
  background: #ffe6e6;
  border-radius: 8px;
  border: 1px solid #ff4757;
  font-size: clamp(0.9rem, 2vw, 1rem);
}

/* ===== АНИМАЦИИ ===== */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ============================================ */
/* МОБИЛЬНАЯ АДАПТИВНОСТЬ */
/* ============================================ */

/* Телефоны в портретной ориентации */
@media (max-width: 768px) {
  .homework-content {
    padding: 12px;
  }
  
  .homework-header h1 {
    font-size: 1.4rem;
  }
  
  .homework-meta {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }
  
  .lesson-info {
    text-align: center;
  }
  
  .deadline {
    white-space: normal;
    text-align: center;
  }
  
  .task-item {
    padding: 10px;
    border-radius: 8px;
    margin: 0 -4px;
    border-left: none;
    border-right: none;
  }
  
  .extended-task .task-header {
    padding: 8px 10px;
    margin: -10px -10px 8px -10px;
  }
  
  .task-header {
    flex-direction: column;
    gap: 6px;
  }
  
  .task-status {
    align-self: stretch;
    text-align: center;
    white-space: normal;
  }
  
  .answer-input-container {
    flex-direction: column;
    gap: 6px;
  }
  
  .answer-input {
    min-width: unset;
  }
  
  .answer-textarea {
    min-width: unset;
    min-height: 70px;
  }
  
  .answer-textarea.extended {
    min-height: 100px;
  }
  
  .submit-button,
  .cancel-button {
    width: 100%;
    white-space: normal;
    text-align: center;
  }
  
  .feedback-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  }
  
  .answer-image {
    height: 60px;
  }
  
  .task-table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .task-table-container table {
    min-width: 400px;
  }
  
  .tutor-scoring-panel {
    flex-direction: column;
    align-items: stretch;
  }
  
  .score-select {
    width: 100%;
  }
  
  .current-score {
    margin-left: 0;
    text-align: center;
  }
  
  .tutor-actions {
    flex-direction: column;
  }
  
  .save-final-score-btn {
    width: 100%;
  }
  
  .complete-btn {
    width: 100%;
    min-width: unset;
  }
  
  .upload-label {
    width: 100%;
    text-align: center;
  }
  
  .close-modal {
    top: -12px;
    right: -12px;
    width: 32px;
    height: 32px;
    font-size: 1.2rem;
  }
}

/* Маленькие телефоны */
@media (max-width: 480px) {
  .homework-content {
    padding: 8px;
  }
  
  .homework-header h1 {
    font-size: 1.1rem;
  }
  
  .task-item {
    padding: 8px;
    border-radius: 4px;
  }
  
  .extended-task .task-header {
    padding: 6px 8px;
    margin: -8px -8px 6px -8px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 4px;
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 4px;
  }
  
  .answer-image {
    height: 50px;
  }
  
  .answer-textarea {
    min-height: 60px;
  }
  
  .answer-textarea.extended {
    min-height: 80px;
  }
  
  .task-table-container table {
    min-width: 320px;
    font-size: 0.8rem;
  }
  
  .task-table-container td {
    padding: 4px 6px;
    font-size: 0.8rem;
  }
  
  .explanation-image {
    max-height: 150px;
  }
  
  .close-modal {
    top: -10px;
    right: -10px;
    width: 28px;
    height: 28px;
    font-size: 1rem;
  }
  
  .remove-image-btn {
    width: 18px;
    height: 18px;
    font-size: 10px;
    top: -5px;
    right: -5px;
  }
}

/* Очень маленькие экраны */
@media (max-width: 360px) {
  .homework-content {
    padding: 4px;
  }
  
  .homework-header h1 {
    font-size: 1rem;
  }
  
  .task-item {
    padding: 6px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  }
  
  .answer-image {
    height: 40px;
  }
  
  .task-table-container table {
    min-width: 280px;
    font-size: 0.75rem;
  }
  
  .task-table-container td {
    padding: 3px 4px;
    font-size: 0.75rem;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .homework-content {
    padding: 12px;
  }
  
  .answer-input-container {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .answer-input {
    flex: 1 1 60%;
    min-width: 120px;
  }
  
  .submit-button {
    flex: 1 1 30%;
    width: auto;
  }
  
  .cancel-button {
    flex: 1 1 30%;
    width: auto;
  }
  
  .answer-textarea {
    min-height: 60px;
  }
  
  .answer-textarea.extended {
    min-height: 80px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }
  
  .task-header {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .task-status {
    align-self: flex-start;
  }
}
</style>

<style>
/* Глобальные стили (без scoped) */
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

* {
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background: white;
  width: 100%;
  min-height: 100vh;
  line-height: 1.4;
  overflow-x: hidden;
}

a {
  color: white;
  text-decoration: none;
}

.allpage {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

.topmenu {
  width: 100%;
  padding: 12px 24px;
  color: white;
  font-size: clamp(0.9rem, 2vw, 1.2rem);
  background-image: url(./assets/background_line.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.logo {
  font-weight: bold;
  white-space: nowrap;
  font-size: clamp(0.8rem, 1.8vw, 1.1rem);
}

.rightparttopmenu {
  display: flex;
  gap: clamp(12px, 3vw, 20px);
  align-items: center;
  flex-wrap: wrap;
  font-size: clamp(0.8rem, 1.8vw, 1rem);
}

.redirect_menu,
.go_back {
  padding: 4px 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.redirect_menu:hover,
.go_back:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.centerpartpage {
  flex: 1;
  width: 100%;
  padding: clamp(8px, 2vw, 16px) clamp(12px, 3vw, 24px);
  display: flex;
  justify-content: center;
  overflow-x: hidden;
}

.mainpart {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-x: hidden;
}

table {
  font-family: Evolventa !important;
}

td,
th {
  font-family: Evolventa !important;
}

table * {
  font-family: Evolventa !important;
}

/* Глобальная адаптивность для topmenu */
@media (max-width: 768px) {
  .topmenu {
    flex-direction: column;
    text-align: center;
    gap: 6px;
    padding: 8px 16px;
  }
  
  .rightparttopmenu {
    justify-content: center;
  }
  
  .centerpartpage {
    padding: 6px 8px;
  }
}

@media (max-width: 480px) {
  .topmenu {
    padding: 6px 12px;
    font-size: 0.8rem;
  }
  
  .logo {
    font-size: 0.75rem;
  }
  
  .rightparttopmenu {
    font-size: 0.75rem;
    gap: 8px;
  }
  
  .redirect_menu,
  .go_back {
    padding: 3px 6px;
  }
}

.task-text::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}
</style>