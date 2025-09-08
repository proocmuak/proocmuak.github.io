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
      <h3>Домашние работы</h3>
      
      <div class="homework-grid">
        <div 
          v-for="hw in homework" 
          :key="hw.homework_id" 
          class="homework-card"
          :class="{ 
            'completed': hw.is_completed, 
            'not-completed': !hw.is_completed,
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
            <p><strong>Макс. баллов:</strong> {{ hw.max_score }}</p>
            <p v-if="hw.is_completed">
              <strong>Набрано баллов:</strong> 
              <span class="score">{{ hw.total_score || 0 }}</span>
              <span class="completion-percentage">({{ hw.completionPercentage }}%)</span>
            </p>
            <p v-if="hw.is_completed">
              <strong>Время сдачи:</strong> {{ formatDate(hw.last_completed_at) }}
            </p>
            <p v-else><strong>Статус:</strong> Ожидает выполнения</p>
          </div>
          
          <div class="homework-actions">
            <button 
              @click="openHomeworkSimple(hw)"
              class="view-btn"
            >
              {{ hw.is_completed ? 'Посмотреть детали' : 'Открыть задание' }}
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

    <div v-if="!loading && homework.length === 0" class="no-data">
      Нет домашних работ для отображения
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
      loading: false,
      error: null
    }
  },
  async mounted() {
    await this.loadHomework();
  },
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
      loading: false,
      error: null
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
        const homeworkTable = `${this.subject}_${this.examType.toLowerCase()}_homework_completed`;
        const homeworkListTable = `${this.subject}_${this.examType.toLowerCase()}_homework_list`;
        const progressTable = `${this.subject}_${this.examType.toLowerCase()}_progress`;
        const homeworkTasksTable = `${this.subject}_${this.examType.toLowerCase()}_homework_tasks`;
        const taskBankTable = `${this.subject}_${this.examType.toLowerCase()}_task_bank`;

        // Получаем список всех домашних работ
        const { data: homeworkList, error: listError } = await supabase
          .from(homeworkListTable)
          .select('*')
          .order('lesson_number', { ascending: true });

        if (listError) throw listError;

        // Получаем статусы завершения домашних работ
        const { data: completedHomework, error: completedError } = await supabase
          .from(homeworkTable)
          .select('homework_id, is_completed, score, completed_at')
          .eq('user_id', this.student.user_id);

        if (completedError) throw completedError;

        // Для каждой домашней работы получаем максимальный балл из заданий
        const homeworkWithMaxScores = await Promise.all(
          homeworkList.map(async (homeworkItem) => {
            // Получаем все задания для этой домашней работы
            const { data: homeworkTasks, error: tasksError } = await supabase
              .from(homeworkTasksTable)
              .select('task_id')
              .eq('homework_id', homeworkItem.homework_id);

            if (tasksError) throw tasksError;

            if (!homeworkTasks || homeworkTasks.length === 0) {
              return {
                ...homeworkItem,
                max_score: 0
              };
            }

            // Получаем баллы для всех заданий
            const taskIds = homeworkTasks.map(task => task.task_id);
            const { data: tasksData, error: tasksDataError } = await supabase
              .from(taskBankTable)
              .select('id, points')
              .in('id', taskIds);

            if (tasksDataError) throw tasksDataError;

            // Суммируем баллы всех заданий
            const maxScore = tasksData.reduce((sum, task) => sum + (task.points || 0), 0);

            return {
              ...homeworkItem,
              max_score: maxScore
            };
          })
        );

        // Создаем полный список домашних работ
        this.homework = homeworkWithMaxScores.map(homeworkItem => {
          const completionData = completedHomework?.find(hw => hw.homework_id === homeworkItem.homework_id);
          const isCompleted = completionData?.is_completed || false;
          
          const totalScore = completionData?.score || 0;
          const maxScore = homeworkItem.max_score || 1;
          const completionPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

          return {
            homework_id: homeworkItem.homework_id,
            homework_name: homeworkItem.homework_name,
            lesson_number: homeworkItem.lesson_number,
            lesson_name: homeworkItem.lesson_name,
            max_score: maxScore,
            is_completed: isCompleted,
            total_score: totalScore,
            last_completed_at: completionData?.completed_at,
            completionPercentage: completionPercentage,
            sendingRevision: false
          };
        });

      } catch (error) {
        console.error('Ошибка загрузки домашних работ:', error);
        this.error = 'Не удалось загрузить домашние работы';
      } finally {
        this.loading = false;
      }
    },
    // Адаптированная функция для открытия домашнего задания
    openHomeworkSimple(homework) {
      try {
        const subjectKey = this.subject;
        const examTypeKey = this.examType.toLowerCase();
        
        const params = new URLSearchParams({
          subject: `${subjectKey}_${examTypeKey}`,
          homework_id: homework.homework_id,
          homework_name: homework.homework_name || 'Домашнее задание',
          lesson_number: homework.lesson_number || '',
          lesson_name: homework.lesson_name || '',
          view_mode: 'tutor',
          student_id: this.student.user_id
        });
        
        // Открываем в новом окне/вкладке вместо перенаправления
        window.open(`/homework.html?${params.toString()}`, '_blank');
        
      } catch (error) {
        console.error('Ошибка открытия домашнего задания:', error);
        alert('Не удалось открыть домашнее задание.');
      }
    },

    async sendForRevision(homework) {
      if (!confirm(`Отправить "${homework.homework_name}" на переделывание?`)) return;

      homework.sendingRevision = true;

      try {
        // Удаляем запись о завершении домашней работы
        const homeworkTable = `${this.subject}_${this.examType.toLowerCase()}_homework_completed`;
        const { error: deleteError } = await supabase
          .from(homeworkTable)
          .delete()
          .eq('user_id', this.student.user_id)
          .eq('homework_id', homework.homework_id);

        if (deleteError) throw deleteError;

        await this.loadHomework();
        
        alert('Работа успешно отправлена на переделывание');

      } catch (error) {
        console.error('Ошибка отправки на переделывание:', error);
        alert('Не удалось отправить работу: ' + error.message);
      } finally {
        homework.sendingRevision = false;
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'Не указано';
      
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
  color: white;
  font-size: 15px;
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
  border-left-color: #6c757d;
}

.homework-card.low-score {
  border-left-color: #dc3545;
  background-color: #fff5f5;
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
  background-color: #f3f4f6;
  color: #6c757d;
  border: 1px solid #e5e7eb;
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

.completion-percentage {
  font-size: 12px;
  color: #6b7280;
  margin-left: 5px;
}

.homework-card.low-score .completion-percentage {
  color: #dc3545;
  font-weight: 600;
}

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

.revision-btn:disabled {
  opacity: 0.6;
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
    flex-direction: column;
  }
  
  .revision-btn {
    margin-top: 10px;
  }
}
</style>