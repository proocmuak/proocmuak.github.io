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
      required: true
    }
  },
  data() {
    return {
      allTasks: [],
      loading: false,
      error: null,
      user: null
    };
  },
  computed: {
    filteredTasks() {
      if (!this.filters.subject) return [];
      
      let tasks = this.allTasks.filter(task => {
        // Фильтрация по предмету
        if (task.subject !== this.filters.subject) return false;
        
        // Фильтрация по статусу выполнения
        if (this.filters.showCompleted === 'only' && !task.progress.isCompleted) return false;
        if (this.filters.showCompleted === 'not' && task.progress.isCompleted) return false;
        
        // Фильтрация по разделам
        if (this.filters.sections.length > 0 && 
            !this.filters.sections.includes(task.section)) {
          return false;
        }
        
        // Фильтрация по темам
        if (this.filters.topics.length > 0 && 
            !this.filters.topics.includes(task.topic)) {
          return false;
        }
        
        // Фильтрация по части
        if (this.filters.part) {
          const isFirstPart = this.filters.part === 'Первая часть';
          const taskPart = task.number <= (task.subject === 'Химия ЕГЭ' ? 28 : 21) 
            ? 'Первая часть' 
            : 'Вторая часть';
          
          if (taskPart !== this.filters.part) return false;
        }
        
        // Фильтрация по номеру задания
        if (this.filters.taskNumber && 
            !this.filters.taskNumber.includes(task.number)) {
          return false;
        }
        
        // Фильтрация по сложности
        if (this.filters.difficulty) {
          switch(this.filters.difficulty) {
            case 'easy':
              if (task.difficulty !== 1) return false;
              break;
            case 'medium':
              if (task.difficulty !== 2) return false;
              break;
            case 'hard':
              if (task.difficulty !== 3) return false;
              break;
          }
        }
        
        return true;
      });

      // Сортировка по сложности
      if (this.filters.difficulty === 'asc') {
        tasks = [...tasks].sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
      } else if (this.filters.difficulty === 'desc') {
        tasks = [...tasks].sort((a, b) => (b.difficulty || 2) - (a.difficulty || 2));
      }

      return tasks;
    }
  },
  watch: {
    'filters.subject': {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.fetchTasksWithProgress();
        } else {
          this.allTasks = [];
        }
      }
    }
  },
  methods: {
    async fetchTasksWithProgress() {
      this.loading = true;
      this.error = null;
      
      try {
        // Получаем текущего пользователя
        const { data: { user } } = await supabase.auth.getUser();
        this.user = user;
        
        const tableName = this.filters.subject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_task_bank' 
          : 'biology_ege_task_bank';
        
        const progressTable = this.filters.subject === 'Химия ЕГЭ'
          ? 'chemistry_ege_progress'
          : 'biology_ege_progress';
        
        // Загружаем задания с сортировкой по номеру и сложности
        const { data: tasks, error: tasksError } = await supabase
          .from(tableName)
          .select('*')
          .order('number', { ascending: true })
          .order('difficulty', { ascending: true });
        
        if (tasksError) throw tasksError;
        
        // Загружаем прогресс
        let progress = {};
        if (user) {
          const { data: progressData, error: progressError } = await supabase
            .from(progressTable)
            .select('task_id, is_completed, score')
            .eq('user_id', user.id);
          
          if (!progressError) {
            progressData.forEach(item => {
              progress[item.task_id] = {
                isCompleted: item.is_completed,
                score: item.score
              };
            });
          }
        }
        
        // Формируем итоговый массив заданий
        this.allTasks = tasks.map(task => ({
          ...task,
          subject: this.filters.subject,
          progress: progress[task.id] || {
            isCompleted: false,
            score: 0
          },
          // Устанавливаем сложность по умолчанию, если не указана
          difficulty: task.difficulty || 2
        }));
        
      } catch (err) {
        console.error('Ошибка загрузки заданий:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    selectTask(task) {
      this.$emit('task-selected', task);
    },
    handleAnswerChecked(result) {
      // Обновляем прогресс в локальном состоянии
      const taskIndex = this.allTasks.findIndex(t => t.id === result.taskId);
      if (taskIndex !== -1) {
        this.allTasks[taskIndex].progress = {
          isCompleted: result.isCorrect || result.isPartiallyCorrect,
          score: result.awardedPoints
        };
      }
    }
  }
};
</script>

<template>
  <div class="task-list-container">
    <div v-if="loading" class="loading-indicator">Загрузка заданий...</div>
    
    <div v-else>
      <div v-if="filteredTasks.length === 0" class="no-tasks">
        Задания не найдены. Попробуйте изменить параметры фильтрации.
      </div>
      
      <div v-else class="tasks-list">
        <TaskCard 
          v-for="task in filteredTasks" 
          :key="task.id" 
          :task="task"
          :user="user"
          @task-selected="selectTask"
          @answer-checked="handleAnswerChecked"
        />
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
  overflow-y: auto;
  overflow-x: hidden;
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
}
</style>