<script>
import { supabase } from '../supabase';

export default {
  name: 'SubjectRating',
  props: {
    subject: {
      type: String,
      required: true,
      validator: value => ['Химия ЕГЭ', 'Биология ЕГЭ'].includes(value)
    }
  },
  data() {
    return {
      topStudents: [],
      loading: false,
      error: null
    };
  },
  computed: {
    progressTableName() {
      return this.subject === 'Химия ЕГЭ' 
        ? 'chemistry_ege_progress' 
        : 'biology_ege_progress';
    },
    ratingTitle() {
      return `Топ-10 учеников (${this.subject})`;
    }
  },
  methods: {
    async fetchTopStudents() {
      this.loading = true;
      this.error = null;
      
      try {
        // Получаем топ-10 учеников по сумме баллов
        const { data, error } = await supabase
          .rpc('calculate_subject_rating', {
            subject_name: this.subject.toLowerCase().includes('химия') ? 'chemistry' : 'biology'
          });
        
        if (error) throw error;
        
        this.topStudents = data;
      } catch (err) {
        console.error('Ошибка загрузки рейтинга:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    this.fetchTopStudents();
  },
  watch: {
    subject() {
      this.fetchTopStudents();
    }
  }
};
</script>

<template>
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
        <tr v-for="(student, index) in topStudents" :key="student.user_id">
          <td>{{ index + 1 }}</td>
          <td>{{ student.full_name || 'Аноним' }}</td>
          <td>{{ student.total_score }}</td>
        </tr>
        
        <tr v-if="topStudents.length === 0">
          <td colspan="3" class="no-data">Нет данных для отображения</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.rating-container {
  background: white;
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
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
  .rating-container {
    padding: 1rem;
  }
  
  .rating-table th,
  .rating-table td {
    padding: 0.5rem;
    font-size: 0.85rem;
  }
}
</style>