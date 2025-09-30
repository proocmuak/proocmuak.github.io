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
      selectedSubject: 'Химия ЕГЭ',
      allStudents: [],
      loading: false,
      error: null,
      subjects: [
        { value: 'Химия ЕГЭ', label: 'Химия ЕГЭ' },
        { value: 'Химия ОГЭ', label: 'Химия ОГЭ' },
        { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' },
        { value: 'Биология ОГЭ', label: 'Биология ОГЭ' }
      ]
    };
  },
  computed: {
    ratingTitle() {
      return `Рейтинг всех учеников (${this.selectedSubject})`;
    },
    ratingTable() {
      const subjectMap = {
        'Химия ЕГЭ': 'chemistry_ege_rating',
        'Химия ОГЭ': 'chemistry_oge_rating',
        'Биология ЕГЭ': 'biology_ege_rating',
        'Биология ОГЭ': 'biology_oge_rating'
      };
      return subjectMap[this.selectedSubject] || 'chemistry_ege_rating';
    },
    filteredStudents() {
      return this.allStudents;
    }
  },
  methods: {
    async fetchAllStudents() {
      this.loading = true;
      this.error = null;
      this.allStudents = [];
      
      try {
        console.log('Загрузка данных для таблицы:', this.ratingTable);
        
        // 1. Сначала получаем данные из рейтинговой таблицы
        const { data: ratingData, error: ratingError } = await supabase
          .from(this.ratingTable)
          .select('user_id, total_score')
          .order('total_score', { ascending: false });
        
        if (ratingError) {
          console.error('Ошибка рейтинга:', ratingError);
          throw ratingError;
        }
        
        console.log('Данные рейтинга:', ratingData);
        
        if (!ratingData || ratingData.length === 0) {
          console.log('Нет данных в таблице рейтинга');
          return;
        }
        
        // 2. Получаем ID пользователей
        const userIds = ratingData.map(item => item.user_id).filter(id => id);
        console.log('User IDs:', userIds);
        
        if (userIds.length === 0) {
          console.log('Нет user_id в данных рейтинга');
          return;
        }
        
        // 3. Получаем данные пользователей из таблицы personalities
        const { data: personalitiesData, error: personalitiesError } = await supabase
          .from('personalities')
          .select('user_id, email, first_name, last_name')
          .in('user_id', userIds);
        
        if (personalitiesError) {
          console.error('Ошибка personalities:', personalitiesError);
          throw personalitiesError;
        }
        
        console.log('Данные personalities:', personalitiesData);
        
        // 4. Объединяем данные
        const mergedData = ratingData.map(ratingItem => {
          const personalityData = personalitiesData?.find(person => person.user_id === ratingItem.user_id);
          return {
            user_id: ratingItem.user_id,
            email: personalityData?.email || 'Не указан',
            first_name: personalityData?.first_name || '',
            last_name: personalityData?.last_name || '',
            total_score: ratingItem.total_score || 0
          };
        });
        
        console.log('Объединенные данные:', mergedData);
        this.allStudents = mergedData;
        
      } catch (err) {
        console.error('Полная ошибка загрузки:', err);
        this.error = err.message || 'Ошибка при загрузке данных';
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
    
    handleSubjectChange(subject) {
      this.selectedSubject = subject;
      this.fetchAllStudents();
    }
  },
  mounted() {
    this.fetchAllStudents();
  },
  watch: {
    ratingTable() {
      this.fetchAllStudents();
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
      <h3 class="rating-title">{{ ratingTitle }}</h3>
      <p class="students-count">Всего учеников: {{ filteredStudents.length }}</p>
      
      <div v-if="loading" class="loading-indicator">Загрузка рейтинга...</div>
      <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
      
      <div v-if="!loading && !error" class="table-wrapper">
        <table class="rating-table">
          <thead>
            <tr>
              <th>Место</th>
              <th>ФИО</th>
              <th>Email</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(student, index) in filteredStudents" :key="student.user_id || index">
              <td class="position-cell">{{ index + 1 }}</td>
              <td class="name-cell">{{ formatFullName(student) }}</td>
              <td class="email-cell">{{ student.email }}</td>
              <td class="score-cell">{{ student.total_score }}</td>
            </tr>
            
            <tr v-if="filteredStudents.length === 0">
              <td colspan="4" class="no-data">Нет данных для отображения</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subject-rating-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.subject-selector {
  margin-bottom: 20px;
  max-width: 300px;
}

.rating-container {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 0.25rem 0.9375rem rgba(178, 65, 209, 0.1);
  border: 1px solid #f0e6f7;
}

.rating-title {
  color: #b241d1;
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
}

.students-count {
  text-align: center;
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
  border-radius: 0.5rem;
  border: 1px solid #f0e6f7;
}

.rating-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
  background: white;
}

.rating-table th,
.rating-table td {
  padding: 1rem;
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
}

.rating-table tr:nth-child(even) {
  background-color: #fafafa;
}

.rating-table tr:hover {
  background-color: #f9f3fc;
  transform: translateY(-1px);
  transition: all 0.2s ease;
}

.position-cell {
  font-weight: 600;
  color: #b241d1;
  text-align: center;
  width: 80px;
}

.name-cell {
  font-weight: 500;
  color: #333;
}

.email-cell {
  color: #666;
}

.score-cell {
  font-weight: 600;
  color: #b241d1;
  text-align: center;
  width: 100px;
}

.no-data {
  text-align: center;
  color: #888;
  padding: 2rem;
  font-style: italic;
  font-size: 1.1rem;
}

.loading-indicator,
.error-message {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.loading-indicator {
  color: #b241d1;
}

.error-message {
  color: #dc2626;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
}

/* Стили для первых трех мест */
.rating-table tr:first-child .position-cell {
  background: linear-gradient(135deg, #FFD700 0%, #FFC400 100%);
  color: white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.rating-table tr:nth-child(2) .position-cell {
  background: linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%);
  color: white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.rating-table tr:nth-child(3) .position-cell {
  background: linear-gradient(135deg, #CD7F32 0%, #B56C20 100%);
  color: white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .subject-rating-page {
    padding: 10px;
  }
  
  .rating-container {
    padding: 1rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
  }
  
  .rating-table {
    min-width: 600px;
  }
  
  .rating-title {
    font-size: 1.25rem;
  }
  
  .position-cell,
  .score-cell {
    width: 60px;
  }
}

@media (max-width: 480px) {
  .subject-selector {
    max-width: 100%;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 0.5rem 0.25rem;
    font-size: 0.8rem;
  }
  
  .rating-table {
    min-width: 500px;
  }
}
</style>