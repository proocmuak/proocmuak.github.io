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
      required: true
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
        const isChemistry = this.filters.subject === 'Химия ЕГЭ';
        const isFirstPart = this.filters.part === 'Первая часть';
        const taskNumber = task.number;
        
        if (isChemistry) {
          if (isFirstPart && taskNumber > 28) return false;
          if (!isFirstPart && taskNumber <= 28) return false;
        } else {
          if (isFirstPart && taskNumber > 21) return false;
          if (!isFirstPart && taskNumber <= 21) return false;
        }
      }
      
      // Фильтрация по номеру задания
      if (this.filters.taskNumber && 
          !this.filters.taskNumber.includes(task.number)) {
        return false;
      }
      
      // Фильтрация по сложности
      if (this.filters.difficulty) {
        const taskDiff = task.difficulty || 2;
        switch(this.filters.difficulty) {
          case 'easy': return taskDiff === 1;
          case 'medium': return taskDiff === 2;
          case 'hard': return taskDiff === 3;
        }
      }
      
      return true;
    });

    // Сортировка
    if (this.filters.difficulty === 'asc') {
      tasks.sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2));
    } else if (this.filters.difficulty === 'desc') {
      tasks.sort((a, b) => (b.difficulty || 2) - (a.difficulty || 2));
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
    },
        handleTaskAdded(taskId) {
      this.$emit('task-selected', taskId)
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
        <TeacherTaskCard 
          v-for="task in filteredTasks" 
          :key="task.id" 
          :task="task"
          :user="user"
        :homework-id="homeworkId"
        :homework-name="homeworkName"
        :subject="subject"
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