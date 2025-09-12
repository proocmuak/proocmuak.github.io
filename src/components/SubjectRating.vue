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
        { value: 'Биология ЕГЭ', label: 'Биология ЕГЭ' }
      ]
    };
  },
  computed: {
    ratingTitle() {
      return `Рейтинг всех учеников (${this.selectedSubject})`;
    },
    ratingTable() {
      return this.selectedSubject === 'Химия ЕГЭ' 
        ? 'chemistry_rating' 
        : 'biology_rating';
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
        
        // 3. Получаем данные пользователей из таблицы students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('user_id, email, first_name, last_name')
          .in('user_id', userIds);
        
        if (studentsError) {
          console.error('Ошибка студентов:', studentsError);
          throw studentsError;
        }
        
        console.log('Данные студентов:', studentsData);
        
        // 4. Объединяем данные
        const mergedData = ratingData.map(ratingItem => {
          const studentData = studentsData.find(student => student.user_id === ratingItem.user_id);
          return {
            user_id: ratingItem.user_id,
            email: studentData?.email || 'Не указан',
            first_name: studentData?.first_name || '',
            last_name: studentData?.last_name || '',
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
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(student, index) in filteredStudents" :key="student.user_id || index">
              <td>{{ index + 1 }}</td>
              <td>{{ formatFullName(student) }}</td>
              <td>{{ student.total_score }}</td>
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
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.subject-selector {
  margin-bottom: 20px;
  max-width: 300px;
}

.rating-container {
  background: white;
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
}

.rating-title {
  color: #b241d1;
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 1.25rem;
}

.students-count {
  text-align: center;
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

.rating-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.rating-table th,
.rating-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.rating-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #555;
  position: sticky;
  top: 0;
  z-index: 10;
}

.rating-table tr:nth-child(even) {
  background-color: #fafafa;
}

.rating-table tr:hover {
  background-color: #f0f0f0;
}

.no-data {
  text-align: center;
  color: #888;
  padding: 1rem;
  font-style: italic;
}

.loading-indicator,
.error-message {
  text-align: center;
  padding: 1rem;
  color: #666;
}

.error-message {
  color: #c62828;
}

@media (max-width: 768px) {
  .subject-rating-page {
    padding: 10px;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 0.5rem;
    font-size: 0.85rem;
  }
  
  .rating-table {
    min-width: 500px;
  }
}
</style>