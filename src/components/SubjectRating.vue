<script>
import { supabase } from '../supabase';
import CustomDropdown from './CustomDropdown.vue';

export default {
  name: 'SubjectRating',
  components: {
    CustomDropdown
  },
  data() {
    return {
      selectedSubject: null,
      allStudents: [],
      loading: false,
      error: null,
      subjects: [],
      user_id: null,
      studentData: null
    };
  },
  computed: {
    ratingTitle() {
      return this.selectedSubject ? `Рейтинг всех учеников (${this.selectedSubject})` : 'Рейтинг всех учеников';
    },
    ratingTable() {
      if (!this.selectedSubject) return null;
      
      const subjectMap = {
        'Химия ЕГЭ': 'chemistry_ege_rating',
        'Химия ОГЭ': 'chemistry_oge_rating',
        'Биология ЕГЭ': 'biology_ege_rating',
        'Биология ОГЭ': 'biology_oge_rating'
      };
      return subjectMap[this.selectedSubject];
    },
    filteredStudents() {
      return this.allStudents;
    }
  },
  methods: {
    async getCurrentUserId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err);
        return null;
      }
    },

    async fetchStudentData() {
      try {
        this.user_id = await this.getCurrentUserId();
        if (!this.user_id) {
          throw new Error('Пользователь не авторизован');
        }

        const { data, error: studentError } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', this.user_id)
          .single();

        if (studentError) throw studentError;

        this.studentData = data;
        return data;

      } catch (err) {
        console.error('Ошибка загрузки данных студента:', err);
        return null;
      }
    },

    async fetchUserSubjects() {
      try {
        const studentData = await this.fetchStudentData();
        if (!studentData) {
          throw new Error('Не удалось загрузить данные студента');
        }

        const subjects = [];
        
        if (studentData.subject1) {
          subjects.push({
            value: studentData.subject1,
            label: studentData.subject1
          });
        }
        
        if (studentData.subject2) {
          subjects.push({
            value: studentData.subject2,
            label: studentData.subject2
          });
        }

        this.subjects = subjects;
        
        if (subjects.length > 0) {
          this.selectedSubject = subjects[0].value;
        }

      } catch (err) {
        console.error('Ошибка загрузки предметов:', err);
        this.error = 'Не удалось загрузить список предметов';
      }
    },

    async fetchAllStudents() {
      if (!this.selectedSubject) {
        this.allStudents = [];
        return;
      }

      this.loading = true;
      this.error = null;
      this.allStudents = [];
      
      try {
        const { data: ratingData, error: ratingError } = await supabase
          .from(this.ratingTable)
          .select('user_id, total_score')
          .order('total_score', { ascending: false });
        
        if (ratingError) throw ratingError;
        if (!ratingData || ratingData.length === 0) return;
        
        const { data: allPersonalities, error: personalitiesError } = await supabase
          .from('personalities')
          .select('user_id, email, first_name, last_name');
        
        if (personalitiesError) throw personalitiesError;
        
        this.allStudents = ratingData
          .map(ratingItem => {
            const personalityData = allPersonalities?.find(p => p.user_id === ratingItem.user_id);
            return {
              user_id: ratingItem.user_id,
              email: personalityData?.email || 'Не указан',
              first_name: personalityData?.first_name || '',
              last_name: personalityData?.last_name || '',
              total_score: ratingItem.total_score || 0
            };
          })
          .filter(s => s.first_name || s.last_name || s.email !== 'Не указан');
        
      } catch (err) {
        console.error('Ошибка загрузки:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    
    formatFullName(student) {
      if (student.first_name && student.last_name) {
        return `${student.last_name} ${student.first_name}`;
      } else if (student.first_name) {
        return student.first_name;
      } else if (student.last_name) {
        return student.last_name;
      }
      return student.email || 'Аноним';
    },
    
    // ===== ДОБАВЛЕННАЯ ФУНКЦИЯ =====
    getPositionClass(index) {
      if (index === 0) return 'top-1';
      if (index === 1) return 'top-2';
      if (index === 2) return 'top-3';
      return '';
    },
    
    handleSubjectChange(subject) {
      this.selectedSubject = subject;
      this.fetchAllStudents();
    }
  },
  async mounted() {
    await this.fetchUserSubjects();
    if (this.selectedSubject) {
      await this.fetchAllStudents();
    }
  },
  watch: {
    ratingTable() {
      if (this.selectedSubject) {
        this.fetchAllStudents();
      }
    }
  }
};
</script>

<template>
  <div class="subject-rating-page">
    <div class="subject-selector">
      <CustomDropdown
        v-model="selectedSubject"
        :options="subjects"
        placeholder="Выберите предмет"
        @change="handleSubjectChange"
      />
    </div>
    
    <div class="rating-container">
      <div class="rating-header">
        <h3 class="rating-title">{{ ratingTitle }}</h3>
        <span v-if="selectedSubject && filteredStudents.length > 0" class="students-count-badge">
          {{ filteredStudents.length }} учеников
        </span>
      </div>
      
      <div v-if="subjects.length === 0 && !loading" class="no-subjects-message">
        <span class="message-icon">📚</span>
        <p>У вас нет доступных предметов для просмотра рейтинга</p>
      </div>
      
      <div v-else>
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          <p>Загрузка рейтинга...</p>
        </div>
        <div v-else-if="error" class="error-message">
          <span class="error-icon">⚠️</span>
          <p>{{ error }}</p>
        </div>
        
        <div v-if="!loading && !error && selectedSubject && filteredStudents.length > 0" class="table-wrapper">
          <table class="rating-table">
            <thead>
              <tr>
                <th class="col-place">Место</th>
                <th class="col-name">ФИО</th>
                <th class="col-score">Баллы</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(student, index) in filteredStudents" 
                :key="student.user_id || index"
                :class="{ 'top-three': index < 3 }"
              >
                <td class="position-cell">
                  <span class="position-number" :class="getPositionClass(index)">
                    {{ index + 1 }}
                  </span>
                </td>
                <td class="name-cell">{{ formatFullName(student) }}</td>  
                <td class="score-cell">{{ student.total_score }}</td>
              </tr>
              
              <tr v-if="filteredStudents.length === 0">
                <td colspan="3" class="no-data">Нет данных для отображения</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="!loading && !error && !selectedSubject" class="select-subject-prompt">
          <span class="prompt-icon">👆</span>
          <p>Пожалуйста, выберите предмет для просмотра рейтинга</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================ */
/* БАЗОВЫЕ СТИЛИ */
/* ============================================ */

.subject-rating-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.subject-selector {
  margin-bottom: 20px;
  max-width: 320px;
}

.rating-container {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(178, 65, 209, 0.08);
  border: 1px solid #f0e6f7;
  width: 100%;
  box-sizing: border-box;
}

.rating-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.rating-title {
  color: #5a2d7a;
  margin: 0;
  font-size: clamp(1.1rem, 3vw, 1.5rem);
  font-weight: 600;
}

.students-count-badge {
  background: rgba(178, 65, 209, 0.1);
  color: #b241d1;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: clamp(0.8rem, 2vw, 0.95rem);
  font-weight: 500;
  white-space: nowrap;
}

/* ===== ТАБЛИЦА ===== */
.table-wrapper {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
  border-radius: 12px;
  border: 1px solid #f0e6f7;
  -webkit-overflow-scrolling: touch;
}

.rating-table {
  width: 100%;
  border-collapse: collapse;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  background: white;
  min-width: 400px;
}

.rating-table th,
.rating-table td {
  padding: clamp(10px, 2vw, 16px) clamp(12px, 2vw, 20px);
  text-align: left;
  border-bottom: 1px solid #f0e6f7;
}

.rating-table th {
  background: linear-gradient(135deg, #b241d1 0%, #9a30b8 100%);
  font-weight: 600;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
  border: none;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.rating-table th.col-place {
  width: clamp(60px, 10vw, 80px);
  text-align: center;
}

.rating-table th.col-name {
  text-align: left;
}

.rating-table th.col-score {
  width: clamp(70px, 12vw, 100px);
  text-align: center;
}

.rating-table tr {
  transition: background-color 0.2s ease;
}

.rating-table tr:nth-child(even) {
  background-color: #fafafa;
}

.rating-table tr:hover {
  background-color: #f9f3fc;
}

.rating-table tr.top-three {
  background-color: #f8f5ff;
}

/* ===== ЯЧЕЙКИ ===== */
.position-cell {
  text-align: center;
  padding: clamp(8px, 1.5vw, 12px) !important;
}

.position-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(30px, 5vw, 40px);
  height: clamp(30px, 5vw, 40px);
  border-radius: 50%;
  font-weight: 700;
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  color: #b241d1;
  background: rgba(178, 65, 209, 0.1);
  transition: all 0.3s ease;
}

.position-number.top-1 {
  background: linear-gradient(135deg, #FFD700 0%, #FFC400 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(255, 215, 0, 0.4);
  width: clamp(36px, 6vw, 48px);
  height: clamp(36px, 6vw, 48px);
  font-size: clamp(1rem, 2.2vw, 1.2rem);
}

.position-number.top-2 {
  background: linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(192, 192, 192, 0.4);
  width: clamp(34px, 5.5vw, 44px);
  height: clamp(34px, 5.5vw, 44px);
  font-size: clamp(0.95rem, 2.1vw, 1.15rem);
}

.position-number.top-3 {
  background: linear-gradient(135deg, #CD7F32 0%, #B56C20 100%);
  color: white;
  box-shadow: 0 2px 12px rgba(205, 127, 50, 0.4);
  width: clamp(32px, 5vw, 40px);
  height: clamp(32px, 5vw, 40px);
  font-size: clamp(0.9rem, 2vw, 1.1rem);
}

.name-cell {
  font-weight: 500;
  color: #333;
  word-break: break-word;
}

.score-cell {
  font-weight: 600;
  color: #b241d1;
  text-align: center;
}

/* ===== СОСТОЯНИЯ ===== */
.no-data {
  text-align: center;
  color: #888;
  padding: 2rem;
  font-style: italic;
  font-size: clamp(0.95rem, 2.2vw, 1.1rem);
}

.loading-indicator {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0e6f7;
  border-top: 4px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-indicator p {
  color: #b241d1;
  font-size: clamp(0.95rem, 2.2vw, 1.1rem);
  margin: 0;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  color: #dc2626;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  margin: 16px 0;
}

.error-icon {
  font-size: 1.5rem;
}

.error-message p {
  margin: 0;
  font-size: clamp(0.9rem, 2vw, 1rem);
}

.no-subjects-message,
.select-subject-prompt {
  text-align: center;
  padding: 32px 20px;
  color: #666;
  background-color: rgba(178, 65, 209, 0.05);
  border-radius: 12px;
  border: 2px dashed #e8d4f2;
  margin: 8px 0;
}

.no-subjects-message .message-icon,
.select-subject-prompt .prompt-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 8px;
}

.no-subjects-message p,
.select-subject-prompt p {
  margin: 0;
  font-size: clamp(0.95rem, 2.2vw, 1.1rem);
}

/* ============================================ */
/* АДАПТИВНОСТЬ */
/* ============================================ */

@media (max-width: 1024px) {
  .subject-rating-page {
    padding: 16px;
  }
  
  .rating-container {
    padding: 20px;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 10px 14px;
  }
}

@media (max-width: 768px) {
  .subject-rating-page {
    padding: 12px;
  }
  
  .rating-container {
    padding: 16px;
    border-radius: 12px;
  }
  
  .rating-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .rating-title {
    font-size: 1.2rem;
  }
  
  .students-count-badge {
    font-size: 0.85rem;
    padding: 3px 12px;
  }
  
  .subject-selector {
    max-width: 100%;
  }
  
  .table-wrapper {
    max-height: 450px;
    border-radius: 8px;
  }
  
  .rating-table {
    min-width: 350px;
    font-size: 0.85rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 8px 10px;
  }
  
  .rating-table th.col-place {
    width: 50px;
  }
  
  .rating-table th.col-score {
    width: 60px;
  }
  
  .position-number {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  .position-number.top-1 {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }
  
  .position-number.top-2 {
    width: 30px;
    height: 30px;
    font-size: 0.85rem;
  }
  
  .position-number.top-3 {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  .score-cell {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .subject-rating-page {
    padding: 8px;
  }
  
  .rating-container {
    padding: 12px;
    border-radius: 10px;
  }
  
  .rating-title {
    font-size: 1rem;
  }
  
  .students-count-badge {
    font-size: 0.75rem;
    padding: 2px 10px;
  }
  
  .rating-table {
    min-width: 300px;
    font-size: 0.75rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 6px 8px;
  }
  
  .rating-table th.col-place {
    width: 40px;
  }
  
  .rating-table th.col-score {
    width: 50px;
  }
  
  .position-number {
    width: 24px;
    height: 24px;
    font-size: 0.7rem;
  }
  
  .position-number.top-1 {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
  }
  
  .position-number.top-2 {
    width: 26px;
    height: 26px;
    font-size: 0.75rem;
  }
  
  .position-number.top-3 {
    width: 24px;
    height: 24px;
    font-size: 0.7rem;
  }
  
  .score-cell {
    font-size: 0.75rem;
  }
  
  .name-cell {
    font-size: 0.75rem;
  }
  
  .error-message {
    padding: 12px 16px;
    gap: 8px;
  }
  
  .error-icon {
    font-size: 1.2rem;
  }
  
  .no-subjects-message,
  .select-subject-prompt {
    padding: 24px 16px;
  }
  
  .no-subjects-message .message-icon,
  .select-subject-prompt .prompt-icon {
    font-size: 1.5rem;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .subject-rating-page {
    padding: 10px;
  }
  
  .rating-container {
    padding: 14px;
  }
  
  .table-wrapper {
    max-height: 350px;
  }
  
  .rating-table {
    min-width: 400px;
    font-size: 0.8rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 6px 10px;
  }
}

/* Очень маленькие экраны */
@media (max-width: 360px) {
  .rating-table {
    min-width: 260px;
    font-size: 0.7rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 4px 6px;
  }
  
  .position-number {
    width: 20px;
    height: 20px;
    font-size: 0.6rem;
  }
  
  .position-number.top-1 {
    width: 24px;
    height: 24px;
    font-size: 0.7rem;
  }
  
  .position-number.top-2 {
    width: 22px;
    height: 22px;
    font-size: 0.65rem;
  }
  
  .position-number.top-3 {
    width: 20px;
    height: 20px;
    font-size: 0.6rem;
  }
}
</style>