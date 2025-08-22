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
      await this.fetchBiologyRating()
      await this.calculateGlobalRating()
    } catch (err) {
      this.error = err.message || 'Ошибка при загрузке данных'
      console.error(err)
    } finally {
      this.loading = false
    }
  },
  methods: {
    async fetchStudentData() {
      const { data, error } = await supabase
        .from('students')
        .select('subject2')
        .eq('user_id', this.user_id)
        .single()

      if (error) throw error
      
      if (data) {
        this.subject2 = data.subject2
      }
    },

    async fetchBiologyRating() {
      const { data, error } = await supabase
        .from('biology_rating')
        .select('total_score')
        .eq('user_id', this.user_id)
        .single()

      if (error) {
        // Если записи нет, создаем новую с нулевым счетом
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('biology_rating')
            .insert([{ 
              user_id: this.user_id, 
              total_score: 0 
            }])

          if (insertError) throw insertError
          this.total_score = 0
        } else {
          throw error
        }
      } else if (data) {
        this.total_score = data.total_score || 0
      }
    },

    async calculateGlobalRating() {
      // Получаем всех пользователей с их баллами, отсортированными по убыванию
      const { data: allRatings, error } = await supabase
        .from('biology_rating')
        .select('user_id, total_score')
        .order('total_score', { ascending: false })

      if (error) throw error

      if (allRatings) {
        // Находим позицию текущего пользователя в рейтинге
        const userIndex = allRatings.findIndex(rating => rating.user_id === this.user_id)
        if (userIndex !== -1) {
          this.global_rating = userIndex + 1 // +1 потому что индекс начинается с 0
        }
      }
    }
  }
}
</script>

<style>
.block {
  background-color: #b241d1;
  border-radius: 5%;
  padding: 5%;
  color: white;
  display: grid;
  grid-template-rows: 10% 20% 20% 10%;
  gap: 10%;
  transition: opacity 0.3s ease;
}
.block:hover {
  opacity: 0.75;
}
.subject_name { 
  font-size: 1.5vw;
  font-weight: bold;
  border-bottom: #fff solid 0.25vh;
}
.button {
  background-color: #fff;
  color: black;
  display: grid;
  justify-content: center;
  align-items: center;
  border-radius: 5vw;
  text-decoration: none;
}
.loading, .error, .no-data {
  padding: 20px;
  text-align: center;
  font-size: 1.2rem;
}
.error {
  color: #ff4444;
}
</style>