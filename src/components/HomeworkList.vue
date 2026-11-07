<template>
  <div class="homework-container">
    <div class="student-info">
      <h2>Домашние работы ученика</h2>
      <div class="student-details">
        <p><strong>Имя:</strong> {{ student.first_name }} {{ student.last_name }}</p>
        <p><strong>Email:</strong> {{ student.email }}</p>
        <p><strong>Телефон:</strong> {{ student.phone }}</p>
        <p><strong>Общий балл:</strong> <span class="total-score">{{ student.score }}</span></p>
        <p><strong>Рейтинг:</strong> <span class="rating">{{ student.rating || 0 }}</span></p>

        <div v-if="subjectTariffInfo" class="tariff-info">
          <p><strong>Тариф:</strong> {{ subjectTariffInfo.tariff || 'Не указан' }}</p>
          <p><strong>Оплачено до:</strong>
            <span :class="{ 'expired': subjectTariffInfo.isExpired, 'expiring-soon': subjectTariffInfo.isExpiringSoon }">
              {{ subjectTariffInfo.paymentDateFormatted }}
            </span>
          </p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка домашних работ...</div>

    <div v-if="error" class="error">
      Ошибка: {{ error }}
      <button @click="loadHomework" class="retry-btn">Повторить</button>
    </div>

    <div v-if="!loading && filteredHomework.length > 0" class="homework-list">
      <h3>Домашние работы</h3>

      <div class="homework-grid">
        <div
          v-for="hw in filteredHomework"
          :key="hw.homework_id"
          class="homework-card"
          :class="{
            'completed': hw.is_completed,
            'low-score': hw.is_completed && hw.completionPercentage < 50
          }"
        >
          <div class="homework-header">
            <h4>{{ hw.homework_name || `Домашняя работа #${hw.homework_id}` }}</h4>
            <span class="status-badge" :class="hw.is_completed ? 'completed' : 'not-completed'">
              {{ hw.is_completed ? 'Выполнено' : 'Не выполнено' }}
            </span>
          </div>

          <div class="homework-details">
            <p><strong>Урок:</strong> {{ hw.lesson_number }}. {{ hw.lesson_name }}</p>
            <p v-if="hw.lesson_date">
              <strong>Дата урока:</strong> {{ formatDate(hw.lesson_date) }}
            </p>
            <template v-if="hw.is_completed">
              <p><strong>Макс. баллов:</strong> {{ hw.max_score }}</p>
              <p>
                <strong>Набрано баллов:</strong>
                <span class="score">{{ hw.total_score || 0 }}</span>
                <span class="completion-percentage">({{ hw.completionPercentage }}%)</span>
              </p>
              <p v-if="hw.last_completed_at">
                <strong>Время сдачи:</strong> {{ formatDate(hw.last_completed_at) }}
              </p>
            </template>
          </div>

          <div class="homework-actions">
            <button @click="openHomeworkSimple(hw)" class="view-btn">
              Посмотреть детали
            </button>
            <button
              v-if="hw.is_completed && hw.completionPercentage < 60"
              @click="sendForRevision(hw)"
              class="revision-btn"
              :disabled="hw.sendingRevision"
            >
              <span v-if="hw.sendingRevision">Отправка...</span>
              <span v-else>Отправить на переделывание</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && filteredHomework.length === 0" class="no-data">
      Нет доступных домашних работ для отображения
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  name: 'StudentHomework',
  props: {
    student: {
      type: Object,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    examType: {
      type: String,
      default: 'ЕГЭ'
    }
  },
  data() {
    return {
      homework: [],
      lessons: [],
      loading: false,
      error: null,
      studentDetails: null
    }
  },
  async mounted() {
    await this.loadStudentDetails()
    await this.loadHomework()
  },
  computed: {
    // Показываем только ДЗ, у которых урок уже прошёл (или сегодня)
    filteredHomework() {
      const today = this.todayMidnight()
      return this.homework.filter(hw => {
        const lessonNumber = Number(hw.lesson_number)
        const lesson = this.lessons.find(l => l.number === lessonNumber)
        if (!lesson || !lesson.date) return false

        const lessonDate = new Date(lesson.date)
        lessonDate.setHours(0, 0, 0, 0)
        return lessonDate <= today
      })
    },

    subjectTariffInfo() {
      if (!this.studentDetails) return null

      const isSubject1 = this.subject.toLowerCase().includes('химия') ||
                        this.subject.toLowerCase().includes('chemistry')

      if (isSubject1) {
        return {
          tariff: this.studentDetails.subject1_tariff,
          paymentDate: this.studentDetails.subject1_payment_date,
          paymentDateFormatted: this.formatPaymentDate(this.studentDetails.subject1_payment_date),
          isExpired: this.isPaymentExpired(this.studentDetails.subject1_payment_date),
          isExpiringSoon: this.isPaymentExpiringSoon(this.studentDetails.subject1_payment_date)
        }
      } else {
        return {
          tariff: this.studentDetails.subject2_tariff,
          paymentDate: this.studentDetails.subject2_payment_date,
          paymentDateFormatted: this.formatPaymentDate(this.studentDetails.subject2_payment_date),
          isExpired: this.isPaymentExpired(this.studentDetails.subject2_payment_date),
          isExpiringSoon: this.isPaymentExpiringSoon(this.studentDetails.subject2_payment_date)
        }
      }
    }
  },
  methods: {
    todayMidnight() {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d
    },

    async loadStudentDetails() {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', this.student.user_id)
          .single()

        if (error) throw error
        this.studentDetails = data
      } catch (error) {
        console.error('Ошибка загрузки деталей студента:', error)
      }
    },

    async fetchLessons() {
      const subjectTable = `${this.subject}_${this.examType.toLowerCase()}`
      const { data, error } = await supabase
        .from(subjectTable)
        .select('number, date, title')
        .order('number', { ascending: true })

      if (error) throw error
      this.lessons = data || []
    },

    async loadHomework() {
      this.loading = true
      this.error = null

      try {
        const subjectKey = `${this.subject}_${this.examType.toLowerCase()}`
        const homeworkTable = `${subjectKey}_homework_completed`
        const homeworkListTable = `${subjectKey}_homework_list`
        const homeworkTasksTable = `${subjectKey}_homework_tasks`
        const taskBankTable = `${subjectKey}_task_bank`

        // Загружаем уроки (нужны для фильтра «урок прошёл»)
        await this.fetchLessons()

        // Все ДЗ
        const { data: homeworkList, error: listError } = await supabase
          .from(homeworkListTable)
          .select('*')
          .order('homework_id', { ascending: true })

        if (listError) throw listError

        // Записи о выполнении (не фильтруем по is_completed — берём всё,
        // чтобы знать статус каждой работы)
        const { data: completedHomework, error: completedError } = await supabase
          .from(homeworkTable)
          .select('homework_id, is_completed, score, completed_at')
          .eq('user_id', this.student.user_id)

        if (completedError) throw completedError

        const completedMap = new Map(
          (completedHomework || []).map(c => [c.homework_id, c])
        )

        // Обогащаем каждую работу
        this.homework = await Promise.all(
          (homeworkList || []).map(async (homeworkItem) => {
            const completion = completedMap.get(homeworkItem.homework_id)
            const isCompleted = !!completion?.is_completed

            const lessonNumber = Number(homeworkItem.lesson_number)
            const lesson = this.lessons.find(l => l.number === lessonNumber)

            let maxScore = 0
            let totalScore = 0
            let completionPercentage = 0

            // max_score и процент считаем только для выполненных,
            // чтобы не дёргать task_bank для каждой невыполненной работы
            if (isCompleted) {
              const { data: hwTasks, error: tasksErr } = await supabase
                .from(homeworkTasksTable)
                .select('task_id')
                .eq('homework_id', homeworkItem.homework_id)

              if (tasksErr) throw tasksErr

              if (hwTasks && hwTasks.length > 0) {
                const taskIds = hwTasks.map(t => t.task_id)
                const { data: tasksData, error: bankErr } = await supabase
                  .from(taskBankTable)
                  .select('id, points')
                  .in('id', taskIds)

                if (bankErr) throw bankErr
                maxScore = (tasksData || []).reduce((s, t) => s + (t.points || 0), 0)
              }

              totalScore = completion.score || 0
              completionPercentage = maxScore > 0
                ? Math.round((totalScore / maxScore) * 100)
                : 0
            }

            return {
              homework_id: homeworkItem.homework_id,
              homework_name: homeworkItem.homework_name,
              lesson_number: homeworkItem.lesson_number,
              lesson_name: homeworkItem.lesson_name || lesson?.title || `Урок ${lessonNumber}`,
              lesson_date: lesson?.date || null,
              max_score: maxScore,
              is_completed: isCompleted,
              total_score: totalScore,
              last_completed_at: completion?.completed_at || null,
              completionPercentage,
              sendingRevision: false
            }
          })
        )
      } catch (error) {
        console.error('Ошибка загрузки домашних работ:', error)
        this.error = 'Не удалось загрузить домашние работы'
      } finally {
        this.loading = false
      }
    },

    openHomeworkSimple(homework) {
      try {
        const subjectKey = this.subject
        const examTypeKey = this.examType.toLowerCase()

        const params = new URLSearchParams({
          subject: `${subjectKey}_${examTypeKey}`,
          homework_id: homework.homework_id,
          homework_name: homework.homework_name || 'Домашнее задание',
          lesson_number: homework.lesson_number || '',
          lesson_name: homework.lesson_name || '',
          view_mode: 'tutor',
          student_id: this.student.user_id
        })

        window.open(`/homework.html?${params.toString()}`, '_blank')
      } catch (error) {
        console.error('Ошибка открытия домашнего задания:', error)
        alert('Не удалось открыть домашнее задание.')
      }
    },

    async sendForRevision(homework) {
      if (!confirm(`Отправить "${homework.homework_name}" на переделывание?`)) return

      homework.sendingRevision = true

      try {
        const homeworkTable = `${this.subject}_${this.examType.toLowerCase()}_homework_completed`
        const { error: deleteError } = await supabase
          .from(homeworkTable)
          .delete()
          .eq('user_id', this.student.user_id)
          .eq('homework_id', homework.homework_id)

        if (deleteError) throw deleteError

        await this.loadHomework()
        alert('Работа успешно отправлена на переделывание')
      } catch (error) {
        console.error('Ошибка отправки на переделывание:', error)
        alert('Не удалось отправить работу: ' + error.message)
      } finally {
        homework.sendingRevision = false
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'Не указано'
      return new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    formatPaymentDate(dateString) {
      if (!dateString) return 'Не оплачено'
      return new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },

    isPaymentExpired(paymentDate) {
      if (!paymentDate) return true
      return new Date(paymentDate) < new Date()
    },

    isPaymentExpiringSoon(paymentDate) {
      if (!paymentDate) return false
      const days = Math.ceil((new Date(paymentDate) - new Date()) / (1000 * 60 * 60 * 24))
      return days <= 7 && days > 0
    }
  },
  watch: {
    student: {
      handler() {
        this.loadStudentDetails()
        this.loadHomework()
      },
      deep: true
    },
    subject() {
      this.loadHomework()
    }
  }
}
</script>

<style scoped>
.homework-container { padding: 20px; }

.student-info {
  background-color: #b241d1;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  border: 1px solid #e8d4f2;
  color: white;
}

.student-info h2 { margin: 0 0 20px 0; color: white; font-weight: 600; }

.student-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  color: white;
}

.student-details p { margin: 0; color: white; font-size: 15px; }
.total-score { color: white; font-weight: 600; font-size: 16px; }
.rating { color: #ffd700; font-weight: 600; font-size: 16px; }

.tariff-info {
  grid-column: 1 / -1;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 8px;
  margin-top: 10px;
}

.expired { color: #ff6b6b; font-weight: 600; }
.expiring-soon { color: #ffd93d; font-weight: 600; }

.homework-list h3 { margin-bottom: 25px; color: #7e3f9d; font-weight: 600; }

.homework-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.homework-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(178, 65, 209, 0.1);
  border-left: 4px solid #ff9800;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.homework-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(178, 65, 209, 0.15);
}

.homework-card.completed { border-left-color: #b241d1; }

.homework-card.low-score {
  border-left-color: #dc3545;
  background-color: #fff5f5;
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  gap: 10px;
}

.homework-header h4 { margin: 0; color: #5a2875; font-weight: 600; }

.status-badge {
  padding: 6px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.status-badge.completed {
  background-color: #f0e6f7;
  color: #b241d1;
  border: 1px solid #d8b4e7;
}

.status-badge.not-completed {
  background-color: #fff3e0;
  color: #ff9800;
  border: 1px solid #ffcc80;
}

.homework-details { margin-bottom: 20px; }
.homework-details p { margin: 8px 0; color: #6b7280; font-size: 14px; }

.score { color: #b241d1; font-weight: 600; font-size: 15px; }

.completion-percentage { font-size: 12px; color: #6b7280; margin-left: 5px; }
.homework-card.low-score .completion-percentage { color: #dc3545; font-weight: 600; }

.homework-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.view-btn {
  background: linear-gradient(135deg, #b241d1 0%, #9a30b8 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.view-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.3);
}

.revision-btn {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.revision-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.revision-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.loading { text-align: center; padding: 40px; color: #b241d1; font-size: 16px; }

.error {
  background-color: #fef2f2;
  color: #dc2626;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  margin: 20px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.retry-btn {
  background-color: #b241d1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
.retry-btn:hover { background-color: #9a30b8; }

.no-data {
  text-align: center;
  padding: 60px 20px;
  color: #b241d1;
  font-size: 18px;
  background: linear-gradient(135deg, #f9f3fc 0%, #f0e6f7 100%);
  border-radius: 12px;
  border: 2px dashed #d8b4e7;
}

@media (max-width: 768px) {
  .student-details { grid-template-columns: 1fr; }
  .homework-grid { grid-template-columns: 1fr; }
  .homework-header { flex-direction: column; gap: 10px; }
  .status-badge { align-self: flex-start; }
  .homework-actions { justify-content: center; flex-direction: column; }
}
</style>