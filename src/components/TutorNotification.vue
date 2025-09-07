<template>
  <div class="tutor-notifications">
    <h2>Уведомления о сданных домашних заданиях</h2>
    
    <div v-if="loading" class="loading">
      Загрузка уведомлений...
    </div>
    
    <div v-else-if="notifications.length === 0" class="no-notifications">
      Новых уведомлений нет
    </div>
    
    <div v-else class="notifications-list">
      <div 
        v-for="notification in notifications" 
        :key="notification.id" 
        class="notification-item"
        :class="{ 'new': !notification.is_read }"
      >
        <div class="notification-content">
          <p>
            Ученик <strong>{{ notification.student_first_name }} {{ notification.student_last_name }}</strong>
            сдал домашку по <strong>{{ getSubjectName(notification.subject) }}</strong>
          </p>
          <div class="notification-meta">
            <span class="timestamp">{{ formatDate(notification.completed_at) }}</span>
            <span v-if="notification.score !== null" class="score">
              Оценка: {{ notification.score }}
            </span>
            <span class="tutor-name">Для куратора: "{{ notification.tutor_name }}"</span>
          </div>
        </div>
        <div class="notification-actions">
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

    <!-- Отладочная информация -->

  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

export default {
  name: 'TutorNotification',
  setup() {
    const notifications = ref([])
    const loading = ref(true)
    let realtimeSubscription = null
    const currentTutorName = ref('')
    const searchNames = ref([])

    // Функция для получения имени текущего куратора
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

    // Функция для генерации вариантов поиска
    const generateSearchNames = (fullName) => {
      const names = []
      
      // Извлекаем только имя (первое слово)
      const firstName = fullName.split(' ')[0] || fullName
      
      // Добавляем варианты:
      names.push(firstName) // "Ольга"
      names.push(firstName + ' ') // "Ольга " (с пробелом)
      
      // Также добавляем полное имя на случай, если где-то оно используется
      names.push(fullName)
      names.push(fullName + ' ')
      
      // Убираем дубликаты
      return [...new Set(names.filter(name => name && name.trim()))]
    }

    // Функция для загрузки уведомлений
    const loadNotifications = async () => {
      try {
        loading.value = true
        // Получаем имя текущего куратора
        const tutorName = await getCurrentTutorName()
        currentTutorName.value = tutorName
        
        if (!tutorName) {
          console.log('Имя куратора не найдено')
          return
        }

        // Генерируем варианты для поиска
        const namesToSearch = generateSearchNames(tutorName)
        searchNames.value = namesToSearch
        console.log('Варианты для поиска:', namesToSearch)

        // Создаем запросы для каждого варианта имени
        const promises = namesToSearch.map(name => 
          supabase
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
            `)
            .eq('tutor_name', name)
            .order('completed_at', { ascending: false })
        )

        // Выполняем все запросы параллельно
        const results = await Promise.all(promises)
        
        // Объединяем результаты и убираем дубликаты
        const allNotifications = results.flatMap(result => result.data || [])
        const uniqueNotifications = allNotifications.filter((notification, index, array) => 
          index === array.findIndex(n => n.id === notification.id)
        )

        console.log('Все найденные уведомления:', uniqueNotifications)

        // Форматируем данные для отображения
        notifications.value = uniqueNotifications.map(notification => ({
          id: notification.id,
          student_id: notification.student_id,
          homework_id: notification.homework_id,
          subject: notification.subject,
          completed_at: notification.completed_at,
          score: notification.score,
          is_read: notification.is_read,
          tutor_name: notification.tutor_name,
          student_first_name: notification.students?.first_name || 'Неизвестный',
          student_last_name: notification.students?.last_name || 'ученик'
        }))
      } catch (error) {
        console.error('Ошибка:', error)
      } finally {
        loading.value = false
      }
    }

    // Альтернативный метод с использованием ILIKE и OR
    const loadNotificationsAlternative = async () => {
      try {
        loading.value = true
        const tutorName = await getCurrentTutorName()
        currentTutorName.value = tutorName
        
        if (!tutorName) return

        const firstName = tutorName.split(' ')[0] || tutorName
        searchNames.value = [firstName, firstName + ' ', tutorName, tutorName + ' ']
        
        // Создаем сложный запрос с OR условиями
        let query = supabase
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
          `)

        // Добавляем условия OR для каждого варианта
        searchNames.value.forEach(name => {
          query = query.or(`tutor_name.eq.${name}`)
        })

        const { data, error } = await query
          .order('completed_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Ошибка загрузки уведомлений:', error)
          return
        }

        console.log('Уведомления (альтернативный метод):', data)
        
        notifications.value = data.map(notification => ({
          id: notification.id,
          student_id: notification.student_id,
          homework_id: notification.homework_id,
          subject: notification.subject,
          completed_at: notification.completed_at,
          score: notification.score,
          is_read: notification.is_read,
          tutor_name: notification.tutor_name,
          student_first_name: notification.students?.first_name || 'Неизвестный',
          student_last_name: notification.students?.last_name || 'ученик'
        }))
      } catch (error) {
        console.error('Ошибка:', error)
      } finally {
        loading.value = false
      }
    }

    // Тестовый запрос к базе данных
    const testDatabaseQuery = async () => {
      try {
        console.log('Выполняем тестовый запрос...')
        
        // Получаем все уведомления чтобы посмотреть структуру данных
        const { data, error } = await supabase
          .from('homework_notifications')
          .select('tutor_name')
          .limit(20)

        if (error) {
          console.error('Ошибка тестового запроса:', error)
          return
        }

        // Группируем по значениям tutor_name
        const tutorNames = {}
        data.forEach(item => {
          const name = item.tutor_name || 'NULL'
          tutorNames[name] = (tutorNames[name] || 0) + 1
        })

        console.log('Уникальные значения tutor_name:', tutorNames)
        alert('Проверьте консоль для просмотра уникальных значений tutor_name')
        
      } catch (error) {
        console.error('Ошибка:', error)
      }
    }

    // Показать все уведомления (для отладки)
    const checkAllNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('homework_notifications')
          .select('*')
          .limit(20)

        if (error) {
          console.error('Ошибка:', error)
          return
        }

        console.log('Все уведомления:', data)
        alert(`Всего уведомлений: ${data.length}\nПроверьте консоль для деталей`)
      } catch (error) {
        console.error('Ошибка:', error)
      }
    }

    // Функция для подписки на реальные обновления
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
            console.log('Получено реальное обновление:', payload.new.tutor_name)
            // Перезагружаем уведомления при любом новом добавлении
            loadNotifications()
          }
        )
        .subscribe((status) => {
          console.log('Статус подписки:', status)
        })
    }

    // Функция для отметки уведомления как прочитанного
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

        // Обновляем локальное состояние
        const notification = notifications.value.find(n => n.id === notificationId)
        if (notification) {
          notification.is_read = true
        }
      } catch (error) {
        console.error('Ошибка:', error)
      }
    }

    // Форматирование даты
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString('ru-RU')
    }

    // Получение читаемого названия предмета
    const getSubjectName = (subjectCode) => {
      const subjects = {
        'biology_ege': 'Биология',
        'chemistry_ege': 'Химия'
      }
      return subjects[subjectCode] || subjectCode
    }

    onMounted(async () => {
      await loadNotifications()
      // Если не нашли уведомлений, пробуем альтернативный метод
      if (notifications.value.length === 0) {
        console.log('Пробуем альтернативный метод поиска...')
        await loadNotificationsAlternative()
      }
      await subscribeToRealtime()
    })

    onUnmounted(() => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription)
      }
    })

    return {
      notifications,
      loading,
      currentTutorName,
      searchNames,
      markAsRead,
      formatDate,
      getSubjectName,
      loadNotifications,
      testDatabaseQuery,
      checkAllNotifications
    }
  }
}
</script>

<style scoped>
/* Стили остаются такими же как в предыдущем варианте */
.tutor-notifications {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .no-notifications {
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
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

.tutor-name {
  color: #888;
  font-size: 0.8em;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.mark-read-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  background-color: #e8f5e8;
  color: #2e7d32;
}

.mark-read-btn:hover {
  background-color: #d4ecd4;
}

.debug-info {
  margin-top: 30px;
  padding: 15px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.debug-info h3 {
  margin-top: 0;
  color: #666;
}

.debug-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.refresh-btn, .test-btn, .check-btn {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f0f0f0;
  cursor: pointer;
  font-size: 0.9em;
}

.refresh-btn:hover, .test-btn:hover, .check-btn:hover {
  background-color: #e0e0e0;
}

.test-btn {
  background-color: #e3f2fd;
  border-color: #bbdefb;
}

.check-btn {
  background-color: #fff3e0;
  border-color: #ffe0b2;
}
</style>