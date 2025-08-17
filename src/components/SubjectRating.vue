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
      topStudents: [],
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
      return `Топ-10 учеников (${this.selectedSubject})`;
    },
    ratingTable() {
      return this.selectedSubject === 'Химия ЕГЭ' 
        ? 'chemistry_rating' 
        : 'biology_rating';
    }
  },
  methods: {
    async fetchTopStudents() {
      this.loading = true;
      this.error = null;
      
      try {
        const { data, error } = await supabase
          .from(this.ratingTable)
          .select(`
            total_score,
            personalities:user_id(email, first_name, last_name)
          `)
          .order('total_score', { ascending: false })
          .limit(10);
        
        if (error) throw error;
        
        this.topStudents = data.map(item => ({
          ...item.personalities,
          total_score: item.total_score
        }));
      } catch (err) {
        console.error('Ошибка загрузки рейтинга:', err);
        this.error = err.message;
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
      this.fetchTopStudents();
    }
  },
  mounted() {
    this.fetchTopStudents();
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
      
      <div v-if="loading" class="loading-indicator">Загрузка рейтинга...</div>
      <div v-else-if="error" class="error-message">Ошибка: {{ error }}</div>
      
      <table v-else class="rating-table">
        <thead>
          <tr>
            <th>Место</th>
            <th>ФИО</th>
            <th>Баллы</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(student, index) in topStudents" :key="student.user_id || index">
            <td>{{ index + 1 }}</td>
            <td>{{ formatFullName(student) }}</td>
            <td>{{ student.total_score }}</td>
          </tr>
          
          <tr v-if="topStudents.length === 0">
            <td colspan="3" class="no-data">Нет данных для отображения</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.subject-rating-page {
  max-width: 800px;
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
  margin-bottom: 1rem;
  text-align: center;
  font-size: 1.25rem;
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
}
</style>