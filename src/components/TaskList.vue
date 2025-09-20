<script>
import { supabase } from '../supabase';
import TaskCard from './TaskCard.vue';

export default {
  name: 'TaskList',
  components: {
    TaskCard
  },
  props: {
    filters: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  data() {
    return {
      allTasks: [],
      loading: false,
      error: null,
      user: null,
      visibleCount: 50,
      scrollThreshold: 200
    };
  },
  computed: {
    filteredTasks() {
      if (!this.filters.subject) return [];
      
      // Конфигурация для разных предметов
      const partConfig = {
        'Химия ЕГЭ': { firstPartMax: 28 },
        'Биология ЕГЭ': { firstPartMax: 21 }
      };
      
      const config = partConfig[this.filters.subject];
      
      let tasks = this.allTasks.filter(task => {
        // Фильтрация по предмету
        if (task.subject !== this.filters.subject) return false;
        
        // Фильтрация по статусу выполнения
        if (this.filters.showCompleted === 'only' && !task.progress.isCompleted) return false;
        if (this.filters.showCompleted === 'not' && task.progress.isCompleted) return false;
        
        // Фильтрация по разделам
        if (this.filters.sections && this.filters.sections.length > 0 && 
            !this.filters.sections.includes(task.section)) {
          return false;
        }
        
        // Фильтрация по темам
        if (this.filters.topics && this.filters.topics.length > 0 && 
            !this.filters.topics.includes(task.topic)) {
          return false;
        }
        
        // Фильтрация по части (универсальная)
        if (this.filters.part && config) {
          const isFirstPart = this.filters.part === 'Первая часть';
          const taskPart = task.number <= config.firstPartMax 
            ? 'Первая часть' 
            : 'Вторая часть';
          
          if (taskPart !== this.filters.part) return false;
        }
        
// Фильтрация по номеру задания
if (this.filters.taskNumber && this.filters.taskNumber.length > 0) {
  // Преобразуем фильтры в строки и сравниваем со строковым значением задачи
  const taskNumbers = this.filters.taskNumber.map(num => String(num));
  
  if (!taskNumbers.includes(String(task.number))) {
    return false;
  }
}
        
        return true;
      });

      // Сортировка по сложности
      if (this.filters.difficulty === 'asc') {
        tasks = [...tasks].sort((a, b) => {
          const diffA = a.difficulty || 2;
          const diffB = b.difficulty || 2;
          return diffA - diffB;
        });
      } else if (this.filters.difficulty === 'desc') {
        tasks = [...tasks].sort((a, b) => {
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
          this.fetchTasksWithProgress();
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
        }
      };
      
      return configs[subject];
    },
    
    resetPagination() {
      this.visibleCount = 50;
    },
    
    async fetchTasksWithProgress() {
      this.loading = true;
      this.error = null;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        this.user = user;
        
        // Определяем названия таблиц на основе предмета
        const tableConfig = this.getTableConfig(this.filters.subject);
        
        if (!tableConfig) {
          throw new Error('Неизвестный предмет');
        }

        // Загружаем все задания с пагинацией
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
          
          // Небольшая задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Загружаем прогресс
        let progress = {};
        if (user) {
          let allProgress = [];
          let progressFrom = 0;
          let progressTo = 999;
          
          while (true) {
            const { data: progressBatch, error: progressError } = await supabase
              .from(tableConfig.progressTable)
              .select('task_id, is_completed, score')
              .eq('user_id', user.id)
              .range(progressFrom, progressTo);
            
            if (progressError) throw progressError;
            
            if (progressBatch && progressBatch.length > 0) {
              allProgress = [...allProgress, ...progressBatch];
            }
            
            if (!progressBatch || progressBatch.length < batchSize) {
              break;
            }
            
            progressFrom += batchSize;
            progressTo += batchSize;
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          allProgress.forEach(item => {
            progress[item.task_id] = {
              isCompleted: item.is_completed,
              score: item.score
            };
          });
        }
        
        // Формируем итоговый массив заданий
        this.allTasks = allTasks.map(task => ({
          ...task,
          subject: this.filters.subject,
          progress: progress[task.id] || {
            isCompleted: false,
            score: 0
          },
          difficulty: task.difficulty || 2
        }));
        
      } catch (err) {
        console.error('Ошибка загрузки заданий:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    
    loadMoreTasks() {
      if (this.hasMoreTasks) {
        this.visibleCount += 50;
        console.log('Загружено заданий:', this.visibleCount, 'из', this.filteredTasks.length);
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
    
    selectTask(task) {
      this.$emit('task-selected', task);
    },
    
    handleAnswerChecked(result) {
      const taskIndex = this.allTasks.findIndex(t => t.id === result.taskId);
      if (taskIndex !== -1) {
        this.allTasks[taskIndex].progress = {
          isCompleted: result.isCorrect || result.isPartiallyCorrect,
          score: result.awardedPoints
        };
      }
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
      <div class="filters-info" v-if="filters.difficulty">
        Сортировка: {{ filters.difficulty === 'asc' ? 'сначала простые' : 'сначала сложные' }}
      </div>
      
      <div v-if="filteredTasks.length === 0" class="no-tasks">
        Задания не найдены. Попробуйте изменить параметры фильтрации.
      </div>
      
      <div v-else class="tasks-list">
        <TaskCard 
          v-for="task in visibleTasks" 
          :key="task.id" 
          :task="task"
          :user="user"
          @task-selected="selectTask"
          @answer-checked="handleAnswerChecked"
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

.filters-info {
  padding: 0.5rem 1rem;
  background-color: #f0f0f0;
  border-radius: 0.25rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #666;
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