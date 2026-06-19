<template>
  <div v-if="loading" class="loading">Загрузка данных...</div>
  <div v-else-if="error" class="error">{{ error }}</div>
  <div v-else-if="subject2" class="block">
    <div class="subject_name">{{ subject2 }}</div>
    <div class="score">Количество баллов: {{ total_score }}</div>
    <div class="rating">Место в рейтинге: {{ global_rating }}</div>
    
    <a v-if="subject2 === 'Биология ЕГЭ'" href="/biology_ege.html" class="button">
      Перейти
    </a>
    <a v-if="subject2 === 'Биология ОГЭ'" href="/biology_oge.html" class="button">
      Перейти
    </a>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  emits: ['has-data', 'no-data'],
  
  data() {
    return {
      subject2: null,
      total_score: 0,
      global_rating: 0,
      loading: true,
      error: null,
      user_id: null
    }
  },
  
  async mounted() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) throw new Error('Пользователь не авторизован')

      this.user_id = user.id
      await this.fetchStudentData()
      
      if (this.subject2) {
        await this.fetchBiologyRating()
        await this.calculateGlobalRating()
        this.$emit('has-data')
      } else {
        this.$emit('no-data')
      }
      
    } catch (err) {
      this.error = err.message || 'Ошибка при загрузке данных'
      this.$emit('no-data')
      console.error(err)
    } finally {
      this.loading = false
    }
  },
  
  methods: {
    async fetchStudentData() {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('subject2')
          .eq('user_id', this.user_id)
          .single()

        if (error && error.code !== 'PGRST116') throw error
        this.subject2 = data?.subject2 || null
        
      } catch (err) {
        console.error('Ошибка при загрузке данных студента:', err)
        this.subject2 = null
      }
    },

    async fetchBiologyRating() {
      try {
        const { data, error } = await supabase
          .from('biology_ege_rating')
          .select('total_score')
          .eq('user_id', this.user_id)
          .single()

        if (error && error.code === 'PGRST116') {
          await supabase.from('biology_ege_rating').insert([{ 
            user_id: this.user_id, 
            total_score: 0 
          }])
          this.total_score = 0
        } else if (data) {
          this.total_score = data.total_score || 0
        }
      } catch (err) {
        console.error('Ошибка при загрузке рейтинга:', err)
        this.total_score = 0
      }
    },

    async calculateGlobalRating() {
      try {
        const { data: allRatings, error } = await supabase
          .from('biology_ege_rating')
          .select('user_id, total_score')
          .order('total_score', { ascending: false })

        if (error) throw error

        if (allRatings) {
          const userIndex = allRatings.findIndex(rating => rating.user_id === this.user_id)
          this.global_rating = userIndex !== -1 ? userIndex + 1 : 0
        }
      } catch (err) {
        console.error('Ошибка при расчете рейтинга:', err)
        this.global_rating = 0
      }
    }
  }
}
</script>

<style scoped>
.block {
  background-color: #b241d1;
  border-radius: 5%;
  padding: 8% 5%;
  color: white;
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 10%;
  transition: opacity 0.3s ease;
  min-height: 280px;
  height: 100%;
}

.block:hover {
  opacity: 0.75;
}

.subject_name { 
  font-size: 1.5vw;
  font-weight: bold;
  border-bottom: #fff solid 2px;
  padding-bottom: 10px;
}

.score, .rating {
  font-size: 1vw;
}

.button {
  background-color: #fff;
  color: #b241d1;
  display: grid;
  justify-content: center;
  align-items: center;
  border-radius: 30px;
  text-decoration: none;
  padding: 10px 20px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.loading, .error, .no-data {
  padding: 20px;
  text-align: center;
  font-size: 1.2rem;
  background-color: #f8f9fa;
  border-radius: 10px;
  color: #666;
}

.error {
  color: #ff4444;
  background-color: #fff5f5;
}

.loading {
  color: #b241d1;
}

/* Адаптивность */
@media (max-width: 1200px) {
  .subject_name {
    font-size: 1.8vw;
  }
  
  .score, .rating {
    font-size: 1.2vw;
  }
}

@media (max-width: 992px) {
  .block {
    min-height: 240px;
    padding: 6% 4%;
  }
  
  .subject_name {
    font-size: 2vw;
  }
  
  .score, .rating {
    font-size: 1.3vw;
  }
  
  .button {
    font-size: 1vw;
    padding: 8px 16px;
  }
}

@media (max-width: 768px) {
  .block {
    min-height: 200px;
    padding: 5% 4%;
    gap: 8%;
    border-radius: 12px;
  }
  
  .subject_name {
    font-size: 3.5vw;
    padding-bottom: 8px;
  }
  
  .score, .rating {
    font-size: 2.5vw;
  }
  
  .button {
    font-size: 2.5vw;
    padding: 8px 16px;
    border-radius: 25px;
  }
}

@media (max-width: 480px) {
  .block {
    min-height: 180px;
    padding: 4% 3%;
    gap: 6%;
    border-radius: 10px;
  }
  
  .subject_name {
    font-size: 4.5vw;
    padding-bottom: 6px;
  }
  
  .score, .rating {
    font-size: 3.2vw;
  }
  
  .button {
    font-size: 3.2vw;
    padding: 6px 12px;
    border-radius: 20px;
  }
}

@media (max-width: 360px) {
  .block {
    min-height: 160px;
    padding: 3% 3%;
    gap: 5%;
  }
  
  .subject_name {
    font-size: 5vw;
  }
  
  .score, .rating {
    font-size: 3.5vw;
  }
  
  .button {
    font-size: 3.5vw;
    padding: 5px 10px;
  }
}
</style>