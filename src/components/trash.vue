<template>
  <div class="allpage">
    <!-- ... остальной код без изменений ... -->
    
    <div class="answer-section">
      <div v-if="!task.userAnswer && !isViewMode && !isCompleted">
        <!-- Поле для нового ответа -->
        <div class="answer-input-container">
          <input 
            v-model="task.userAnswerInput" 
            type="text" 
            :placeholder="`Введите ответ (${task.points} балла)`" 
            class="answer-input"
            @keyup.enter="saveAnswer(task)"
          >
          <button @click="saveAnswer(task)" class="submit-button">Сохранить</button>
        </div>
        <div v-if="task.saving" class="saving-status">Сохранение...</div>
      </div>
      
      <!-- Режим редактирования -->
      <div v-else-if="task.isEditing && !isCompleted && !isViewMode" class="edit-mode">
        <div class="answer-input-container">
          <input 
            v-model="task.editAnswerInput" 
            type="text" 
            placeholder="Измените ответ" 
            class="answer-input"
            @keyup.enter="updateAnswer(task)"
          >
          <button @click="updateAnswer(task)" class="submit-button">Обновить</button>
          <button @click="cancelEdit(task)" class="cancel-button">Отмена</button>
        </div>
        <div v-if="task.saving" class="saving-status">Сохранение...</div>
      </div>
      
      <!-- Отображаем ответы только после завершения работы -->
      <div v-else-if="(isCompleted || task.userAnswer) && showAnswers" class="answer-result">
        <div class="answer-feedback" :class="getFeedbackClass(task)">
          <div class="feedback-content">
            <span v-if="task.isCorrect" class="correct-icon">✓</span>
            <span v-else-if="task.isPartiallyCorrect" class="partial-icon">±</span>
            <span v-else class="incorrect-icon">✗</span>
            
            <span class="user-answer-text">
              <strong>Ваш ответ:</strong> {{ task.userAnswer }} - 
              <span v-if="task.isCorrect">верно!</span>
              <span v-else-if="task.isPartiallyCorrect">частично верно!</span>
              <span v-else>неверно.</span>
            </span>
            
            <span class="correct-answer-text">
              <strong>Правильный ответ:</strong> {{ task.answer }}
              ({{ task.awardedPoints }}/{{ task.points }} балла)
            </span>
          </div>
        </div>
      </div>
      
      <!-- Сохраненный ответ с кнопкой редактирования -->
      <div v-else-if="task.userAnswer && !showAnswers" class="answer-saved">
        <div class="saved-answer-content">
          <span class="saved-icon">✓</span> 
          <span class="answer-text">Ответ: {{ task.userAnswer }}</span>
          <button 
            v-if="!isCompleted && !isViewMode" 
            @click="enableEdit(task)" 
            class="edit-button"
            title="Редактировать ответ"
          >
            ✏️
          </button>
        </div>
      </div>
    </div>

    <!-- ... остальной код без изменений ... -->
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import { supabase } from './supabase.js'
import DOMPurify from 'dompurify'

export default {
  name: 'Homework',
  setup() {
    // ... остальной код без изменений ...

    // Включение режима редактирования
    const enableEdit = (task) => {
      task.isEditing = true;
      task.editAnswerInput = task.userAnswer;
    };

    // Отмена редактирования
    const cancelEdit = (task) => {
      task.isEditing = false;
      task.editAnswerInput = '';
    };

    // Обновление ответа
    const updateAnswer = async (task) => {
      if (!task.editAnswerInput.trim()) {
        alert('Пожалуйста, введите ответ');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.editAnswerInput.trim();
        
        task.userAnswer = userAnswer;
        task.isEditing = false;
        
        await saveTaskProgress(task, false);
        
        task.saving = false;
        
      } catch (err) {
        console.error('Ошибка обновления ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при обновлении ответа: ' + err.message;
      }
    };

    // Сохранение ответа (оригинальная функция)
    const saveAnswer = async (task) => {
      if (!task.userAnswerInput.trim()) {
        alert('Пожалуйста, введите ответ');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.userAnswerInput.trim();
        
        task.userAnswer = userAnswer;
        
        await saveTaskProgress(task, false);
        
        task.saving = false;

      } catch (err) {
        console.error('Ошибка сохранения ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при сохранении ответа: ' + err.message;
      }
    };

    // Загрузка заданий домашнего задания (модифицированная)
    const fetchHomeworkTasks = async () => {
      try {
        // ... код без изменений ...

        // Объединяем данные, сохраняя номер из homework_tasks
        tasks.value = homeworkTasks.map(homeworkTask => {
          const taskDetail = taskDetails.find(t => t.id === homeworkTask.task_id)
          return {
            ...homeworkTask,
            ...taskDetail,
            number: homeworkTask.number,
            userAnswerInput: '',
            editAnswerInput: '',
            userAnswer: null,
            isEditing: false, // Добавляем флаг редактирования
            isCorrect: false,
            isPartiallyCorrect: false,
            awardedPoints: 0,
            saving: false
          }
        })

        // ... остальной код без изменений ...
      } catch (err) {
        // ... обработка ошибок ...
      }
    };

    // ... остальной код без изменений ...

    return {
      // ... остальные возвращаемые значения ...
      enableEdit,
      cancelEdit,
      updateAnswer,
      saveAnswer
    }
  }
}
</script>

<style scoped>
/* Добавляем новые стили для функциональности редактирования */

.edit-mode {
  margin-top: 1rem;
}

.saved-answer-content {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  background-color: #f8f9fa;
  border-radius: 0.4rem;
  border-left: 3px solid #b241d1;
}

.answer-text {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.edit-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 0.3rem;
  font-size: 1.1rem;
  transition: background-color 0.2s;
}

.edit-button:hover {
  background-color: rgba(178, 65, 209, 0.1);
}

.cancel-button {
  padding: 0.8rem 1.2rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: fit-content;
  white-space: nowrap;
}

.cancel-button:hover {
  background-color: #5a6268;
}

/* Адаптивность для кнопок редактирования */
@media (max-width: 480px) {
  .answer-input-container {
    flex-direction: column;
  }
  
  .saved-answer-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .edit-button {
    align-self: flex-end;
  }
}
</style>