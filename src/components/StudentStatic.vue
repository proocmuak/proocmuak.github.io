<template>
  <div class="statistics-container">
    <div class="header-with-select">
      <h2>Статистика выполнения заданий</h2>
      
      <div class="header-actions">
        <!-- Кастомный дропдаун выбора предмета -->
        <custom-dropdown
          v-if="availableSubjects.length > 0"
          :options="availableSubjects"
          v-model="selectedSubject"
          placeholder="Выберите предмет"
          @change="fetchStatistics"
          class="subject-dropdown"
        />
        <div v-else class="no-subjects">
          Нет доступных предметов
        </div>
        
        <!-- Кнопка ML предсказаний -->
        <button 
          v-if="selectedSubject && availableSubjects.length > 0"
          @click="openMlPredict" 
          class="ml-button"
          :title="'ML анализ для ' + getCurrentSubjectName()"
        >
          <span class="ml-icon">🔮</span>
          <span class="ml-text">ИИ предсказания</span>
        </button>
      </div>
    </div>
    
    <!-- Загрузка -->
    <div v-if="loading" class="loading">
      Загрузка статистики...
    </div>
    
    <!-- Ошибка -->
    <div v-if="error" class="error">
      {{ error }}
    </div>
    
    <!-- Статистика -->
    <div v-if="!loading && !error && tasks.length" class="statistics">
      <div 
        v-for="task in tasks" 
        :key="task.number"
        class="task-item"
      >
        <div 
          class="task-header"
          @click="toggleTask(task.number)"
        >
          <div class="task-number">
            {{ task.number }}
            <span class="toggle-icon">{{ expandedTasks.includes(task.number) ? '▼' : '▶' }}</span>
          </div>
          
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: (task.weighted_accuracy * 100) + '%' }"
                :class="getProgressBarClass(task.weighted_accuracy)"
              ></div>
            </div>
            <span class="percentage">{{ (task.weighted_accuracy * 100).toFixed(1) }}%</span>
          </div>
          
          <div class="task-meta">
            <span class="attempts">{{ task.attempts }} решено</span>
            <span v-if="task.attempts < 3" class="warning-badge" title="Недостаточно данных для точного расчета">⚠️</span>
          </div>
        </div>
        
        <!-- Темы задания с анимацией -->
        <transition name="slide">
          <div 
            v-if="expandedTasks.includes(task.number)" 
            class="topics-list"
          >
            <div 
              v-for="topic in getTopicsByNumber(task.number)" 
              :key="topic.topic"
              class="topic-item"
            >
              <div class="topic-header">
                <span class="topic-name">{{ topic.topic }}</span>
                <span class="topic-status" :class="getStatusClass(topic.recommendation)">
                  {{ topic.recommendation }}
                </span>
              </div>
              
              <div class="topic-details">
                <div class="progress-bar-container small">
                  <div class="progress-bar">
                    <div 
                      class="progress-fill" 
                      :style="{ width: (topic.weighted_accuracy * 100) + '%' }"
                      :class="getProgressBarClass(topic.weighted_accuracy)"
                    ></div>
                  </div>
                  <span class="percentage small">{{ (topic.weighted_accuracy * 100).toFixed(1) }}%</span>
                </div>
                
                <div class="topic-meta">
                  <span>{{ topic.attempts }} решено</span>
                  <span v-if="topic.attempts < 3" class="insufficient-data" title="Недостаточно данных для точного расчета">
                    ⚠️ Слишком мало данных
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Сообщение если нет тем -->
            <div v-if="getTopicsByNumber(task.number).length === 0" class="no-topics">
              Нет данных по темам
            </div>
          </div>
        </transition>
      </div>
    </div>
    
    <!-- Нет данных -->
    <div v-if="!loading && !error && !tasks.length && availableSubjects.length > 0" class="no-data">
      Нет данных для отображения по выбранному предмету
    </div>
    
    <!-- ML Modal - исправлено! -->
    <Teleport to="body">
      <div v-if="showMlModal" class="modal-overlay" @click.self="closeMlPredict">
        <div class="modal-container">
          <div class="modal-header">
            <h3>ИИ предсказания для {{ getCurrentSubjectName() }}</h3>
            <button class="modal-close" @click="closeMlPredict">×</button>
          </div>
          <div class="modal-content">
            <MlPredict
              :subject="selectedSubject"
              :subject-name="getCurrentSubjectName()"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import MlPredict from './MlPredict.vue'

export default {
  name: 'StudentStatic',
  components: {
    CustomDropdown,
    MlPredict
  },
  setup() {
    const tasks = ref([])
    const topicsByNumber = ref({})
    const loading = ref(true)
    const error = ref(null)
    const expandedTasks = ref([])
    const selectedSubject = ref('')
    const availableSubjects = ref([])
    const showMlModal = ref(false)
    
    // Маппинг для отображения названий
    const tableToSubject = {
      'ml_biology_ege': 'Биология ЕГЭ',
      'ml_biology_oge': 'Биология ОГЭ',
      'ml_chemistry_ege': 'Химия ЕГЭ',
      'ml_chemistry_oge': 'Химия ОГЭ'
    }
    
    const getCurrentSubjectName = () => {
      if (!selectedSubject.value) return ''
      return tableToSubject[selectedSubject.value] || selectedSubject.value
    }
    
    const fetchUserSubjects = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) throw new Error('Ошибка аутентификации')
        if (!user) throw new Error('Пользователь не аутентифицирован')
        
        const { data: subjects, error: subjectsError } = await supabase
          .rpc('get_user_subjects', { p_user_id: user.id })
        
        if (subjectsError) throw subjectsError
        
        availableSubjects.value = (subjects || []).map(s => ({
          value: s.table_name,
          label: s.subject_name
        }))
        
        if (availableSubjects.value.length > 0) {
          selectedSubject.value = availableSubjects.value[0].value
          await fetchStatistics()
        } else {
          loading.value = false
        }
        
      } catch (err) {
        console.error('Ошибка при загрузке предметов:', err)
        error.value = err.message
        loading.value = false
      }
    }
    
    const fetchStatistics = async () => {
      if (!selectedSubject.value) return
      
      try {
        loading.value = true
        error.value = null
        expandedTasks.value = []
        
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) throw new Error('Ошибка аутентификации')
        if (!user) throw new Error('Пользователь не аутентифицирован')
        
        const [taskStats, topicStats] = await Promise.all([
          supabase.rpc('get_task_statistics', { 
            p_user_id: user.id, 
            p_table_name: selectedSubject.value 
          }),
          supabase.rpc('get_topic_statistics', { 
            p_user_id: user.id, 
            p_table_name: selectedSubject.value 
          })
        ])
        
        if (taskStats.error) throw taskStats.error
        if (topicStats.error) throw topicStats.error
        
        tasks.value = taskStats.data || []
        
        topicsByNumber.value = {}
        const topics = topicStats.data || []
        
        topics.forEach(topic => {
          if (!topicsByNumber.value[topic.number]) {
            topicsByNumber.value[topic.number] = []
          }
          topicsByNumber.value[topic.number].push(topic)
        })
        
        Object.keys(topicsByNumber.value).forEach(number => {
          topicsByNumber.value[number].sort((a, b) => {
            if (a.attempts < 3 && b.attempts >= 3) return -1
            if (a.attempts >= 3 && b.attempts < 3) return 1
            return a.weighted_accuracy - b.weighted_accuracy
          })
        })
        
      } catch (err) {
        console.error('Ошибка:', err)
        error.value = err.message
      } finally {
        loading.value = false
      }
    }
    
    const toggleTask = (number) => {
      if (expandedTasks.value.includes(number)) {
        expandedTasks.value = expandedTasks.value.filter(n => n !== number)
      } else {
        expandedTasks.value.push(number)
      }
    }
    
    const getTopicsByNumber = (number) => {
      return topicsByNumber.value[number] || []
    }
    
    const getProgressBarClass = (accuracy) => {
      if (accuracy < 0.4) return 'critical'
      if (accuracy < 0.65) return 'warning'
      return 'success'
    }
    
    const getStatusClass = (recommendation) => {
      switch(recommendation) {
        case 'Критически повторить':
          return 'status-critical'
        case 'Нужно повторить':
          return 'status-warning'
        case 'Порешай еще':
          return 'status-insufficient'
        default:
          return 'status-success'
      }
    }
    
    const openMlPredict = () => {
      showMlModal.value = true
      document.body.style.overflow = 'hidden'
    }
    
    const closeMlPredict = () => {
      showMlModal.value = false
      document.body.style.overflow = 'auto'
    }
    
    onMounted(() => {
      fetchUserSubjects()
    })
    
    return {
      tasks,
      topicsByNumber,
      loading,
      error,
      expandedTasks,
      selectedSubject,
      availableSubjects,
      showMlModal,
      toggleTask,
      getTopicsByNumber,
      getProgressBarClass,
      getStatusClass,
      fetchStatistics,
      openMlPredict,
      closeMlPredict,
      getCurrentSubjectName
    }
  }
}
</script>

<style scoped>
/* Объединяем все стили в один блок */
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

.statistics-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header-with-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

h2 {
  color: #333;
  font-size: 24px;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: bold;
  margin: 0;
}

.subject-dropdown {
  min-width: 200px;
}

/* Стили для ML кнопки */
.ml-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #b241d1, #8e24aa);
  color: white;
  border: none;
  border-radius: 30px;
  font-size: 15px;
  font-weight: 600;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(178, 65, 209, 0.3);
  white-space: nowrap;
}

.ml-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(178, 65, 209, 0.4);
  background: linear-gradient(135deg, #9b3cb5, #7b1fa2);
}

.ml-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(178, 65, 209, 0.3);
}

.ml-icon {
  font-size: 20px;
}

.ml-text {
  letter-spacing: 0.3px;
}

.no-subjects {
  color: #666;
  font-style: italic;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}

.loading, .error, .no-data {
  text-align: center;
  padding: 40px;
  color: #666;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.error {
  color: #d32f2f;
}

.no-data {
  color: #666;
  font-style: italic;
}

.statistics {
  width: 100%;
}

.task-item {
  width: 100%;
  margin-bottom: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.task-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  background: #f8f9fa;
  transition: background 0.2s ease;
  width: 100%;
}

.task-header:hover {
  background: #f0f0f0;
}

.task-number {
  min-width: 80px;
  font-weight: 700;
  color: #b241d1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-family: Evolventa, 'Courier New', monospace;
  font-weight: bold;
}

.toggle-icon {
  font-size: 14px;
  color: #666;
  transition: transform 0.2s ease;
}

.progress-bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 24px;
}

.progress-bar {
  flex: 1;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.critical {
  background: linear-gradient(90deg, #f44336, #ff9800);
}

.progress-fill.warning {
  background: linear-gradient(90deg, #ff9800, #ffc107);
}

.progress-fill.success {
  background: linear-gradient(90deg, #4caf50, #8bc34a);
}

.percentage {
  min-width: 70px;
  font-weight: 700;
  color: #333;
  font-size: 16px;
  font-family: Evolventa, 'Courier New', monospace;
  font-weight: bold;
}

.percentage.small {
  min-width: 60px;
  font-size: 14px;
}

.task-meta {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 14px;
  min-width: 100px;
  justify-content: flex-end;
  align-items: center;
}

.attempts {
  background: rgba(178, 65, 209, 0.3);
  padding: 6px 12px;
  border-radius: 20px;
  white-space: nowrap;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.warning-badge {
  font-size: 16px;
  cursor: help;
}

/* Анимация для раскрытия */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.topics-list {
  padding: 20px;
  background: white;
  border-top: 1px solid #e0e0e0;
  width: 100%;
}

.topic-item {
  width: 100%;
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  transition: transform 0.2s ease;
}

.topic-item:hover {
  transform: translateX(4px);
  background: #f0f0f0;
}

.topic-item:last-child {
  margin-bottom: 0;
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.topic-name {
  font-weight: 600;
  color: #333;
  font-size: 15px;
  flex: 1;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.topic-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: bold;
}

.topic-status.status-critical {
  background: #ffebee;
  color: #c62828;
}

.topic-status.status-warning {
  background: #fff3e0;
  color: #ef6c00;
}

.topic-status.status-success {
  background: #e8f5e8;
  color: #2e7d32;
}

.topic-status.status-insufficient {
  background: #e0e0e0;
  color: #666;
}

.topic-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.progress-bar-container.small {
  margin: 0;
  gap: 12px;
  width: 100%;
}

.topic-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
  margin-top: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.topic-meta span {
  background: #e0e0e0;
  padding: 4px 12px;
  border-radius: 16px;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.insufficient-data {
  background: #ffecb3 !important;
  color: #856404 !important;
  font-style: italic;
}

.no-topics {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
}

/* Модальное окно - полная ширина */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  background: white;
  border-radius: 16px;
  width: 95vw;
  max-width: 95vw;
  height: 90vh;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: #666;
  cursor: pointer;
  padding: 0 8px;
  transition: color 0.2s ease;
}

.modal-close:hover {
  color: #b241d1;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  width: 100%;
  max-width: none !important;  /* Перебиваем глобальный max-width: 400px */
  box-sizing: border-box;
  background-color: transparent !important;  /* Убираем белый фон */
  border-radius: 0 !important;  /* Убираем скругление */
  box-shadow: none !important;  /* Убираем тень */
  text-align: left !important;  /* Возвращаем выравнивание */
  animation: none !important;  /* Убираем анимацию */
}

/* Стили для дочернего компонента MlPredict - на всю ширину */
.modal-content :deep(.ml-predict-container) {
  width: 100%;
  max-width: 100%;
}

.modal-content :deep(.results-grid) {
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
}

/* Анимации */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Адаптивность */
@media (max-width: 768px) {
  .statistics-container {
    padding: 12px;
  }
  
  .header-with-select {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    flex-direction: column;
    width: 100%;
  }
  
  h2 {
    text-align: center;
  }
  
  .subject-dropdown {
    width: 100%;
    min-width: 100%;
  }
  
  .ml-button {
    width: 100%;
    justify-content: center;
  }
  
  .task-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }
  
  .task-number {
    min-width: auto;
    font-size: 20px;
  }
  
  .progress-bar-container {
    width: 100%;
    margin: 4px 0;
  }
  
  .task-meta {
    width: 100%;
    justify-content: flex-start;
  }
  
  .topic-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .topic-status {
    align-self: flex-start;
  }
  
  .topic-item:hover {
    transform: none;
  }
  
  /* Модальное окно на мобильных */
  .modal-container {
    width: 98vw;
    height: 95vh;
  }
  
  .modal-content {
    padding: 12px;
  }
  
  .modal-content :deep(.results-grid) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .modal-content :deep(.mode-switcher) {
    max-width: 100%;
  }
}
</style>