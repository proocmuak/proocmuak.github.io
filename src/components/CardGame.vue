<template>
  <div class="card-game">
    <!-- Выбор предмета -->
    <div class="game-controls">
      <div class="subject-selector">
        <CustomDropdown
          v-model="selectedSubject"
          :options="subjectOptions"
          placeholder="Выберите предмет"
          class="subject-dropdown"
          @change="handleSubjectChange"
        />
      </div>
      <!-- Фильтр по теме (для всех пользователей) -->
      <div class="topic-filter" v-if="availableTopics.length > 0">
        <CustomDropdown
          v-model="selectedTopics"
          :options="topicOptions"
          placeholder="Все темы"
          class="topic-dropdown"
          :multiple="true"
          @change="applyTopicFilter"
        />
      </div>
      <!-- Фильтр по статусу изучения -->
      <div class="status-filter">
        <CustomDropdown
          v-model="selectedStatus"
          :options="statusOptions"
          placeholder="Все карточки"
          class="status-dropdown"
          @change="applyStatusFilter"
        />
      </div>
      <div class="action-buttons" v-if="isTutorOrTeacher">
        <button @click="showAddModal = true" class="add-card-btn">
          + Добавить карточку
        </button>
        <button @click="loadCards" class="refresh-btn" title="Обновить">🔄</button>
      </div>
    </div>

    <!-- Статистика -->
    <div class="stats-bar" v-if="filteredCards.length > 0">
      <span class="stat-item">
        Всего: <strong>{{ filteredCards.length }}</strong>
      </span>
      <span class="stat-item">
        Изучено: <strong>{{ filteredLearnedCount }}</strong>
      </span>
      <span class="stat-item">
        Осталось: <strong>{{ filteredCards.length - filteredLearnedCount }}</strong>
      </span>
    </div>

    <!-- Режим просмотра карточек -->
    <div v-if="filteredCards.length > 0" class="flashcards-view">
      <div class="card-container">
        <div class="card-wrapper" @click="flipCard">
          <transition 
            :name="slideDirection" 
            mode="out-in"
            @before-leave="onBeforeLeave"
            @after-enter="onAfterEnter"
          >
            <div 
              :key="currentCard?.id" 
              class="flashcard-container" 
              :class="{
                'shuffle-exit': isShuffling && shufflePhase === 'exit',
                'shuffle-enter': isShuffling && shufflePhase === 'enter'
              }"
            >
              <div class="flashcard" :class="{ flipped: isFlipped }">
                <div class="card-front">
                  <div class="card-content">
                    <span class="card-label">Вопрос</span>
                    <span v-if="currentCard.topic" class="card-topic">{{ currentCard.topic }}</span>
                    <div class="card-text" v-html="formattedQuestion"></div>
                    <div v-if="currentCard.question_image" class="card-image" @click.stop="openImageModal(currentCard.question_image)">
                      <img :src="getImageUrl(currentCard.question_image)" alt="Изображение вопроса">
                    </div>
                    <span class="card-hint">Нажмите, чтобы перевернуть</span>
                  </div>
                </div>
                <div class="card-back">
                  <div class="card-content">
                    <span class="card-label">Ответ</span>
                    <div class="card-text" v-html="formattedAnswer"></div>
                    <div v-if="currentCard.answer_image" class="card-image" @click.stop="openImageModal(currentCard.answer_image)">
                      <img :src="getImageUrl(currentCard.answer_image)" alt="Изображение ответа">
                    </div>
                    <span class="card-hint">Нажмите, чтобы перевернуть</span>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Навигация -->
      <div class="card-navigation">
        <button @click="prevCard" :disabled="currentIndex === 0 || isShuffling" class="nav-btn">
          ◀
        </button>
        <span class="card-counter">{{ currentIndex + 1 }} / {{ filteredCards.length }}</span>
        <button @click="nextCard" :disabled="currentIndex === filteredCards.length - 1 || isShuffling" class="nav-btn">
          ▶
        </button>
      </div>

      <!-- Кнопки управления -->
      <div class="card-actions">
        <button 
          @click="toggleLearned" 
          class="learned-btn"
          :class="{ learned: isCurrentCardLearned }"
          :disabled="isShuffling"
        >
          {{ isCurrentCardLearned ? '✅ Изучено' : '📚 Отметить изученным' }}
        </button>
        <button @click="shuffleCards" class="shuffle-btn" :disabled="isShuffling">
          🔀 Перемешать
        </button>
        <button @click="resetProgress" class="reset-btn" v-if="isTutorOrTeacher" :disabled="isShuffling">
          🔄 Сбросить прогресс
        </button>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else class="empty-state">
      <span class="empty-icon">🃏</span>
      <p>Нет карточек для этого предмета</p>
      <p v-if="isTutorOrTeacher" class="empty-hint">Нажмите "Добавить карточку", чтобы создать первую</p>
      <p v-else class="empty-hint">Карточки пока не добавлены</p>
    </div>

    <!-- Модальное окно добавления карточки -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Добавить карточку</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="addCard">
            <div class="form-group">
              <label>Тема *</label>
              <CustomDropdown
                v-model="newCard.topic"
                :options="topicOptions"
                placeholder="Выберите тему"
                class="topic-select"
              />
            </div>
            <div class="form-group">
              <label>Вопрос *</label>
              <textarea v-model="newCard.question" required rows="3" placeholder="Введите текст вопроса"></textarea>
            </div>
            <div class="form-group">
              <label>Изображение к вопросу</label>
              <input type="file" @change="handleQuestionImage" accept="image/*" class="file-input">
              <div v-if="newCard.questionImagePreview" class="image-preview">
                <img :src="newCard.questionImagePreview" alt="Предпросмотр">
                <button @click="removeQuestionImage" class="remove-preview-btn">×</button>
              </div>
            </div>
            <div class="form-group">
              <label>Ответ *</label>
              <textarea v-model="newCard.answer" required rows="3" placeholder="Введите текст ответа"></textarea>
            </div>
            <div class="form-group">
              <label>Изображение к ответу</label>
              <input type="file" @change="handleAnswerImage" accept="image/*" class="file-input">
              <div v-if="newCard.answerImagePreview" class="image-preview">
                <img :src="newCard.answerImagePreview" alt="Предпросмотр">
                <button @click="removeAnswerImage" class="remove-preview-btn">×</button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" @click="closeModal" class="cancel-btn">Отмена</button>
              <button type="submit" class="submit-btn" :disabled="isSubmitting">
                {{ isSubmitting ? 'Сохранение...' : 'Сохранить' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Модальное окно для изображений -->
    <div v-if="showImageModal" class="image-modal-overlay" @click.self="closeImageModal">
      <div class="image-modal-content">
        <button class="image-modal-close" @click="closeImageModal">×</button>
        <img :src="getImageUrl(selectedImage)" class="image-modal-img" alt="Изображение">
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'
import { v4 as uuidv4 } from 'uuid'
import { 
  chem_ege_sections, 
  bio_ege_sections, 
  chem_oge_sections, 
  bio_oge_sections 
} from '../assets/arrays/list_of_sections.js'

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

export default {
  name: 'CardGame',
  components: {
    CustomDropdown
  },
  data() {
    return {
      cards: [],
      filteredCards: [],
      currentIndex: 0,
      isFlipped: false,
      selectedSubject: null,
      selectedTopics: [],
      selectedStatus: 'all',
      statusOptions: [
        { value: 'all', label: 'Все карточки' },
        { value: 'unlearned', label: 'Неизученные' },
        { value: 'learned', label: 'Изученные' }
      ],
      subjectOptions: [],
      topicOptions: [],
      availableTopics: [],
      isTutorOrTeacher: false,
      showAddModal: false,
      showImageModal: false,
      selectedImage: '',
      isSubmitting: false,
      userId: null,
      userRole: null,
      progressMap: {},
      slideDirection: 'slide-next',
      isTransitioning: false,
      isShuffling: false,
      shufflePhase: '',
      newCard: {
        topic: null,
        question: '',
        answer: '',
        questionImage: null,
        answerImage: null,
        questionImagePreview: null,
        answerImagePreview: null
      }
    }
  },
  computed: {
    currentCard() {
      return this.filteredCards[this.currentIndex] || null
    },
    filteredLearnedCount() {
      return this.filteredCards.filter(c => this.progressMap[c.id]?.is_learned).length
    },
    isCurrentCardLearned() {
      if (!this.currentCard) return false
      return this.progressMap[this.currentCard.id]?.is_learned || false
    },
    formattedQuestion() {
      if (!this.currentCard) return ''
      return this.currentCard.question.replace(/\n/g, '<br>')
    },
    formattedAnswer() {
      if (!this.currentCard) return ''
      return this.currentCard.answer.replace(/\n/g, '<br>')
    },
    tableName() {
      if (!this.selectedSubject) return null
      const map = {
        'Химия ЕГЭ': 'chemistry_ege_flashcards',
        'Химия ОГЭ': 'chemistry_oge_flashcards',
        'Биология ЕГЭ': 'biology_ege_flashcards',
        'Биология ОГЭ': 'biology_oge_flashcards'
      }
      return map[this.selectedSubject] || null
    },
    progressTableName() {
      if (!this.selectedSubject) return null
      const map = {
        'Химия ЕГЭ': 'chemistry_ege_flashcards_progress',
        'Химия ОГЭ': 'chemistry_oge_flashcards_progress',
        'Биология ЕГЭ': 'biology_ege_flashcards_progress',
        'Биология ОГЭ': 'biology_oge_flashcards_progress'
      }
      return map[this.selectedSubject] || null
    },
    subjectTopics() {
      if (!this.selectedSubject) return []
      const map = {
        'Химия ЕГЭ': chem_ege_sections,
        'Биология ЕГЭ': bio_ege_sections,
        'Химия ОГЭ': chem_oge_sections,
        'Биология ОГЭ': bio_oge_sections
      }
      return map[this.selectedSubject] || []
    }
  },
  async mounted() {
    await this.loadUserData()
    await this.loadUserSubjects()
  },
  methods: {
    async loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          this.userId = user.id
          const { data: personality } = await supabase
            .from('personalities')
            .select('role')
            .eq('user_id', user.id)
            .single()
          this.userRole = personality?.role
          this.isTutorOrTeacher = ['tutor', 'teacher'].includes(this.userRole)
        }
      } catch (err) {
        console.error('Ошибка загрузки данных пользователя:', err)
      }
    },

    async loadUserSubjects() {
      try {
        if (!this.userId) return

        if (this.isTutorOrTeacher) {
          this.subjectOptions = [
            { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
            { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
            { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
            { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
          ]
          
          if (this.subjectOptions.length > 0) {
            this.selectedSubject = this.subjectOptions[0].value
            this.updateTopicOptions()
            await this.loadCards()
          }
          return
        }

        const { data: studentData } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', this.userId)
          .single()

        const subjects = []
        if (studentData?.subject1) {
          subjects.push({ value: studentData.subject1, label: studentData.subject1 })
        }
        if (studentData?.subject2) {
          subjects.push({ value: studentData.subject2, label: studentData.subject2 })
        }

        this.subjectOptions = subjects
        if (subjects.length > 0) {
          this.selectedSubject = subjects[0].value
          this.updateTopicOptions()
          await this.loadCards()
        }
      } catch (err) {
        console.error('Ошибка загрузки предметов:', err)
      }
    },

    updateTopicOptions() {
      this.availableTopics = this.subjectTopics
      this.topicOptions = this.availableTopics.map(t => ({ value: t, label: t }))
      this.selectedTopics = []
    },

    applyTopicFilter() {
      this.applyAllFilters()
    },

    applyStatusFilter() {
      this.applyAllFilters()
    },

    applyAllFilters() {
      let filtered = [...this.cards]
      
      // Фильтр по темам
      if (this.selectedTopics.length > 0) {
        filtered = filtered.filter(card => 
          this.selectedTopics.includes(card.topic)
        )
      }
      
      // Фильтр по статусу изучения
      if (this.selectedStatus === 'unlearned') {
        filtered = filtered.filter(c => !this.progressMap[c.id]?.is_learned)
      } else if (this.selectedStatus === 'learned') {
        filtered = filtered.filter(c => this.progressMap[c.id]?.is_learned)
      }
      
      // Перемешиваем все карточки (не разделяем на изученные/неизученные)
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[filtered[i], filtered[j]] = [filtered[j], filtered[i]]
      }
      
      this.filteredCards = filtered
      this.currentIndex = 0
      this.isFlipped = false
    },

    async loadCards() {
      if (!this.tableName || !this.userId) return

      try {
        const { data: cards, error } = await supabase
          .from(this.tableName)
          .select('*')

        if (error) throw error
        this.cards = cards || []
        
        await this.loadProgress()
        this.applyAllFilters()
      } catch (err) {
        console.error('Ошибка загрузки карточек:', err)
      }
    },

    async loadProgress() {
      if (!this.progressTableName || !this.userId || this.cards.length === 0) return

      try {
        const cardIds = this.cards.map(c => c.id)
        const { data: progress, error } = await supabase
          .from(this.progressTableName)
          .select('flashcard_id, is_learned, learned_at, review_count')
          .eq('user_id', this.userId)
          .in('flashcard_id', cardIds)

        if (error) throw error

        this.progressMap = {}
        if (progress) {
          progress.forEach(p => {
            this.progressMap[p.flashcard_id] = p
          })
        }
      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err)
      }
    },

    async toggleLearned() {
      if (!this.currentCard || !this.userId || this.isShuffling) return

      const isLearned = !this.isCurrentCardLearned
      const now = new Date().toISOString()

      try {
        const { error } = await supabase
          .from(this.progressTableName)
          .upsert({
            user_id: this.userId,
            flashcard_id: this.currentCard.id,
            is_learned: isLearned,
            learned_at: isLearned ? now : null,
            last_reviewed_at: now,
            review_count: this.progressMap[this.currentCard.id]?.review_count || 0
          }, {
            onConflict: 'user_id,flashcard_id'
          })

        if (error) throw error

        this.progressMap[this.currentCard.id] = {
          ...this.progressMap[this.currentCard.id],
          is_learned: isLearned,
          learned_at: isLearned ? now : null,
          last_reviewed_at: now,
          review_count: (this.progressMap[this.currentCard.id]?.review_count || 0) + 1
        }

        // Обновляем список с учетом фильтров
        this.applyAllFilters()

        if (isLearned && this.currentIndex < this.filteredCards.length - 1) {
          setTimeout(() => {
            this.nextCard()
          }, 400)
        }
      } catch (err) {
        console.error('Ошибка обновления прогресса:', err)
      }
    },

    async resetProgress() {
      if (!confirm('Сбросить весь прогресс по карточкам для этого предмета?')) return

      try {
        const { error } = await supabase
          .from(this.progressTableName)
          .delete()
          .eq('user_id', this.userId)

        if (error) throw error

        this.progressMap = {}
        this.applyAllFilters()
        alert('Прогресс сброшен')
      } catch (err) {
        console.error('Ошибка сброса прогресса:', err)
      }
    },

    shuffleCards() {
      if (this.filteredCards.length === 0 || this.isShuffling) return
      
      this.isShuffling = true
      this.shufflePhase = 'exit'
      
      // Получаем текущий отфильтрованный список
      let filtered = [...this.cards]
      
      // Фильтр по темам
      if (this.selectedTopics.length > 0) {
        filtered = filtered.filter(card => 
          this.selectedTopics.includes(card.topic)
        )
      }
      
      // Фильтр по статусу изучения
      if (this.selectedStatus === 'unlearned') {
        filtered = filtered.filter(c => !this.progressMap[c.id]?.is_learned)
      } else if (this.selectedStatus === 'learned') {
        filtered = filtered.filter(c => this.progressMap[c.id]?.is_learned)
      }
      
      // Перемешиваем ВСЕ карточки (без разделения на изученные/неизученные)
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[filtered[i], filtered[j]] = [filtered[j], filtered[i]]
      }
      
      // Ждём окончания анимации "улетания"
      setTimeout(() => {
        // Меняем данные - ВСЕГДА НА ПЕРВУЮ ПОЗИЦИЮ
        this.filteredCards = filtered
        this.currentIndex = 0
        this.isFlipped = false
        
        // Запускаем анимацию "прилетания"
        this.shufflePhase = 'enter'
        
        // Ждём окончания анимации "прилетания"
        setTimeout(() => {
          this.shufflePhase = ''
          this.isShuffling = false
        }, 700)
      }, 550)
    },

    flipCard() {
      if (this.isTransitioning || this.isShuffling) return
      this.isFlipped = !this.isFlipped
    },

    nextCard() {
      if (this.currentIndex < this.filteredCards.length - 1 && !this.isTransitioning && !this.isShuffling) {
        this.slideDirection = 'slide-next'
        this.isTransitioning = true
        this.currentIndex++
        this.isFlipped = false
      }
    },

    prevCard() {
      if (this.currentIndex > 0 && !this.isTransitioning && !this.isShuffling) {
        this.slideDirection = 'slide-prev'
        this.isTransitioning = true
        this.currentIndex--
        this.isFlipped = false
      }
    },

    onBeforeLeave() {
      this.isTransitioning = true
    },

    onAfterEnter() {
      setTimeout(() => {
        this.isTransitioning = false
      }, 50)
    },

    getImageUrl(imagePath) {
      if (!imagePath) return ''
      if (imagePath.startsWith('http')) return imagePath
      
      let cleanPath = imagePath
      if (cleanPath.startsWith('flashcards/')) {
        cleanPath = cleanPath.replace('flashcards/', '')
      }
      
      return `${PROXY_CONFIG.baseUrl}/flashcards/${cleanPath}`
    },

    openImageModal(imagePath) {
      this.selectedImage = imagePath
      this.showImageModal = true
      document.body.style.overflow = 'hidden'
    },

    closeImageModal() {
      this.showImageModal = false
      this.selectedImage = ''
      document.body.style.overflow = ''
    },

    async handleSubjectChange() {
      this.updateTopicOptions()
      await this.loadCards()
    },

    // ===== МЕТОДЫ ДЛЯ ДОБАВЛЕНИЯ КАРТОЧЕК =====
    handleQuestionImage(event) {
      const file = event.target.files[0]
      if (!file) return
      this.newCard.questionImage = file
      this.newCard.questionImagePreview = URL.createObjectURL(file)
    },

    handleAnswerImage(event) {
      const file = event.target.files[0]
      if (!file) return
      this.newCard.answerImage = file
      this.newCard.answerImagePreview = URL.createObjectURL(file)
    },

    removeQuestionImage() {
      this.newCard.questionImage = null
      this.newCard.questionImagePreview = null
    },

    removeAnswerImage() {
      this.newCard.answerImage = null
      this.newCard.answerImagePreview = null
    },

    async uploadImage(file, folder) {
      if (!file) return null

      const fileExt = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      
      let subjectFolder
      if (this.selectedSubject.includes('Химия')) {
        subjectFolder = 'chemistry'
      } else {
        subjectFolder = 'biology'
      }
      
      const examType = this.selectedSubject.includes('ЕГЭ') ? 'ege' : 'oge'
      
      const filePath = `${subjectFolder}_${examType}/${folder}/${fileName}`

      const { error } = await supabase
        .storage
        .from('flashcards')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type
        })

      if (error) throw error

      const { data } = supabase
        .storage
        .from('flashcards')
        .getPublicUrl(filePath)

      return data.publicUrl
    },

    async addCard() {
      if (!this.newCard.topic) {
        alert('Выберите тему')
        return
      }
      if (!this.newCard.question.trim() || !this.newCard.answer.trim()) {
        alert('Заполните вопрос и ответ')
        return
      }

      if (!this.tableName) {
        alert('Выберите предмет')
        return
      }

      this.isSubmitting = true

      try {
        let questionImageUrl = null
        let answerImageUrl = null

        if (this.newCard.questionImage) {
          questionImageUrl = await this.uploadImage(this.newCard.questionImage, 'questions')
        }
        if (this.newCard.answerImage) {
          answerImageUrl = await this.uploadImage(this.newCard.answerImage, 'answers')
        }

        const { data, error } = await supabase
          .from(this.tableName)
          .insert({
            user_id: this.userId,
            topic: this.newCard.topic,
            question: this.newCard.question.trim(),
            question_image: questionImageUrl,
            answer: this.newCard.answer.trim(),
            answer_image: answerImageUrl
          })
          .select()
          .single()

        if (error) throw error

        this.cards.push(data)
        this.applyAllFilters()
        this.closeModal()
        alert('Карточка добавлена!')
      } catch (err) {
        console.error('Ошибка добавления карточки:', err)
        alert('Ошибка: ' + err.message)
      } finally {
        this.isSubmitting = false
      }
    },

    closeModal() {
      this.showAddModal = false
      this.newCard = {
        topic: null,
        question: '',
        answer: '',
        questionImage: null,
        answerImage: null,
        questionImagePreview: null,
        answerImagePreview: null
      }
    }
  }
}
</script>

<style scoped>
.card-game {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 100%;
  overflow: hidden;
}

.game-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.subject-selector {
  min-width: 180px;
  max-width: 260px;
}

.topic-filter {
  min-width: 150px;
  max-width: 220px;
  flex: 1;
}

.status-filter {
  min-width: 150px;
  max-width: 200px;
}

.subject-dropdown,
.topic-dropdown,
.status-dropdown {
  width: 100%;
}

.topic-select {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.add-card-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #b241d1, #8a2be2);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: Evolventa, sans-serif;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.add-card-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.3);
}

.refresh-btn {
  padding: 6px 8px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover {
  background: #e0e0e0;
}

.stats-bar {
  display: flex;
  gap: 16px;
  padding: 4px 14px;
  background: #f8f5fc;
  border-radius: 10px;
  border: 1px solid #f0e6f7;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.stat-item {
  font-size: 12px;
  color: #555;
}

.stat-item strong {
  color: #5a2d7a;
}

/* ===== КАРТОЧКА ===== */
.flashcards-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.card-container {
  width: 100%;
  max-width: 650px;
  aspect-ratio: 4/3;
  perspective: 1000px;
  flex-shrink: 0;
  overflow: hidden;
}

.card-wrapper {
  width: 100%;
  height: 100%;
  cursor: pointer;
  position: relative;
}

.flashcard-container {
  width: 100%;
  height: 100%;
  position: relative;
}

/* ===== АНИМАЦИЯ ШАФФЛА ===== */

/* Эффект "улетания" карточки */
.flashcard-container.shuffle-exit {
  animation: cardFlyAway 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes cardFlyAway {
  0% {
    transform: scale(1) rotate(0deg) translateX(0) translateY(0);
    opacity: 1;
  }
  25% {
    transform: scale(1.15) rotate(3deg) translateX(15px) translateY(-15px);
    opacity: 1;
  }
  60% {
    transform: scale(0.6) rotate(12deg) translateX(50px) translateY(-60px);
    opacity: 0.6;
  }
  100% {
    transform: scale(0.2) rotate(25deg) translateX(100px) translateY(-120px);
    opacity: 0;
  }
}

/* Эффект "прилетания" новой карточки */
.flashcard-container.shuffle-enter {
  animation: cardFlyIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes cardFlyIn {
  0% {
    transform: scale(0.2) rotate(-20deg) translateX(-80px) translateY(100px);
    opacity: 0;
  }
  40% {
    transform: scale(0.8) rotate(-5deg) translateX(-20px) translateY(30px);
    opacity: 0.4;
  }
  65% {
    transform: scale(1.12) rotate(2deg) translateX(0) translateY(-5px);
    opacity: 1;
  }
  85% {
    transform: scale(0.98) rotate(0deg) translateX(0) translateY(0);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg) translateX(0) translateY(0);
    opacity: 1;
  }
}

/* ===== АНИМАЦИЯ ПЕРЕЛИСТЫВАНИЯ ===== */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.slide-next-enter-from {
  transform: translateX(60%) rotateY(-15deg) scale(0.9);
  opacity: 0;
}

.slide-next-enter-to {
  transform: translateX(0) rotateY(0) scale(1);
  opacity: 1;
}

.slide-next-leave-from {
  transform: translateX(0) rotateY(0) scale(1);
  opacity: 1;
}

.slide-next-leave-to {
  transform: translateX(-40%) rotateY(15deg) scale(0.9);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-60%) rotateY(15deg) scale(0.9);
  opacity: 0;
}

.slide-prev-enter-to {
  transform: translateX(0) rotateY(0) scale(1);
  opacity: 1;
}

.slide-prev-leave-from {
  transform: translateX(0) rotateY(0) scale(1);
  opacity: 1;
}

.slide-prev-leave-to {
  transform: translateX(40%) rotateY(-15deg) scale(0.9);
  opacity: 0;
}

.flashcard {
  width: 100%;
  height: 100%;
  position: relative;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.flashcard.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.card-front {
  background: linear-gradient(135deg, #f9f8ff, #f0e6f7);
  border: 2px solid #e8d4f2;
}

.card-back {
  background: linear-gradient(135deg, #b241d1, #8a2be2);
  color: white;
  transform: rotateY(180deg);
  border: 2px solid #b241d1;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  height: 100%;
  gap: 4px;
}

.card-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.4;
  font-weight: 600;
  flex-shrink: 0;
}

.card-topic {
  font-size: 11px;
  color: #b241d1;
  background: rgba(178, 65, 209, 0.1);
  padding: 2px 12px;
  border-radius: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.card-back .card-topic {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.15);
}

.card-text {
  font-size: clamp(15px, 2vw, 22px);
  font-weight: 500;
  line-height: 1.4;
  max-height: 55%;
  overflow-y: auto;
  width: 100%;
  flex-shrink: 1;
}

.card-back .card-text {
  color: white;
}

.card-hint {
  font-size: 10px;
  opacity: 0.3;
  flex-shrink: 0;
}

.card-image {
  max-width: 35%;
  max-height: 25%;
  cursor: pointer;
  flex-shrink: 0;
}

.card-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  transition: transform 0.2s ease;
}

.card-image img:hover {
  transform: scale(1.05);
}

/* ===== НАВИГАЦИЯ ===== */
.card-navigation {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #e8d4f2;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s ease;
}

.nav-btn:hover:not(:disabled) {
  background: #b241d1;
  color: white;
  border-color: #b241d1;
  transform: scale(1.05);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-counter {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  min-width: 60px;
  text-align: center;
}

/* ===== ДЕЙСТВИЯ ===== */
.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 0 4px 0;
}

.learned-btn {
  padding: 5px 16px;
  border: 2px solid #b241d1;
  border-radius: 18px;
  background: transparent;
  color: #b241d1;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  font-family: Evolventa, sans-serif;
  transition: all 0.3s ease;
}

.learned-btn:hover:not(:disabled) {
  background: rgba(178, 65, 209, 0.1);
}

.learned-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.learned-btn.learned {
  background: #b241d1;
  color: white;
  border-color: #b241d1;
}

.learned-btn.learned:hover:not(:disabled) {
  background: #9a36b8;
}

.shuffle-btn {
  padding: 5px 16px;
  border: 2px solid #ddd;
  border-radius: 18px;
  background: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  font-family: Evolventa, sans-serif;
  transition: all 0.3s ease;
}

.shuffle-btn:hover:not(:disabled) {
  border-color: #b241d1;
  color: #b241d1;
}

.shuffle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-btn {
  padding: 5px 16px;
  border: 2px solid #dc3545;
  border-radius: 18px;
  background: transparent;
  color: #dc3545;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  font-family: Evolventa, sans-serif;
  transition: all 0.3s ease;
}

.reset-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== ПУСТОЕ СОСТОЯНИЕ ===== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  text-align: center;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 0.95rem;
  color: #666;
  margin: 4px 0;
}

.empty-hint {
  font-size: 0.85rem !important;
  color: #999 !important;
}

/* ===== МОДАЛЬНЫЕ ОКНА ===== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 95%;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #5a2d7a;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 70px);
  overflow-y: auto;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
  color: #333;
  font-size: 13px;
}

.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: Evolventa, sans-serif;
  resize: vertical;
  min-height: 50px;
}

.form-group textarea:focus {
  outline: none;
  border-color: #b241d1;
}

.file-input {
  width: 100%;
  padding: 4px 0;
}

.image-preview {
  position: relative;
  margin-top: 6px;
  display: inline-block;
}

.image-preview img {
  max-width: 120px;
  max-height: 100px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.remove-preview-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #eee;
}

.cancel-btn {
  padding: 6px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  padding: 6px 16px;
  background: linear-gradient(135deg, #b241d1, #8a2be2);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== МОДАЛЬНОЕ ОКНО ДЛЯ ИЗОБРАЖЕНИЙ ===== */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.image-modal-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.image-modal-close {
  position: absolute;
  top: -36px;
  right: -36px;
  background: none;
  border: none;
  color: white;
  font-size: 28px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.image-modal-close:hover {
  transform: scale(1.2);
}

.image-modal-img {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 6px;
}

/* ===== АДАПТИВ ===== */
@media (max-width: 768px) {
  .game-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .subject-selector,
  .topic-filter,
  .status-filter {
    max-width: 100%;
    min-width: unset;
  }

  .action-buttons {
    justify-content: center;
  }

  .card-container {
    max-width: 100%;
    aspect-ratio: 3/4;
  }

  .card-front,
  .card-back {
    padding: 14px;
  }

  .card-text {
    font-size: clamp(14px, 3.5vw, 18px);
  }

  .card-image {
    max-width: 45%;
    max-height: 20%;
  }

  .stats-bar {
    gap: 10px;
    font-size: 11px;
    justify-content: center;
  }

  .card-actions {
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .learned-btn,
  .shuffle-btn,
  .reset-btn {
    width: 100%;
    text-align: center;
  }

  .image-modal-close {
    top: -28px;
    right: 0;
    font-size: 24px;
  }

  .slide-next-enter-from {
    transform: translateX(40%) scale(0.95);
  }

  .slide-next-leave-to {
    transform: translateX(-30%) scale(0.95);
  }

  .slide-prev-enter-from {
    transform: translateX(-40%) scale(0.95);
  }

  .slide-prev-leave-to {
    transform: translateX(30%) scale(0.95);
  }

  @keyframes cardFlyAway {
    0% {
      transform: scale(1) rotate(0deg) translateX(0);
      opacity: 1;
    }
    100% {
      transform: scale(0.3) rotate(15deg) translateX(60px);
      opacity: 0;
    }
  }
  
  @keyframes cardFlyIn {
    0% {
      transform: scale(0.3) rotate(-10deg) translateX(-40px) translateY(40px);
      opacity: 0;
    }
    100% {
      transform: scale(1) rotate(0deg) translateX(0) translateY(0);
      opacity: 1;
    }
  }
}

@media (max-width: 480px) {
  .card-container {
    aspect-ratio: 2/3;
  }

  .card-front,
  .card-back {
    padding: 10px;
  }

  .card-text {
    font-size: clamp(12px, 3vw, 16px);
  }

  .card-label {
    font-size: 9px;
  }

  .card-hint {
    font-size: 9px;
  }

  .card-topic {
    font-size: 10px;
    padding: 1px 10px;
  }

  .add-card-btn {
    font-size: 11px;
    padding: 5px 10px;
  }

  .refresh-btn {
    font-size: 12px;
    padding: 5px 6px;
  }

  .stats-bar {
    font-size: 10px;
    gap: 6px;
    padding: 3px 10px;
  }

  .nav-btn {
    width: 30px;
    height: 30px;
    font-size: 11px;
  }

  .card-counter {
    font-size: 12px;
    min-width: 50px;
  }

  .learned-btn,
  .shuffle-btn,
  .reset-btn {
    font-size: 11px;
    padding: 4px 12px;
  }

  .modal-content {
    width: 98%;
    margin: 10px;
  }

  .image-modal-content {
    max-width: 98%;
  }

  .image-modal-img {
    max-height: 80vh;
  }
}

@media (min-width: 1200px) {
  .card-container {
    max-width: 600px;
  }

  .card-text {
    font-size: clamp(18px, 1.8vw, 24px);
  }

  .card-front,
  .card-back {
    padding: 24px;
  }

  .game-controls {
    gap: 14px;
  }
}

/* Отключаем анимации для пользователей, предпочитающих меньше движения */
@media (prefers-reduced-motion: reduce) {
  .flashcard-container.shuffle-exit,
  .flashcard-container.shuffle-enter {
    animation: none !important;
    transition: opacity 0.2s ease !important;
  }
  
  .flashcard-container.shuffle-exit {
    opacity: 0 !important;
  }
  
  .flashcard-container.shuffle-enter {
    opacity: 1 !important;
  }

  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    transition: opacity 0.2s ease !important;
    transform: none !important;
  }

  .slide-next-enter-from,
  .slide-next-leave-to,
  .slide-prev-enter-from,
  .slide-prev-leave-to {
    opacity: 0 !important;
    transform: none !important;
  }
}
</style>