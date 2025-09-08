<template>
  <div class="homework-container">
    <!-- Остальная часть шаблона без изменений -->
    <!-- ... -->
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

    // Остальные методы без изменений
    openHomeworkSimple(homework) {
      // ... существующий код
    },

    async sendForRevision(homework) {
      // ... существующий код
    },

    formatDate(dateString) {
      // ... существующий код
    }
  },
  watch: {
    // ... существующий код
  }
}
</script>

<style scoped>
/* Стили остаются без изменений */
</style>