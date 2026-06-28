<template>
  <div class="digest-container">
    <!-- Метрики -->
    <div class="metrics-section">
      <div class="metric-item">
        <span class="metric-icon">📅</span>
        <div class="metric-info">
          <span class="metric-value">{{ daysUntilExam }}</span>
          <span class="metric-label">{{ getDaysWord(daysUntilExam) }} до экзамена</span>
        </div>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item">
        <span class="metric-icon">✅</span>
        <div class="metric-info">
          <span class="metric-value">{{ totalTasksSolved }}</span>
          <span class="metric-label">{{ getTaskWord(totalTasksSolved) }} решено</span>
        </div>
      </div>
      <div class="metric-divider"></div>
      <div class="metric-item">
        <span class="metric-icon">🔥</span>
        <div class="metric-info">
          <span class="metric-value">{{ streakDays }}</span>
          <span class="metric-label">{{ getDaysWord(streakDays) }} серия</span>
        </div>
      </div>
    </div>

    <!-- Список дел на сегодня -->
    <div class="tasks-section">
      <div class="tasks-header">
        <span class="tasks-title">📋 Список дел на сегодня</span>
        <span class="tasks-date">{{ todayDate }}</span>
      </div>
      <div class="tasks-scroll-wrapper">
        <div class="tasks-list">
          <div 
            v-for="(task, index) in todayTasks" 
            :key="index"
            class="task-item"
            :class="{ 'task-completed': task.completed }"
          >
            <label class="task-checkbox">
              <input 
                type="checkbox" 
                :checked="task.completed"
                @change="toggleTask(index, $event)"
              >
              <span class="checkmark"></span>
            </label>
            <span class="task-text">{{ task.text }}</span>
          </div>
          
          <div v-if="todayTasks.length === 0" class="no-tasks-message">
            🎉 На сегодня задач нет! Отдохни.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  name: 'StudentDigest',
  data() {
    return {
      daysUntilExam: 0,
      totalTasksSolved: 0,
      streakDays: 0,
      todayTasks: [],
      todayDate: '',
      userId: null,
      channels: [],
      subjects: [],
      isRefreshing: false,
      storageKey: 'digest_tasks',
      // Для тестирования
      debugDate: null,
      isDebug: false
    }
  },
  async mounted() {
    this.todayDate = this.formatTodayDate()
    await this.loadUserData()
    await this.loadStats()
    await this.loadTasks()
    this.subscribeToProgress()
  },
  beforeUnmount() {
    this.unsubscribeFromProgress()
  },
  methods: {
    // ===== МЕТОДЫ ДЛЯ ТЕСТИРОВАНИЯ =====
    /**
     * Включить тестовый режим с указанной датой
     * Использование в консоли:
     * const digest = document.querySelector('.digest-container').__vueParentComponent.ctx
     * digest.enableDebug(new Date(2026, 5, 20)) // 20 июня 2026
     */
    enableDebug(date) {
      this.isDebug = true
      this.debugDate = date || new Date()
      this.todayDate = this.formatTodayDate()
      this.loadStats()
      this.loadTasks()
      console.log(`🐛 Тестовый режим включен, дата: ${this.debugDate.toLocaleDateString('ru-RU')}`)
    },

    /**
     * Выключить тестовый режим
     */
    disableDebug() {
      this.isDebug = false
      this.debugDate = null
      this.todayDate = this.formatTodayDate()
      this.loadStats()
      this.loadTasks()
      console.log('🐛 Тестовый режим выключен')
    },

    /**
     * Получить текущую дату (реальную или тестовую)
     */
    getCurrentDate() {
      if (this.isDebug && this.debugDate) {
        return new Date(this.debugDate)
      }
      return new Date()
    },

    /**
     * Форматирование даты для отображения
     */
    formatTodayDate() {
      const date = this.getCurrentDate()
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    },

    getDaysWord(number) {
      if (number === 0) return 'дней'
      
      const lastDigit = number % 10
      const lastTwoDigits = number % 100
      
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'дней'
      }
      
      if (lastDigit === 1) {
        return 'день'
      } else if (lastDigit >= 2 && lastDigit <= 4) {
        return 'дня'
      } else {
        return 'дней'
      }
    },

    getTaskWord(number) {
      if (number === 0) return 'задач'
      
      const lastDigit = number % 10
      const lastTwoDigits = number % 100
      
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return 'задач'
      }
      
      if (lastDigit === 1) {
        return 'задача'
      } else if (lastDigit >= 2 && lastDigit <= 4) {
        return 'задачи'
      } else {
        return 'задач'
      }
    },

    async loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          this.userId = user.id
        }
      } catch (err) {
        console.error('Ошибка получения пользователя:', err)
      }
    },

    async loadStats() {
      if (this.isRefreshing) return
      this.isRefreshing = true
      
      try {
        if (!this.userId) {
          this.isRefreshing = false
          return
        }

        const { data: studentData } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', this.userId)
          .single()

        if (!studentData) {
          this.daysUntilExam = this.calculateDaysUntilExam()
          this.totalTasksSolved = 0
          this.streakDays = 0
          this.isRefreshing = false
          return
        }

        const examDate = new Date(2027, 5, 1)
        const today = this.getCurrentDate()
        examDate.setHours(0, 0, 0, 0)
        today.setHours(0, 0, 0, 0)
        
        const diffTime = examDate - today
        this.daysUntilExam = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (this.daysUntilExam < 0) this.daysUntilExam = 0

        const subjects = [studentData.subject1, studentData.subject2].filter(Boolean)
        this.subjects = subjects
        
        let totalSolved = 0
        
        for (const subject of subjects) {
          const subjectKey = subject.includes('Химия') ? 'chemistry' : 'biology'
          const examType = subject.includes('ЕГЭ') ? 'ege' : 'oge'
          
          const progressTable = `${subjectKey}_${examType}_progress`
          const variantProgressTable = `${subjectKey}_${examType}_variant_progress`

          const { data: progressData } = await supabase
            .from(progressTable)
            .select('id')
            .eq('user_id', this.userId)

          if (progressData) {
            totalSolved += progressData.length
          }

          const { data: variantData } = await supabase
            .from(variantProgressTable)
            .select('id')
            .eq('user_id', this.userId)

          if (variantData) {
            totalSolved += variantData.length
          }
        }
        
        this.totalTasksSolved = totalSolved

        await this.calculateStreak(subjects)

      } catch (err) {
        console.error('Ошибка загрузки статистики:', err)
      } finally {
        this.isRefreshing = false
      }
    },

    calculateDaysUntilExam() {
      const examDate = new Date(2027, 5, 1)
      const today = this.getCurrentDate()
      examDate.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)
      const diffTime = examDate - today
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return days < 0 ? 0 : days
    },

    async calculateStreak(subjects) {
      try {
        let allProgress = []
        
        for (const subject of subjects) {
          const subjectKey = subject.includes('Химия') ? 'chemistry' : 'biology'
          const examType = subject.includes('ЕГЭ') ? 'ege' : 'oge'
          
          const progressTable = `${subjectKey}_${examType}_progress`
          const { data: progressData } = await supabase
            .from(progressTable)
            .select('last_updated')
            .eq('user_id', this.userId)
            .eq('is_completed', true)
            .order('last_updated', { ascending: false })

          if (progressData) {
            allProgress = [...allProgress, ...progressData]
          }

          const variantProgressTable = `${subjectKey}_${examType}_variant_progress`
          const { data: variantData } = await supabase
            .from(variantProgressTable)
            .select('last_updated')
            .eq('user_id', this.userId)
            .eq('is_completed', true)
            .order('last_updated', { ascending: false })

          if (variantData) {
            allProgress = [...allProgress, ...variantData]
          }
        }

        if (allProgress.length === 0) {
          this.streakDays = 0
          return
        }

        const uniqueDates = new Set()
        allProgress.forEach(item => {
          const date = new Date(item.last_updated)
          const dateStr = date.toISOString().split('T')[0]
          uniqueDates.add(dateStr)
        })

        const sortedDates = Array.from(uniqueDates).sort((a, b) => {
          return new Date(b) - new Date(a)
        })

        const today = this.getCurrentDate()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split('T')[0]

        let streak = 0
        let currentDate = new Date(today)
        let found = true

        while (found) {
          const dateStr = currentDate.toISOString().split('T')[0]
          
          if (sortedDates.includes(dateStr)) {
            streak++
            currentDate.setDate(currentDate.getDate() - 1)
          } else {
            if (streak === 0 && dateStr === todayStr) {
              const yesterday = new Date(today)
              yesterday.setDate(yesterday.getDate() - 1)
              const yesterdayStr = yesterday.toISOString().split('T')[0]
              
              if (sortedDates.includes(yesterdayStr)) {
                currentDate = new Date(yesterday)
                continue
              }
            }
            found = false
          }
        }

        this.streakDays = streak

      } catch (err) {
        console.error('Ошибка расчета серии:', err)
        this.streakDays = 0
      }
    },

    subscribeToProgress() {
      this.unsubscribeFromProgress()
      
      const tables = []
      
      for (const subject of this.subjects) {
        const subjectKey = subject.includes('Химия') ? 'chemistry' : 'biology'
        const examType = subject.includes('ЕГЭ') ? 'ege' : 'oge'
        
        tables.push(`${subjectKey}_${examType}_progress`)
        tables.push(`${subjectKey}_${examType}_variant_progress`)
      }
      
      const uniqueTables = [...new Set(tables)]
      
      for (const tableName of uniqueTables) {
        const channel = supabase
          .channel(`digest_${tableName}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: tableName
            },
            (payload) => {
              if (payload.new && payload.new.user_id === this.userId) {
                this.loadStats()
              } else if (payload.eventType === 'DELETE') {
                this.loadStats()
              }
            }
          )
          .subscribe()
        
        this.channels.push(channel)
      }
    },

    unsubscribeFromProgress() {
      if (this.channels.length > 0) {
        this.channels.forEach(channel => {
          supabase.removeChannel(channel)
        })
        this.channels = []
      }
    },

async loadTasks() {
  try {
    if (!this.userId) {
      console.log('❌ Нет userId')
      return
    }

    const tasks = []
    const today = this.getCurrentDate()
    
    
    // Получаем предметы пользователя
    const subjects = this.subjects
    
    if (subjects.length === 0) {
      console.log('❌ Нет предметов у пользователя')
      this.todayTasks = []
      return
    }
    
    console.log(`📚 Предметы: ${subjects.join(', ')}`)
    
    for (const subject of subjects) {
      const subjectKey = subject.includes('Химия') ? 'chemistry' : 'biology'
      const examType = subject.includes('ЕГЭ') ? 'ege' : 'oge'
      const subjectTable = `${subjectKey}_${examType}`
      const homeworkListTable = `${subjectKey}_${examType}_homework_list`
      const homeworkCompletedTable = `${subjectKey}_${examType}_homework_completed`

      // === 1. УРОКИ С ПРОШЛОЙ НЕДЕЛИ ===
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      
      const weekAgoStr = weekAgo.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]

     

      const { data: lessons, error: lessonsError } = await supabase
        .from(subjectTable)
        .select('number, title, date')
        .gte('date', weekAgoStr)
        .lte('date', todayStr)
        .order('date', { ascending: false })

      if (lessonsError) {
        console.error(`   ❌ Ошибка загрузки уроков:`, lessonsError)
      } else if (lessons) {
        
        lessons.forEach(lesson => {
          tasks.push({
            text: `Посмотреть урок "${lesson.title}"`,
            type: 'lesson',
            subject: subject,
            lessonNumber: lesson.number,
            completed: false
          })
        })
      }

      // === 2. ДОМАШНИЕ ЗАДАНИЯ НА ТЕКУЩЕЙ НЕДЕЛЕ ===
      // Находим начало недели (понедельник)
      const startOfWeek = new Date(today)
      const dayOfWeek = startOfWeek.getDay() // 0 - воскресенье, 1 - понедельник, ...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // сколько дней отнять до понедельника
      startOfWeek.setDate(today.getDate() - diffToMonday)
      startOfWeek.setHours(0, 0, 0, 0)
      
      // Находим конец недели (воскресенье)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0]
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

      

      const { data: homeworks, error: homeworksError } = await supabase
        .from(homeworkListTable)
        .select('homework_id, homework_name, lesson_name, deadline')
        .gte('deadline', startOfWeekStr)
        .lte('deadline', endOfWeekStr)
        .order('deadline', { ascending: true })

      if (homeworksError) {
        console.error(`   ❌ Ошибка загрузки домашек:`, homeworksError)
      } else if (homeworks) {
        
        homeworks.forEach(h => {
          
        })
        
        // Получаем выполненные домашки
        const homeworkIds = homeworks.map(h => h.homework_id)
        const { data: completedHomeworks, error: completedError } = await supabase
          .from(homeworkCompletedTable)
          .select('homework_id')
          .eq('user_id', this.userId)
          .in('homework_id', homeworkIds)

        const completedIds = new Set()
        if (!completedError && completedHomeworks) {
          completedHomeworks.forEach(h => completedIds.add(h.homework_id))
         
        }

        let addedCount = 0
        homeworks.forEach(homework => {
          if (!completedIds.has(homework.homework_id)) {
            tasks.push({
              text: `Сделать домашку "${homework.homework_name}"`,
              type: 'homework',
              subject: subject,
              homeworkId: homework.homework_id,
              deadline: homework.deadline,
              completed: false
            })
            addedCount++
          }
        })
        console.log(`   ✅ Добавлено в список: ${addedCount}`)
      }
    }

    console.log(`\n📋 Итого задач: ${tasks.length}`)
    this.todayTasks = tasks

  } catch (err) {
    console.error('Ошибка загрузки задач:', err)
    this.todayTasks = []
  }
},

    saveTasks() {
      const data = {
        date: new Date().toDateString(),
        tasks: this.todayTasks
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    },

    toggleTask(index, event) {
      if (index >= 0 && index < this.todayTasks.length) {
        this.todayTasks[index].completed = event.target.checked
        if (!this.isDebug) {
          this.saveTasks()
        }
        this.todayTasks = [...this.todayTasks]
      }
    },

    refresh() {
      this.loadStats()
      this.loadTasks()
    }
  }
}
</script>

<style scoped>
.digest-container {
  background: linear-gradient(135deg, #f9f8ff 0%, #f0e6f7 100%);
  border-radius: 12px;
  padding: 12px 20px 14px 20px;
  margin-bottom: 12px;
  border: 1px solid #e8d4f2;
  box-shadow: 0 2px 8px rgba(178, 65, 209, 0.06);
  flex-shrink: 0;
}

/* ===== МЕТРИКИ ===== */
.metrics-section {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 6px 0 8px 0;
  border-bottom: 1px solid #e8d4f2;
  margin-bottom: 10px;
  gap: 4px;
  flex-wrap: wrap;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
}

.metric-icon {
  font-size: 16px;
  line-height: 1;
}

.metric-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: #5a2d7a;
  line-height: 1.2;
}

.metric-label {
  font-size: 10px;
  color: #888;
  text-transform: lowercase;
  letter-spacing: 0.3px;
}

.metric-divider {
  width: 1px;
  height: 28px;
  background: #e8d4f2;
}

/* ===== ЗАДАЧИ ===== */
.tasks-section {
  padding-top: 0;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.tasks-title {
  font-size: 13px;
  font-weight: 600;
  color: #5a2d7a;
}

.tasks-date {
  font-size: 11px;
  color: #888;
}

.tasks-scroll-wrapper {
  max-height: 120px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.tasks-scroll-wrapper::-webkit-scrollbar {
  width: 4px;
}

.tasks-scroll-wrapper::-webkit-scrollbar-track {
  background: #f0e6f7;
  border-radius: 2px;
}

.tasks-scroll-wrapper::-webkit-scrollbar-thumb {
  background: #b241d1;
  border-radius: 2px;
}

.tasks-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: #9a36b8;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #f0e6f7;
  transition: all 0.2s ease;
  min-height: 32px;
}

.task-item:hover {
  border-color: #d8b4e7;
}

.task-item.task-completed {
  background: #f8f5fc;
  border-color: #d8b4e7;
  opacity: 0.7;
}

.task-item.task-completed .task-text {
  text-decoration: line-through;
  color: #999;
}

.task-checkbox {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
  cursor: pointer;
}

.task-checkbox input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 0;
  height: 0;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #d8b4e7;
  border-radius: 4px;
  background: white;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-checkbox input:checked + .checkmark {
  background: #b241d1;
  border-color: #b241d1;
}

.task-checkbox input:checked + .checkmark::after {
  content: '✓';
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.task-checkbox:hover .checkmark {
  border-color: #b241d1;
}

.task-text {
  flex: 1;
  font-size: 12px;
  color: #333;
  font-weight: 500;
  word-break: break-word;
  line-height: 1.4;
  padding-top: 1px;
}

.no-tasks-message {
  padding: 12px;
  text-align: center;
  color: #888;
  font-size: 13px;
}

/* ===== АДАПТИВНОСТЬ ===== */
@media (max-width: 768px) {
  .digest-container {
    padding: 10px 14px 12px 14px;
    margin-bottom: 10px;
  }

  .metrics-section {
    padding: 4px 0 6px 0;
  }

  .metric-item {
    padding: 2px 6px;
    gap: 4px;
  }

  .metric-icon {
    font-size: 14px;
  }

  .metric-value {
    font-size: 14px;
  }

  .metric-label {
    font-size: 9px;
  }

  .metric-divider {
    height: 22px;
  }

  .tasks-title {
    font-size: 12px;
  }

  .tasks-date {
    font-size: 10px;
  }

  .tasks-scroll-wrapper {
    max-height: 100px;
  }

  .task-item {
    padding: 4px 8px;
    gap: 6px;
    min-height: 28px;
  }

  .task-text {
    font-size: 11px;
  }

  .task-checkbox {
    width: 16px;
    height: 16px;
  }

  .checkmark {
    width: 16px;
    height: 16px;
  }

  .task-checkbox input:checked + .checkmark::after {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .digest-container {
    padding: 8px 10px 10px 10px;
    border-radius: 10px;
    margin-bottom: 8px;
  }

  .metrics-section {
    flex-direction: row;
    gap: 2px;
    padding: 3px 0 5px 0;
  }

  .metric-divider {
    height: 18px;
  }

  .metric-item {
    padding: 0 4px;
    gap: 3px;
  }

  .metric-icon {
    font-size: 12px;
  }

  .metric-value {
    font-size: 12px;
  }

  .metric-label {
    font-size: 8px;
  }

  .tasks-header {
    margin-bottom: 4px;
  }

  .tasks-title {
    font-size: 11px;
  }

  .tasks-date {
    font-size: 9px;
  }

  .tasks-scroll-wrapper {
    max-height: 80px;
  }

  .task-item {
    padding: 3px 6px;
    gap: 4px;
    border-radius: 4px;
    min-height: 24px;
  }

  .task-text {
    font-size: 10px;
  }

  .task-checkbox {
    width: 14px;
    height: 14px;
  }

  .checkmark {
    width: 14px;
    height: 14px;
    border-width: 1.5px;
  }

  .task-checkbox input:checked + .checkmark::after {
    font-size: 8px;
  }
}
</style>