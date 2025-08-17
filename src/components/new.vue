<script>
export default {
  // ... остальные options без изменений ...

  methods: {
    async loadTaskProgress() {
      if (!this.user) return;
      this.loadingProgress = true;
      
      try {
        const tableName = this.task.subject === 'Химия ЕГЭ' 
          ? 'chemistry_ege_progress' 
          : 'biology_ege_progress';
        
        const { data, error } = await supabase
          .from(tableName)
          .select('score, is_completed')
          .eq('user_id', this.user.id)
          .eq('task_id', this.task.id)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          this.answerChecked = data.score !== null; // Отмечаем как проверенное, если есть баллы
          this.awardedPoints = data.score || 0;
          this.userAnswer = data.user_answer || '';
          
          // Определяем статусы
          this.isFullyCorrect = this.awardedPoints === this.task.points;
          this.isPartiallyCorrect = this.awardedPoints > 0 && this.awardedPoints < this.task.points;
        }
      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err);
      } finally {
        this.loadingProgress = false;
      }
    },
    
    // ... остальные методы без изменений ...
  }
}
</script>

<template>
  <div class="task-card">
    <!-- ... остальной шаблон без изменений до answer-section ... -->
    
    <div class="answer-section">
      <div v-if="!answerChecked && task.points <= 2" class="answer-input-container">
        <!-- Поле ввода для непроверенных заданий -->
      </div>
      
      <div v-if="answerChecked" class="answer-feedback" :class="statusClass">
        <transition name="fade" mode="out-in">
          <div v-if="isFullyCorrect" key="correct" class="feedback-content">
            ✓ Верно! Ответ: {{ task.answer }} ({{ awardedPoints }}/{{ task.points }} балла)
          </div>
          <div v-else-if="isPartiallyCorrect" key="partial" class="feedback-content">
            ± Частично верно! Ответ: {{ task.answer }} ({{ awardedPoints }}/{{ task.points }} балла)
          </div>
          <div v-else key="incorrect" class="feedback-content">
            ✗ Неверно. Ответ: {{ task.answer }} (0/{{ task.points }} балла)
          </div>
        </transition>
      </div>
      
      <div v-if="task.points >= 3" class="correct-answer">
        Правильный ответ: {{ task.answer }}
      </div>
    </div>
    
    <!-- ... остальной шаблон без изменений ... -->
  </div>
</template>

<style scoped>
/* Добавим анимации */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

/* Обновим классы статусов */
.status-not-completed {
  background: #f5f5f5;
  color: #666;
}
.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
  animation: pulse 0.5s ease;
}
.status-partial {
  background: #fff3e0;
  color: #ff8f00;
  animation: pulse 0.5s ease;
}
.status-incorrect {
  background: #ffebee;
  color: #c62828;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* ... остальные стили без изменений ... */
</style>