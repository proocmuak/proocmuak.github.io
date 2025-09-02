<script>
import { supabase } from '../supabase';
import DOMPurify from 'dompurify';

export default {
  name: 'TaskCard',
  props: {
    task: {
      type: Object,
      required: true
    },
    user: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      userAnswer: '',
      answerChecked: false,
      isFullyCorrect: false,
      isPartiallyCorrect: false,
      awardedPoints: 0,
      showImageModal: false,
      selectedImage: '',
      loadingProgress: false,
      showAnswerOnly: false,
      showExplanation: false // Добавляем состояние для показа пояснения
    };
  },
  computed: {
    hasTableData() {
      return this.task.table_data && 
             this.task.table_data.content && 
             this.task.table_data.content.length > 0;
    },
    taskTextWithoutTables() {
      if (!this.task.text) return '';
      return this.hasTableData ? this.task.text.replace(/<table[\s\S]*?<\/table>/gi, '') : this.task.text;
    },
    taskStatus() {
      if (!this.answerChecked) return 'Не решено';
      
      if (this.isFullyCorrect) {
        return `✓ Верно (${this.awardedPoints}/${this.task.points} балла)`;
      }
      
      if (this.isPartiallyCorrect) {
        return `± Частично (${this.awardedPoints}/${this.task.points} балла)`;
      }
      
      return `✗ Неверно (0/${this.task.points} балла)`;
    },
    statusClass() {
      return {
        'status-not-completed': !this.answerChecked,
        'status-correct': this.isFullyCorrect,
        'status-partial': this.isPartiallyCorrect && !this.isFullyCorrect,
        'status-incorrect': this.answerChecked && !this.isFullyCorrect && !this.isPartiallyCorrect
      };
    },
    // Добавляем вычисляемые свойства для изображений ответа и пояснения
    hasAnswerImages() {
      return this.task.image_answer && this.task.image_answer.length > 0;
    },
    hasExplanationImages() {
      return this.task.image_explanation && this.task.image_explanation.length > 0;
    },
     canShowExplanation() {
    return this.answerChecked && (this.task.explanation || this.hasExplanationImages);
  }
  },
  methods: {
    sanitizeHtml(html) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span'],
        ALLOWED_ATTR: ['style', 'class']
      });
    },
    getImageUrl(imagePath) {
      if (imagePath.startsWith('http')) return imagePath;
      
      const { data: { publicUrl } } = supabase
        .storage
        .from('task-images')
        .getPublicUrl(imagePath);
      
      return publicUrl;
    },
    showAnswer() {
      this.showAnswerOnly = true;
      this.answerChecked = true; // ← ДОБАВЬТЕ ЭТУ СТРОЧКУ!
      // Не сохраняем в БД для заданий с 3+ баллами
    },
    // Добавляем метод для показа пояснения
    toggleExplanation() {
      this.showExplanation = !this.showExplanation;
    },
  async checkAnswer() {
    if (!this.userAnswer.trim()) {
      alert('Пожалуйста, введите ответ');
      return;
    }
    if (this.task.points >= 3) {
      this.showAnswerOnly = true;
      this.answerChecked = true; // ← ДОБАВЬТЕ ЭТУ СТРОЧКУ!
      return;
    }

      const userAnswer = this.userAnswer.trim();
      const correctAnswer = this.task.answer.toString().trim();
      
      this.answerChecked = true;
      this.isFullyCorrect = userAnswer === correctAnswer;
      
      // Для 2-балльных заданий проверяем частичное совпадение
      if (this.task.points === 2 && !this.isFullyCorrect) {
        this.isPartiallyCorrect = this.checkPartialMatch(userAnswer, correctAnswer);
      } else {
        this.isPartiallyCorrect = false;
      }

      // Определяем начисляемые баллы
      this.awardedPoints = this.isFullyCorrect ? this.task.points 
                        : this.isPartiallyCorrect ? 1 
                        : 0;

      await this.saveTaskProgress();
      
      this.$emit('answer-checked', {
        taskId: this.task.id,
        isCorrect: this.isFullyCorrect,
        isPartiallyCorrect: this.isPartiallyCorrect,
        awardedPoints: this.awardedPoints,
        userAnswer: userAnswer
      });
    },
    calculatePoints() {
      if (this.isFullyCorrect) return this.task.points;
      if (this.isPartiallyCorrect) return 1;
      return 0;
    },
    checkPartialMatch(userAnswer, correctAnswer) {
      if (userAnswer === correctAnswer) return false;
      
      // Для числовых ответов проверяем частичное совпадение
      if (/^\d+$/.test(userAnswer)) {
        if (userAnswer.length !== correctAnswer.length) return false;
        
        let diffCount = 0;
        for (let i = 0; i < userAnswer.length; i++) {
          if (userAnswer[i] !== correctAnswer[i]) {
            diffCount++;
            if (diffCount > 1) return false;
          }
        }
        return diffCount === 1;
      }
      
      // Для текстовых ответов
      const correctParts = correctAnswer.split(/[,;]/).map(part => part.trim());
      const userParts = userAnswer.split(/[,;]/).map(part => part.trim());
      
      return userParts.some(part => correctParts.includes(part));
    },
async saveTaskProgress() {
  if (!this.user?.id) return;

  try {
    const taskId = Number(this.task.id);
    
    // Определяем таблицу прогресса на основе предмета
    const progressTable = this.task.subject.includes('Химия') 
      ? 'chemistry_ege_progress' 
      : 'biology_ege_progress';

    // 1. Проверяем существующую запись
    const { data: existingRecord, error: checkError } = await supabase
      .from(progressTable)
      .select('id, score, counted_in_rating')
      .eq('user_id', this.user.id)
      .eq('task_id', taskId)
      .maybeSingle();

    if (checkError) throw checkError;

    // 2. Определяем, нужно ли учитывать в рейтинге
    const shouldCountInRating = !existingRecord?.counted_in_rating;
    
    // 3. Сохраняем прогресс
    const { error: upsertError } = await supabase
      .from(progressTable)
      .upsert({
        user_id: this.user.id,
        task_id: taskId,
        is_completed: this.isFullyCorrect || this.isPartiallyCorrect,
        score: this.awardedPoints,
        user_answer: this.userAnswer,
        last_updated: new Date().toISOString(),
        counted_in_rating: existingRecord?.counted_in_rating || 
                          (this.isFullyCorrect && shouldCountInRating)
      }, {
        onConflict: 'user_id,task_id',
        returning: 'minimal'
      });

    if (upsertError) throw upsertError;

    // 4. Отправляем событие ТОЛЬКО если баллы нужно учесть в рейтинге
    if (shouldCountInRating) {
      this.$emit('answer-checked', {
        taskId: this.task.id,
        isCorrect: this.isFullyCorrect,
        isPartiallyCorrect: this.isPartiallyCorrect,
        awardedPoints: this.awardedPoints,
        userAnswer: this.userAnswer
      });
    } else {
      console.log('Перерешивание задания. Баллы не добавлены в рейтинг.');
      this.$emit('answer-retried', {
        taskId: this.task.id,
        awardedPoints: this.awardedPoints,
        userAnswer: this.userAnswer,
        isCounted: false
      });
    }

  } catch (error) {
    console.error('Ошибка сохранения прогресса:', error);
    throw error;
  }
},

async loadTaskProgress() {
  if (!this.user?.id) return;
  
  try {
    const taskId = Number(this.task.id);
    
    // Определяем таблицу прогресса на основе предмета
    const progressTable = this.task.subject.includes('Химия') 
      ? 'chemistry_ege_progress' 
      : 'biology_ege_progress';

    const { data, error } = await supabase
      .from(progressTable)
      .select('score, is_completed, user_answer')
      .eq('user_id', this.user.id)
      .eq('task_id', taskId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      this.userAnswer = data.user_answer || '';
      this.awardedPoints = data.score || 0;
      this.answerChecked = true;
      this.updateStatusFlags();
    } else {
      this.answerChecked = false;
      this.awardedPoints = 0;
      this.userAnswer = '';
      this.isFullyCorrect = false;
      this.isPartiallyCorrect = false;
    }
  } catch (error) {
    console.error('Ошибка загрузки прогресса:', error);
  }
},
    async loadTaskProgress() {
      if (!this.user?.id) return;
      
      try {
        const taskId = Number(this.task.id);
        const { data, error } = await supabase
          .from('biology_ege_progress')
          .select('score, is_completed, user_answer')
          .eq('user_id', this.user.id)
          .eq('task_id', taskId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          this.userAnswer = data.user_answer || '';
          this.awardedPoints = data.score || 0;
          this.answerChecked = true; // Всегда true, если запись существует
          this.updateStatusFlags();
        } else {
          // Если записи нет, сбрасываем статус
          this.answerChecked = false;
          this.awardedPoints = 0;
          this.userAnswer = '';
          this.isFullyCorrect = false;
          this.isPartiallyCorrect = false;
        }
      } catch (error) {
        console.error('Ошибка загрузки прогресса:', error);
      }
    },
    getProgressTableName() {
      return this.task.subject.includes('Химия') 
        ? 'chemistry_ege_progress' 
        : 'biology_ege_progress';
    },
    updateStatusFlags() {
      this.isFullyCorrect = this.awardedPoints === this.task.points;
      this.isPartiallyCorrect = this.awardedPoints > 0 && this.awardedPoints < this.task.points;
      
      // Явно определяем статус "Неверно"
      if (this.answerChecked && !this.isFullyCorrect && !this.isPartiallyCorrect) {
        this.awardedPoints = 0; // Гарантируем 0 баллов за неверный ответ
      }
    },
    openImageModal(imageUrl) {
      this.selectedImage = imageUrl;
      this.showImageModal = true;
      document.body.style.overflow = 'hidden';
    },
    closeImageModal() {
      this.showImageModal = false;
      document.body.style.overflow = '';
    }
  },
  mounted() {
    this.loadTaskProgress();
  },
  watch: {
    user: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.loadTaskProgress();
      }
    },
    task: {
      immediate: true,
      handler() {
        if (this.user) this.loadTaskProgress();
      }
    },
    canShowExplanation(newVal) {
    if (newVal) {
      // Автоматически раскрываем пояснение когда оно становится доступным
      this.showExplanation = true;
    }
  }
  }
}
</script>

<template>
  <div class="task-card">
    <div class="task-header">
      <div class="task-meta">
        <span class="task-topic">Тема: {{ task.topic }}</span>
        <span class="task-id">#{{ task.id }}</span>
      </div>
      <div class="task-status" :class="statusClass">
        {{ taskStatus }}
      </div>
    </div>
    
    <div class="task-content">
      <div class="task-text" v-html="sanitizeHtml(taskTextWithoutTables)" @copy.prevent></div>
      
      <div v-if="hasTableData" class="task-table-container">
        <table :class="{ 'with-borders': task.table_data.borders }">
          <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
            <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
              <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="task-images" v-if="task.images && task.images.length">
        <div class="image-grid">
          <div 
            class="image-container" 
            v-for="(image, index) in task.images" 
            :key="index"
          >
            <img 
              :src="getImageUrl(image)" 
              :alt="'Изображение задания ' + task.id" 
              class="task-image"
              @click="openImageModal(getImageUrl(image))"
              loading="lazy"
            >
          </div>
        </div>
      </div>

      <div class="answer-section">
        <div v-if="task.points <= 2" class="answer-input-container">
          <input 
            v-model="userAnswer" 
            type="text" 
            placeholder="Введите ответ" 
            class="answer-input"
            @keyup.enter="checkAnswer"
            inputmode="numeric"
            pattern="[0-9]*"
          >
          <button @click="checkAnswer" class="submit-button">Проверить</button>
        </div>
        
        <div v-else class="show-answer-container">
          <button @click="showAnswer" class="show-answer-button">Показать ответ</button>
        </div>
        
<div v-if="answerChecked && task.points <= 2" class="answer-feedback" :class="{
  'correct-feedback': isFullyCorrect,
  'partial-feedback': isPartiallyCorrect,
  'incorrect-feedback': !isFullyCorrect && !this.isPartiallyCorrect
}">
  <transition name="fade" mode="out-in">
    <div v-if="isFullyCorrect" key="correct" class="feedback-content">
      <span class="correct-icon">✓</span> 
      <strong>Ваш ответ:</strong> {{ userAnswer }} - верно! 
      <strong>Правильный ответ:</strong> {{ task.answer }} 
      ({{ awardedPoints }}/{{ task.points }} балла)
    </div>
    <div v-else-if="isPartiallyCorrect" key="partial" class="feedback-content">
      <span class="partial-icon">±</span> 
      <strong>Ваш ответ:</strong> {{ userAnswer }} - частично верно! 
      <strong>Правильный ответ:</strong> {{ task.answer }} 
      ({{ awardedPoints }}/{{ task.points }} балла)
    </div>
    <div v-else key="incorrect" class="feedback-content">
      <span class="incorrect-icon">✗</span> 
      <strong>Ваш ответ:</strong> {{ userAnswer }} - неверно. 
      <strong>Правильный ответ:</strong> {{ task.answer }} 
      (0/{{ task.points }} балла)
    </div>
  </transition>
</div>
        
        <div v-if="showAnswerOnly" class="correct-answer">
          <strong>Правильный ответ:</strong> {{ task.answer }}
          
          <!-- Изображения ответа -->
          <div v-if="hasAnswerImages" class="answer-images">
            <div class="image-grid">
              <div 
                class="image-container" 
                v-for="(image, index) in task.image_answer" 
                :key="'answer-'+index"
              >
                <img 
                  :src="getImageUrl(image)" 
                  :alt="'Изображение ответа ' + task.id" 
                  class="task-image"
                  @click="openImageModal(getImageUrl(image))"
                  loading="lazy"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Блок пояснения с изображениями -->
<!-- Блок пояснения с изображениями -->
<div v-if="canShowExplanation" class="explanation-section">
  <div class="explanation-header" @click="toggleExplanation" style="cursor: pointer;">
    <div class="explanation-title">
      Пояснение: 
      <span class="explanation-toggle">
        {{ showExplanation ? '▲' : '▼' }}
      </span>
    </div>
  </div>
  
  <transition name="slide">
    <div v-if="showExplanation" class="explanation-content-container">
      <!-- УБИРАЕМ повторный показ правильного ответа -->
      <div v-if="task.explanation" class="explanation-content" v-html="sanitizeHtml(task.explanation)"></div>
      
      <!-- Изображения пояснения -->
      <div v-if="hasExplanationImages" class="explanation-images">
        <div class="image-grid">
          <div 
            class="image-container" 
            v-for="(image, index) in task.image_explanation" 
            :key="'explanation-'+index"
          >
            <img 
              :src="getImageUrl(image)" 
              :alt="'Изображение пояснения ' + task.id" 
              class="task-image"
              @click="openImageModal(getImageUrl(image))"
              loading="lazy"
            >
          </div>
        </div>
      </div>
    </div>
  </transition>
</div>

    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
*{
  font-family: Evolventa;
}
.task-card {
  border: 0.0625rem solid #b241d1;
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: white;
  width: 100%;
  margin-bottom: 1.25rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 0.0625rem solid #eee;
  gap: 0.6rem;
  position: relative;
}


.task-topic {
  font-weight: 500;
  color: #333;
  font-size: 1.1rem;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-id {
  color: #888;
  font-size: 0.95rem;
  font-weight: bold;
  display: block;
  margin-top: 0.2rem;
}
.task-meta {
  flex: 1;
  min-width: 0; /* Предотвращает переполнение */
}
.task-status {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: bold;
  flex-shrink: 0;
  margin-left: 0.5rem;
  transition: all 0.3s ease;
}

.status-not-completed {
  background: #f5f5f5;
  color: #666;
}

.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-partial {
  background: #fff3e0;
  color: #ff8f00;
}

.status-incorrect {
  background: #ffebee;
  color: #c62828;
}
/* Добавьте стили для кнопки показа ответа */
.show-answer-container {
  margin-bottom: 0.6rem;
}

.show-answer-button {
  padding: 0.6rem 1.25rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
}

.show-answer-button:hover {
  background-color: #b241d1;
}

.correct-answer {
  padding: 0.9rem;
  background-color: #f0faf0;
  border-left: 0.25rem solid #2e7d32;
  border-radius: 0.4rem;
  margin-top: 0.9rem;
  color: #2e7d32;
  font-weight: 500;
}
.answer-feedback {
  padding: 0.75rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.9rem;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.correct-icon, .partial-icon, .incorrect-icon {
  font-size: 1.2rem;
}

.correct-icon {
  color: #2e7d32;
}

.partial-icon {
  color: #ff8f00;
}

.incorrect-icon {
  color: #c62828;
}

/* Анимации */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.pulse-animation {
  animation: pulse 0.5s ease;
}

/* Остальные стили остаются без изменений */
.task-content {
  margin-bottom: 0.9rem;
  width: 100%;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 1.25rem;
  white-space: pre-line;
  user-select: none;
  -webkit-user-select: none;
  font-size: 1rem;
  word-break: break-word;
  overflow-wrap: anywhere;
  hyphens: auto;
}

.task-table-container {
  margin: 1rem 0;
  overflow-x: auto;
}

.task-table-container table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.task-table-container table.with-borders {
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td,
.task-table-container table.with-borders th {
  border: 1px solid #ddd;
  padding: 8px;
}

.task-table-container td, 
.task-table-container th {
  padding: 8px;
  vertical-align: top;
}

.task-table-container th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.task-table-container tr:nth-child(even) {
  background-color: #f9f9f9;
}

.task-images {
  margin-bottom: 1.25rem;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 0.4rem;
  border: 1px solid #eee;
  background: #f8f9fa;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.task-image:hover {
  transform: scale(1.03);
}

.answer-section {
  margin-top: 1.25rem;
}

.answer-input-container {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
  align-items: center;
  width: 100%;
  flex-wrap: wrap;
}

.answer-input {
  flex: 1 1 60%;
  padding: 0.6rem 0.9rem;
  border: 0.0625rem solid #ddd;
  border-radius: 0.4rem;
  font-size: 1rem;
  min-width: 0;
}

.answer-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 0.125rem rgba(178, 65, 209, 0.2);
}

.submit-button {
  padding: 0.6rem 1.25rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
  flex: 1 1 30%;
  min-width: fit-content;
}
/* Добавьте стили для выделения текста ответов */
.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}
.submit-button:hover {
  background-color: #9a36b8;
}
.explanation-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  border-left: 4px solid #b241d1;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.explanation-content {
  line-height: 1.6;
  color: #444;
}

.explanation-content p {
  margin-bottom: 0.8rem;
}

.explanation-content  p:last-child {
  margin-bottom: 0;
}
.answer-feedback, .correct-answer {
  padding: 0.75rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.9rem;
  font-size: 1rem;
}

.correct {
  color: #2e7d32;
  background-color: #f0faf0;
  display: block;
}

.partial {
  color: #ff8f00;
  background-color: #fff3e0;
  display: block;
}

.incorrect {
  color: #c62828;
  background-color: #ffebee;
  display: block;
}

.correct-answer {
  color: #2e7d32;
  background-color: #f0faf0;
  padding: 0.9rem;
  border-left: 0.25rem solid #2e7d32;
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.modal-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 0.4rem;
  box-shadow: 0 0 1rem rgba(0, 0, 0, 0.5);
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-modal:hover {
  background: #9a36b8;
}

@media (max-width: 48rem) {
  .task-card {
    padding: 0.9rem;
    border-radius: 0.4rem;
  }
  
  .task-header {
    flex-direction: column;
    gap: 0.3rem;
  }
  
  .task-topic, 
  .task-id-text {
    font-size: 1rem;
    width: 100%;
  }
  
  .task-status {
    position: relative;
    top: 0;
    right: 0;
    margin-bottom: 0.5rem;
    align-self: flex-start;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .answer-input-container {
    flex-direction: column;
    gap: 0.8rem;
  }
  
  .answer-input,
  .submit-button {
    width: 100%;
    flex: 1 1 100%;
  }
  
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2rem;
    height: 2rem;
    font-size: 1.2rem;
  }
}
</style>


<style scoped>
/* Все существующие стили остаются без изменений */

/* Добавляем новые стили для изображений ответа и пояснения */
.answer-images,
.explanation-images {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.answer-images .image-grid,
.explanation-images .image-grid {
  margin-top: 0.5rem;
}

/* Стили для анимации раскрытия пояснения */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.explanation-toggle {
  font-size: 0.8rem;
  color: #b241d1;
}

.explanation-content-container {
  margin-top: 0.5rem;
}
</style>