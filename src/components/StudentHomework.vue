<template>
  <div class="homework-container">
    <div class="student-info">
      <h2>Домашние работы ученика</h2>
      <div class="student-details">
        <p><strong>Имя:</strong> {{ student.first_name }} {{ student.last_name }}</p>
        <p><strong>Email:</strong> {{ student.email }}</p>
        <p><strong>Телефон:</strong> {{ student.phone }}</p>
        <p><strong>Общий балл:</strong> <span class="total-score">{{ student.score }}</span></p>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка домашних работ...</div>
    
    <div v-if="error" class="error">
      Ошибка: {{ error }}
      <button @click="loadHomework" class="retry-btn">Повторить</button>
    </div>
    
    <div v-if="homework.length > 0" class="homework-list">
      <h3>Выполненные домашние работы</h3>
      
      <div class="homework-grid">
        <div 
          v-for="hw in homework" 
          :key="hw.homework_id" 
          class="homework-card"
          :class="{ 'completed': hw.is_completed, 'not-completed': !hw.is_completed }"
        >
          <div class="homework-header">
            <h4>{{ hw.homework_name || `Домашняя работа #${hw.homework_id}` }}</h4>
            <span class="status-badge" :class="hw.is_completed ? 'completed' : 'not-completed'">
              {{ hw.is_completed ? 'Выполнено' : 'Не выполнено' }}
            </span>
          </div>
          
          <div class="homework-details">
            <p><strong>Урок:</strong> {{ hw.lesson_number }}. {{ hw.lesson_name }}</p>
            <p><strong>Время сдачи:</strong> {{ formatDate(hw.completed_at) }}</p>
            <p v-if="hw.is_completed"><strong>Баллы:</strong> <span class="score">{{ hw.score || 0 }}/{{ hw.max_score }}</span></p>
            <p v-else><strong>Баллы:</strong> -</p>
          </div>
          
          <div class="homework-actions">
            <button 
              v-if="hw.is_completed" 
              @click="viewHomeworkDetails(hw)"
              class="view-btn"
            >
              Посмотреть детали
            </button>
            <button v-else class="not-completed-btn" disabled>
              Ожидает выполнения
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для просмотра домашней работы -->
    <div v-if="selectedHomework" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Домашняя работа: {{ selectedHomework.homework_name }}</h3>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <iframe 
            :src="getHomeworkViewUrl(selectedHomework)" 
            class="homework-iframe"
            frameborder="0"
          ></iframe>
        </div>
      </div>
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
    }
  },
  data() {
    return {
      homework: [],
      loading: false,
      error: null,
      selectedHomework: null
    }
  },
  async mounted() {
    await this.loadHomework();
  },
  methods: {
async loadHomework() {
  this.loading = true;
  this.error = null;
  
  try {
    const homeworkTable = `${this.subject}_ege_homework_completed`;
    const homeworkListTable = `${this.subject}_ege_homework_list`;
    
    // Первый запрос: получаем выполненные домашние работы
    const { data: completedHomework, error: completedError } = await supabase
      .from(homeworkTable)
      .select('*')
      .eq('user_id', this.student.user_id)
      .order('completed_at', { ascending: false });

    if (completedError) throw completedError;

    // Второй запрос: получаем список всех домашних работ
    const { data: homeworkList, error: listError } = await supabase
      .from(homeworkListTable)
      .select('*');

    if (listError) throw listError;

    // Объединяем данные вручную
    this.homework = (completedHomework || []).map(item => {
      const homeworkInfo = homeworkList?.find(hw => hw.homework_id === item.homework_id) || {};
      
      return {
        ...item,
        homework_name: homeworkInfo.homework_name,
        lesson_number: homeworkInfo.lesson_number,
        lesson_name: homeworkInfo.lesson_name,
        max_score: homeworkInfo.max_score
      };
    });

  } catch (error) {
    console.error('Ошибка загрузки домашних работ:', error);
    this.error = 'Не удалось загрузить домашние работы';
    
    if (error.code === 'PGRST200') {
      this.error += '. Отсутствует связь между таблицами домашних работ.';
    }
  } finally {
    this.loading = false;
  }
},

    getHomeworkViewUrl(homework) {
      // Генерируем URL для просмотра домашней работы
      return `/Homework.html?subject=${this.subject}_ege&homework_id=${homework.homework_id}&view_mode=tutor&student_id=${this.student.user_id}`;
    },

    viewHomeworkDetails(homework) {
      this.selectedHomework = homework;
    },

    closeModal() {
      this.selectedHomework = null;
    },

    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  },
  watch: {
    student: {
      handler() {
        this.loadHomework();
      },
      deep: true
    },
    subject: {
      handler() {
        this.loadHomework();
      }
    }
  }
}
</script>

<style scoped>
/* Стили остаются без изменений */
</style>

<style scoped>
*{
    font-family: Evolventa;
}
.homework-container {
  padding: 20px;
}

.student-info {
  background-color: #b241d1;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  border: 1px solid #e8d4f2;
  color: white;
}

.student-info h2 {
  margin: 0 0 20px 0;
  color: white;
  font-weight: 600;
}

.student-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  color: white;
}

.student-details p {
  margin: 0;
  color: white;  font-size: 15px;
}

.total-score {
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.homework-list h3 {
  margin-bottom: 25px;
  color: #7e3f9d;
  font-weight: 600;
}

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
  border-left: 4px solid;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.homework-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(178, 65, 209, 0.15);
}

.homework-card.completed {
  border-left-color: #b241d1;
}

.homework-card.not-completed {
  border-left-color: #dc3545;
}

.homework-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.homework-header h4 {
  margin: 0;
  color: #5a2875;
  font-weight: 600;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.completed {
  background-color: #f0e6f7;
  color: #b241d1;
  border: 1px solid #d8b4e7;
}

.status-badge.not-completed {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.homework-details {
  margin-bottom: 20px;
}

.homework-details p {
  margin: 8px 0;
  color: #6b7280;
  font-size: 14px;
}

.score {
  color: #b241d1;
  font-weight: 600;
  font-size: 15px;
}

.homework-actions {
  display: flex;
  justify-content: flex-end;
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

.not-completed-btn {
  background-color: #f3f4f6;
  color: #9ca3af;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #b241d1;
  font-size: 16px;
}

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
  transition: background-color 0.3s ease;
}

.retry-btn:hover {
  background-color: #9a30b8;
}

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
  .student-details {
    grid-template-columns: 1fr;
  }
  
  .homework-grid {
    grid-template-columns: 1fr;
  }
  
  .homework-header {
    flex-direction: column;
    gap: 10px;
  }
  
  .status-badge {
    align-self: flex-start;
  }
  
  .homework-actions {
    justify-content: center;
  }
}
</style>
<style scoped>
/* Добавляем стили для модального окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 5px;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  flex: 1;
  padding: 0;
}

.homework-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Остальные стили остаются без изменений */
</style>