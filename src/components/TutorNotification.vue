<template>
  <div class="tutor-notifications">
    <h2>Уведомления о сданных домашних заданиях</h2>
    
    <div v-if="loading && notifications.length === 0" class="loading">
      Загрузка уведомлений...
    </div>
    
    <div v-else-if="notifications.length === 0" class="no-notifications">
      Новых уведомлений нет
    </div>
    
    <div v-else class="notifications-container">
      <div class="notifications-list">
        <div 
          v-for="notification in notifications" 
          :key="notification.id" 
          class="notification-item"
          :class="{ 'new': !notification.is_read }"
        >
          <div class="notification-content">
            <p>
              <span 
                class="student-name-link"
                @click="openStudentHomework(notification)"
              >
                <strong>{{ notification.student_first_name }} {{ notification.student_last_name }}</strong>
              </span>
              сдал домашку по <strong>{{ getSubjectName(notification.subject) }}</strong>
            </p>
            <div class="notification-meta">
              <span class="timestamp">{{ formatDate(notification.completed_at) }}</span>
              <span v-if="notification.score !== null" class="score">
                Оценка: {{ notification.score }}
              </span>
              <span class="payment-status">
                {{ notification.is_paid ? '✅ Оплачено' : '❌ Не оплачено' }}
              </span>
            </div>
          </div>
          <div class="notification-actions">
            <button 
              @click="openHomework(notification)"
              class="view-homework-btn"
            >
              📝 Открыть домашку
            </button>
            <button 
              v-if="!notification.is_read" 
              @click="markAsRead(notification.id)"
              class="mark-read-btn"
            >
              ✓ Прочитано
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="hasMoreNotifications" class="load-more-container">
        <button 
          @click="loadMoreNotifications" 
          class="load-more-btn"
          :disabled="loadingMore"
        >
          {{ loadingMore ? 'Загрузка...' : 'Загрузить еще' }}
        </button>
      </div>
    </div>

    <!-- Модальное окно с домашними работами ученика -->
    <div v-if="selectedStudent" class="modal-overlay" @click.self="closeStudentHomework">
      <div class="modal-container">
        <div class="modal-header">
          <h2>
            Домашние работы ученика: 
            <span class="student-name">{{ selectedStudent.first_name }} {{ selectedStudent.last_name }}</span>
          </h2>
          <button @click="closeStudentHomework" class="close-btn">
            ✕
          </button>
        </div>
        <div class="modal-content">
          <StudentHomework 
            :student="selectedStudent"
            :subject="selectedSubject"
            :exam-type="selectedExamType"
            @back="closeStudentHomework"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import StudentHomework from './StudentHomework.vue'

export default {
  name: 'TutorNotification',
  components: {
    StudentHomework
  },
  setup() {
    const notifications = ref([])
    const loading = ref(true)
    const loadingMore = ref(false)
    const currentPage = ref(0)
    const hasMoreNotifications = ref(true)
    const pageSize = 20 // Количество уведомлений за одну загрузку
    
    let realtimeSubscription = null
    const currentTutorName = ref('')
    const searchNames = ref([])
    
    const selectedStudent = ref(null)
    const selectedSubject = ref('')
    const selectedExamType = ref('')

    const getCurrentTutorName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return ''

        const { data, error } = await supabase
          .from('personalities')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single()

        if (error) {
          console.error('Ошибка загрузки данных куратора:', error)
          return ''
        }

        return `${data.first_name} ${data.last_name}`.trim()
      } catch (error) {
        console.error('Ошибка:', error)
        return ''
      }
    }

    const loadNotifications = async (loadMore = false) => {
      try {
        if (loadMore) {
          loadingMore.value = true
          currentPage.value++
        } else {
          loading.value = true
          currentPage.value = 0
          notifications.value = []
        }

        const tutorName = await getCurrentTutorName()
        currentTutorName.value = tutorName
        
        if (!tutorName) {
          console.log('Имя куратора не найдено')
          return
        }

        const firstName = tutorName.split(' ')[0] || tutorName
        
        searchNames.value = [
          firstName,
          firstName + ' ',
          ' ' + firstName,
          tutorName,
          tutorName + ' ',
          firstName.toLowerCase(),
          firstName.toUpperCase(),
        ]

        const from = currentPage.value * pageSize
        const to = from + pageSize - 1

        const { data, error, count } = await supabase
          .from('homework_notifications')
          .select(`
            id,
            student_id,
            homework_id,
            subject,
            completed_at,
            score,
            is_read,
            tutor_name,
            students:student_id (first_name, last_name)
          `, { count: 'exact' })
          .in('tutor_name', searchNames.value)
          .order('completed_at', { ascending: false })
          .range(from, to)

        if (error) {
          console.error('Ошибка загрузки уведомлений:', error)
          return
        }

        // Быстрая загрузка без проверки оплаты для начального отображения
        const newNotifications = data.map(notification => ({
          id: notification.id,
          student_id: notification.student_id,
          homework_id: notification.homework_id,
          subject: notification.subject,
          completed_at: notification.completed_at,
          score: notification.score,
          is_read: notification.is_read,
          tutor_name: notification.tutor_name,
          student_first_name: notification.students?.first_name || 'Неизвестный',
          student_last_name: notification.students?.last_name || 'ученик',
          is_paid: false // Временно false, обновим позже
        }))

        if (loadMore) {
          notifications.value = [...notifications.value, ...newNotifications]
        } else {
          notifications.value = newNotifications
        }

        // Проверяем, есть ли еще уведомления для загрузки
        hasMoreNotifications.value = data.length === pageSize

        // Фоновая загрузка статусов оплаты
        if (!loadMore) {
          loadPaymentStatuses()
        }

      } catch (error) {
        console.error('Ошибка:', error)
      } finally {
        loading.value = false
        loadingMore.value = false
      }
    }

    const loadMoreNotifications = () => {
      loadNotifications(true)
    }

    // Оптимизированная загрузка статусов оплаты для всех уведомлений сразу
    const loadPaymentStatuses = async () => {
      try {
        // Собираем все уникальные student_id из уведомлений
        const studentIds = [...new Set(notifications.value.map(n => n.student_id))]
        
        if (studentIds.length === 0) return

        // Загружаем данные всех студентов за один запрос
        const { data: studentsData, error } = await supabase
          .from('students')
          .select('user_id, subject1_payment_date, subject2_payment_date')
          .in('user_id', studentIds)

        if (error) {
          console.error('Ошибка загрузки данных студентов:', error)
          return
        }

        // Создаем карту для быстрого доступа
        const studentsMap = new Map()
        studentsData.forEach(student => {
          studentsMap.set(student.user_id, {
            subject1_payment_date: student.subject1_payment_date,
            subject2_payment_date: student.subject2_payment_date
          })
        })

        // Обновляем статусы оплаты для всех уведомлений
        notifications.value.forEach(notification => {
          const studentData = studentsMap.get(notification.student_id)
          if (studentData) {
            const isChemistry = notification.subject.includes('chemistry')
            const paymentDate = isChemistry ? 
              studentData.subject1_payment_date : 
              studentData.subject2_payment_date
            
            notification.is_paid = checkPaymentStatus(paymentDate)
          }
        })

      } catch (error) {
        console.error('Ошибка загрузки статусов оплаты:', error)
      }
    }

    const checkPaymentStatus = (paymentDate) => {
      if (!paymentDate) {
        return false
      }

      const today = new Date()
      const paymentEndDate = new Date(paymentDate)
      
      return paymentEndDate >= today
    }

    const subscribeToRealtime = async () => {
      realtimeSubscription = supabase
        .channel('homework_notifications_changes')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'homework_notifications'
          }, 
          (payload) => {
            // При новом уведомлении перезагружаем только первую страницу
            loadNotifications(false)
          }
        )
        .subscribe()
    }

    const openHomework = (notification) => {
      try {
        const params = new URLSearchParams({
          subject: notification.subject,
          homework_id: notification.homework_id,
          view_mode: 'tutor',
          student_id: notification.student_id
        });
        
        window.open(`/homework.html?${params.toString()}`, '_blank');
      } catch (error) {
        console.error('Ошибка открытия домашнего задания:', error);
        alert('Не удалось открыть домашнее задание.');
      }
    };

    const openStudentHomework = async (notification) => {
      try {
        // Получаем полные данные о студенте
        const { data: studentData, error: studentError } = await supabase
          .from('personalities')
          .select('first_name, last_name, email, phone')
          .eq('user_id', notification.student_id)
          .single();

        if (studentError) {
          console.error('Ошибка загрузки данных студента:', studentError);
          return;
        }

        // Получаем баллы студента
        const subjectKey = getSubjectKey(notification.subject);
        const examType = getExamType(notification.subject);
        let score = 0;
        
        if (subjectKey && examType) {
          const ratingTable = `${subjectKey}_${examType}_rating`;
          const { data: ratingData } = await supabase
            .from(ratingTable)
            .select('total_score')
            .eq('user_id', notification.student_id)
            .single();
            
          score = ratingData?.total_score || 0;
        }

        // Создаем объект студента
        const student = {
          user_id: notification.student_id,
          first_name: studentData.first_name,
          last_name: studentData.last_name,
          email: studentData.email,
          phone: studentData.phone,
          score: score
        };

        // Получаем subject и examType из уведомления
        const [subject, examTypeFromSubject] = notification.subject.split('_');
        
        // Устанавливаем данные для отображения компонента StudentHomework
        selectedStudent.value = student;
        selectedSubject.value = subject;
        selectedExamType.value = examTypeFromSubject;

        // Блокируем прокрутку фона
        document.body.style.overflow = 'hidden';

      } catch (error) {
        console.error('Ошибка открытия домашних работ студента:', error);
        alert('Не удалось открыть домашние работы студента.');
      }
    };

    const closeStudentHomework = () => {
      selectedStudent.value = null;
      selectedSubject.value = '';
      selectedExamType.value = '';
      // Восстанавливаем прокрутку фона
      document.body.style.overflow = 'auto';
    };

    const getSubjectKey = (subjectName) => {
      if (subjectName.includes('biology')) return 'biology';
      if (subjectName.includes('chemistry')) return 'chemistry';
      return '';
    };

    const getExamType = (subjectName) => {
      if (subjectName.includes('_ege')) return 'ege';
      if (subjectName.includes('_oge')) return 'oge';
      return '';
    };

    const markAsRead = async (notificationId) => {
      try {
        const { error } = await supabase
          .from('homework_notifications')
          .update({ is_read: true })
          .eq('id', notificationId)

        if (error) {
          console.error('Ошибка при обновлении уведомления:', error)
          return
        }

        const notification = notifications.value.find(n => n.id === notificationId)
        if (notification) {
          notification.is_read = true
        }
      } catch (error) {
        console.error('Ошибка:', error)
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString('ru-RU')
    }

    const getSubjectName = (subjectCode) => {
      const subjects = {
        'biology_ege': 'Биология ЕГЭ',
        'chemistry_ege': 'Химия ЕГЭ',
        'biology_oge': 'Биология ОГЭ',
        'chemistry_oge': 'Химия ОГЭ'
      }
      return subjects[subjectCode] || subjectCode
    }

    onMounted(async () => {
      await loadNotifications(false)
      await subscribeToRealtime()
    })

    onUnmounted(() => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription)
      }
      // Восстанавливаем прокрутку при размонтировании
      document.body.style.overflow = 'auto';
    })

    return {
      notifications,
      loading,
      loadingMore,
      hasMoreNotifications,
      selectedStudent,
      selectedSubject,
      selectedExamType,
      openHomework,
      openStudentHomework,
      closeStudentHomework,
      markAsRead,
      loadMoreNotifications,
      formatDate,
      getSubjectName
    }
  }
}
</script>

<style scoped>
.tutor-notifications {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
}

.loading, .no-notifications {
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
}

.notifications-container {
  margin-bottom: 20px;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.notification-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  transition: all 0.2s ease;
}

.notification-item.new {
  border-left: 4px solid #4CAF50;
  background-color: #f8fff8;
}

.notification-content {
  flex-grow: 1;
  margin-right: 15px;
}

.notification-content p {
  margin: 0 0 8px 0;
  font-size: 1.1em;
  line-height: 1.4;
}

.student-name-link {
  color: #b241d1;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.3s ease;
}

.student-name-link:hover {
  color: #9a30b8;
  text-decoration: none;
}

.notification-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.9em;
  color: #666;
}

.timestamp {
  font-style: italic;
}

.score {
  font-weight: 500;
  color: #2196F3;
}

.payment-status {
  font-weight: 500;
  font-size: 0.85em;
}

.notification-actions {
  display: flex;
  gap: 8px;
  flex-direction: column;
  align-items: flex-end;
}

.view-homework-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  background-color: #b241d1;
  color: white;
  transition: background-color 0.3s ease;
}

.view-homework-btn:hover {
  background-color: #9a30b8;
}

.mark-read-btn {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  background-color: #e8f5e8;
  color: #2e7d32;
}

.mark-read-btn:hover {
  background-color: #d4ecd4;
}

.load-more-container {
  text-align: center;
  margin-top: 20px;
}

.load-more-btn {
  padding: 10px 20px;
  border: 1px solid #b241d1;
  border-radius: 6px;
  background-color: white;
  color: #b241d1;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.3s ease;
}

.load-more-btn:hover:not(:disabled) {
  background-color: #b241d1;
  color: white;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Стили для модального окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 12px;
  width: 95%;
  height: 95%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #b241d1 0%, #9a30b8 100%);
  color: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5em;
}

.student-name {
  color: #ffeb3b;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5em;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 0;
}

/* Стили для компонента StudentHomework внутри модального окна */
.modal-content :deep(.homework-container) {
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.modal-content :deep(.student-info) {
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-container {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
  
  .modal-header {
    padding: 15px;
  }
  
  .modal-header h2 {
    font-size: 1.2em;
  }
  
  .notification-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .notification-content {
    margin-right: 0;
    margin-bottom: 15px;
  }
  
  .notification-actions {
    flex-direction: row;
    align-self: stretch;
    justify-content: space-between;
  }
}
</style>