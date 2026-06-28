<script>
import { supabase } from '../supabase';
import TeacherTaskCard from './TeacherTaskCard.vue';

export default {
  name: 'TeacherTaskList',
  components: {
    TeacherTaskCard
  },
  props: {
    filters: {
      type: Object,
      required: true,
      default: () => ({})
    },
    homeworkId: {
      type: Number,
      required: true
    },
    homeworkName: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    examType: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      allTasks: [],
      loading: false,
      error: null,
      user: null,
      visibleCount: 50,
      scrollThreshold: 200,
      homeworkTaskIds: new Set(),
      homeworkTaskData: {}
    };
  },
  computed: {
    filteredTasks() {
      if (!this.filters.subject) return [];
      
      const partConfig = {
        'Химия ЕГЭ': { firstPartMax: 28 },
        'Биология ЕГЭ': { firstPartMax: 21 },
        'Химия ОГЭ': { firstPartMax: 19 },
        'Биология ОГЭ': { firstPartMax: 21 }
      };  
      
      const config = partConfig[this.filters.subject];
      
      let tasks = this.allTasks.filter(task => {
        if (this.filters.sections && this.filters.sections.length > 0 && 
            !this.filters.sections.includes(task.section)) {
          return false;
        }
        
        if (this.filters.topics && this.filters.topics.length > 0 && 
            !this.filters.topics.includes(task.topic)) {
          return false;
        }
        
        if (this.filters.part && config) {
          const taskPart = task.number <= config.firstPartMax 
            ? 'Первая часть' 
            : 'Вторая часть';
          
          if (taskPart !== this.filters.part) return false;
        }
        
        if (this.filters.taskNumber && this.filters.taskNumber.length > 0) {
          const taskNumbers = this.filters.taskNumber.map(num => String(num));
          
          if (!taskNumbers.includes(String(task.number))) {
            return false;
          }
        }
        
        if (this.filters.difficulty && 
            ['easy', 'medium', 'hard'].includes(this.filters.difficulty)) {
          const taskDiff = task.difficulty || 2;
          switch(this.filters.difficulty) {
            case 'easy': if (taskDiff !== 1) return false; break;
            case 'medium': if (taskDiff !== 2) return false; break;
            case 'hard': if (taskDiff !== 3) return false; break;
          }
        }
        
        return true;
      });

      // Сортировка: сначала задания из домашки, потом остальные
      tasks = tasks.sort((a, b) => {
        const aInHomework = this.homeworkTaskIds.has(a.id);
        const bInHomework = this.homeworkTaskIds.has(b.id);
        
        if (aInHomework === bInHomework) {
          return a.number - b.number;
        }
        
        return aInHomework ? -1 : 1;
      });

      if (this.filters.difficulty === 'asc') {
        tasks = tasks.sort((a, b) => {
          const diffA = a.difficulty || 2;
          const diffB = b.difficulty || 2;
          return diffA - diffB;
        });
      } else if (this.filters.difficulty === 'desc') {
        tasks = tasks.sort((a, b) => {
          const diffA = a.difficulty || 2;
          const diffB = b.difficulty || 2;
          return diffB - diffA;
        });
      }

      return tasks;
    },
    
    visibleTasks() {
      return this.filteredTasks.slice(0, this.visibleCount);
    },
    
    hasMoreTasks() {
      return this.visibleCount < this.filteredTasks.length;
    }
  },
  watch: {
    'filters.subject': {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.fetchTasks();
          this.fetchHomeworkTasks();
          this.resetPagination();
        } else {
          this.allTasks = [];
          this.resetPagination();
        }
      }
    },
    filteredTasks() {
      this.resetPagination();
    }
  },
  methods: {
    getTableConfig(subject) {
      const configs = {
        'Химия ЕГЭ': {
          taskTable: 'chemistry_ege_task_bank',
          progressTable: 'chemistry_ege_progress',
          firstPartMax: 28
        },
        'Биология ЕГЭ': {
          taskTable: 'biology_ege_task_bank',
          progressTable: 'biology_ege_progress',
          firstPartMax: 21
        },
        'Химия ОГЭ': {
          taskTable: 'chemistry_oge_task_bank',
          progressTable: 'chemistry_oge_progress',
          firstPartMax: 19
        },
        'Биология ОГЭ': {
          taskTable: 'biology_oge_task_bank',
          progressTable: 'biology_oge_progress',
          firstPartMax: 24
        }
      };
      
      return configs[subject];
    },
    
    resetPagination() {
      this.visibleCount = 50;
    },
    
    async fetchTasks() {
      this.loading = true;
      this.error = null;
      
      try {
        const tableConfig = this.getTableConfig(this.filters.subject);
        
        if (!tableConfig) {
          throw new Error('Неизвестный предмет');
        }

        let allTasks = [];
        let from = 0;
        let to = 999;
        const batchSize = 1000;

        while (true) {
          const { data: tasksBatch, error: tasksError } = await supabase
            .from(tableConfig.taskTable)
            .select('*')
            .range(from, to);
          
          if (tasksError) throw tasksError;
          
          if (tasksBatch && tasksBatch.length > 0) {
            allTasks = [...allTasks, ...tasksBatch];
          }
          
          if (!tasksBatch || tasksBatch.length < batchSize) {
            break;
          }
          
          from += batchSize;
          to += batchSize;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.allTasks = allTasks.map(task => ({
          ...task,
          subject: this.filters.subject,
          difficulty: task.difficulty || 2,
          isInHomework: this.homeworkTaskIds.has(task.id),
          homeworkTaskNumber: this.homeworkTaskData[task.id]?.number || null,
          homeworkTaskId: this.homeworkTaskData[task.id]?.id || null
        }));
        
      } catch (err) {
        console.error('Ошибка загрузки заданий:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

async fetchHomeworkTasks() {
  try {
    const homeworkTableName = `${this.subject}_${this.examType}_homework_tasks`;
    
    console.log('📡 Запрос к таблице:', homeworkTableName);
    console.log('📡 homeworkId:', this.homeworkId);
    
    const { data, error } = await supabase
      .from(homeworkTableName)
      .select('task_id, number')  // ← убрал id, так как его нет
      .eq('homework_id', this.homeworkId);
    
    if (error) {
      console.error('❌ Ошибка загрузки заданий домашней работы:', error);
      this.homeworkTaskIds = new Set();
      this.homeworkTaskData = {};
      return;
    }
    
    console.log('✅ Загружено заданий в домашке:', data?.length || 0);
    
    this.homeworkTaskIds = new Set();
    this.homeworkTaskData = {};
    
    if (data) {
      data.forEach(item => {
        this.homeworkTaskIds.add(item.task_id);
        this.homeworkTaskData[item.task_id] = {
          number: item.number
        };
      });
    }
    
    this.allTasks = this.allTasks.map(task => ({
      ...task,
      isInHomework: this.homeworkTaskIds.has(task.id),
      homeworkTaskNumber: this.homeworkTaskData[task.id]?.number || null,
      homeworkTaskId: this.homeworkTaskData[task.id]?.id || null
    }));
    
  } catch (err) {
    console.warn('⚠️ Ошибка загрузки заданий домашней работы:', err.message);
    this.homeworkTaskIds = new Set();
    this.homeworkTaskData = {};
  }
},
    
    loadMoreTasks() {
      if (this.hasMoreTasks) {
        this.visibleCount += 50;
      }
    },
    
    handleScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (scrollTop + windowHeight >= documentHeight - this.scrollThreshold) {
        this.loadMoreTasks();
      }
    },
    
    handleTaskAdded(taskId) {
      this.homeworkTaskIds.add(taskId);
      this.allTasks = this.allTasks.map(task => ({
        ...task,
        isInHomework: task.id === taskId ? true : task.isInHomework
      }));
      this.$emit('task-added', taskId);
    },

  handleTaskRemoved(taskId) {
  this.homeworkTaskIds.delete(taskId);
  delete this.homeworkTaskData[taskId];
  
  // Обновляем данные в allTasks
  this.allTasks = this.allTasks.map(task => ({
    ...task,
    isInHomework: task.id === taskId ? false : task.isInHomework,
    homeworkTaskNumber: task.id === taskId ? null : task.homeworkTaskNumber
  }));
  
  // Обновляем номера в homeworkTaskData на основе текущих данных
  this.updateHomeworkNumbers();
  
  this.$emit('task-removed', taskId);
},

async updateHomeworkNumbers() {
  try {
    const homeworkTableName = `${this.subject}_${this.examType}_homework_tasks`;
    
    const { data, error } = await supabase
      .from(homeworkTableName)
      .select('task_id, number')
      .eq('homework_id', this.homeworkId)
      .order('number', { ascending: true });
    
    if (error) throw error;
    if (!data) return;
    
    // Обновляем homeworkTaskData с новыми номерами
    const newTaskData = {};
    data.forEach(item => {
      newTaskData[item.task_id] = {
        number: item.number
      };
    });
    this.homeworkTaskData = newTaskData;
    
    // Обновляем allTasks с новыми номерами
    this.allTasks = this.allTasks.map(task => ({
      ...task,
      homeworkTaskNumber: this.homeworkTaskData[task.id]?.number || null
    }));
    
  } catch (error) {
    console.error('Ошибка обновления номеров:', error);
  }
},
    
    handleTaskUpdated(updatedTask) {
      const index = this.allTasks.findIndex(t => t.id === updatedTask.id);
      if (index !== -1) {
        this.allTasks[index] = { 
          ...updatedTask, 
          subject: this.filters.subject,
          isInHomework: this.homeworkTaskIds.has(updatedTask.id),
          homeworkTaskNumber: this.homeworkTaskData[updatedTask.id]?.number || null,
          homeworkTaskId: this.homeworkTaskData[updatedTask.id]?.id || null
        };
      }
      this.$emit('task-updated', updatedTask);
    },
    
    handleTaskDeleted(taskId) {
      this.allTasks = this.allTasks.filter(t => t.id !== taskId);
      this.homeworkTaskIds.delete(taskId);
      delete this.homeworkTaskData[taskId];
      this.$emit('task-deleted', taskId);
    }
  },
  mounted() {
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
  }
};
</script>

<template>
  <div class="task-list-container">
    <div v-if="loading" class="loading-indicator">Загрузка заданий...</div>
    
    <div v-else>
      <div v-if="filteredTasks.length > 0" class="tasks-info">
        <span class="homework-count">
          В домашке: {{ filteredTasks.filter(t => t.isInHomework).length }} заданий
        </span>
        <span class="total-count">
          Всего в банке: {{ filteredTasks.length }} заданий
        </span>
      </div>

      <div v-if="error" class="error-message">
        ⚠️ {{ error }}
        <button @click="fetchTasks" class="retry-btn">Повторить</button>
      </div>

      <div v-if="filteredTasks.length === 0 && !loading && !error" class="no-tasks">
        Задания не найдены. Попробуйте изменить параметры фильтрации.
      </div>
      
      <div v-else class="tasks-list">
        <TeacherTaskCard 
          v-for="task in visibleTasks" 
          :key="task.id" 
          :task="task"
          :user="user"
          :homework-id="homeworkId"
          :homework-name="homeworkName"
          :subject="subject"
          :exam-type="examType"
          :is-in-homework="task.isInHomework"
          @task-added="handleTaskAdded"
          @task-removed="handleTaskRemoved"
          @task-updated="handleTaskUpdated"
          @task-deleted="handleTaskDeleted"
        />
        
        <div v-if="hasMoreTasks" class="load-more-container">
          <button @click="loadMoreTasks" class="load-more-button">
            Показать еще задания ({{ visibleCount }}/{{ filteredTasks.length }})
          </button>
        </div>
        
        <div v-else-if="filteredTasks.length > 0" class="all-loaded">
          Все задания загружены ({{ filteredTasks.length }})
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-list-container {
  padding: 1rem 5%;
  width: 100%;
  margin: 0px;
  box-sizing: border-box;
}

.tasks-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  margin-bottom: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  flex-wrap: wrap;
  gap: 8px;
}

.homework-count {
  font-weight: 600;
  color: #b241d1;
}

.total-count {
  color: #6c757d;
  font-size: 0.9em;
}

.error-message {
  padding: 12px 16px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.retry-btn {
  padding: 4px 12px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #9a36b8;
}

.loading-indicator,
.no-tasks {
  text-align: center;
  padding: 2.5rem;
  font-size: 1.2rem;
  color: #666;
}

.no-tasks {
  border: 1px dashed #b241d1;
  border-radius: 0.5rem;
  margin: 0 5%;
  width: 90%;
  box-sizing: border-box;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  padding: 1rem;
}

.load-more-button {
  padding: 0.75rem 1.5rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.load-more-button:hover {
  background-color: #9a36b8;
}

.all-loaded {
  text-align: center;
  padding: 1.5rem;
  color: #666;
  font-style: italic;
}

@media (max-width: 48rem) {
  .task-list-container {
    padding: 1rem 3%;
    width: 94%;
  }
  
  .tasks-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .error-message {
    flex-direction: column;
    text-align: center;
  }
  
  .loading-indicator,
  .no-tasks {
    padding: 1.5rem;
  }
  
  .load-more-button {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }
}
</style>