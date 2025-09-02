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
    // Фильтруем студентов, оставляем только role=student
    filteredStudents() {
      return this.allStudents.filter(student => student.role === 'student');
    }
  },
  methods: {
    async fetchAllStudents() {
      this.loading = true;
      this.error = null;
      
      try {
        // Сначала получаем данные из рейтинговой таблицы
        const { data: ratingData, error: ratingError } = await supabase
          .from(this.ratingTable)
          .select('user_id, total_score')
          .order('total_score', { ascending: false });
        
        if (ratingError) throw ratingError;
        
        if (!ratingData || ratingData.length === 0) {
          this.allStudents = [];
          return;
        }
        
        // Получаем ID пользователей для запроса к таблице personalities
        const userIds = ratingData.map(item => item.user_id);
        
        // Получаем данные пользователей
        const { data: usersData, error: usersError } = await supabase
          .from('personalities')
          .select('user_id, email, first_name, last_name, role')
          .in('user_id', userIds);
        
        if (usersError) throw usersError;
        
        // Объединяем данные и фильтруем только студентов
        this.allStudents = ratingData.map(ratingItem => {
          const userData = usersData.find(user => user.id === ratingItem.user_id);
          return {
            user_id: ratingItem.user_id,
            email: userData?.email,
            first_name: userData?.first_name,
            last_name: userData?.last_name,
            role: userData?.role,
            total_score: ratingItem.total_score || 0
          };
        }).filter(student => student.role === 'student');
          
      } catch (err) {
        console.error('Ошибка загрузки рейтинга:', err);
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
      
      <div v-else class="table-wrapper">
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
              <td>{{ index + 1 }}</td>
              <td>{{ formatFullName(student) }}</td>
              <td>{{ student.email || 'Не указан' }}</td>
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