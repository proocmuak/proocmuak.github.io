<template>
  <div v-if="loading" class="loading">Загрузка данных...</div>
  <div v-else-if="error" class="error">{{ error }}</div>
  <div v-else-if="subject1" class="block">
    <div class="subject_name">{{ subject1 }}</div>
    <div class="score">Количество баллов: {{ total_score }}</div>
    <div class="rating">Место в рейтинге: {{ global_rating }}</div>
    
    <a v-if="subject1 === 'Химия ЕГЭ'" href="/chemistry_ege.html" class="button">
      Перейти
    </a>
    <a v-if="subject1 === 'Химия ОГЭ'" href="/chemistry_oge.html" class="button">
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
      subject1: null,
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
      
      if (this.subject1) {
        await this.fetchChemistryRating()
        await this.calculateGlobalRating()
        this.$emit('has-data') // Данные есть
      } else {
        this.$emit('no-data') // Данных нет
      }
      
    } catch (err) {
      this.error = err.message || 'Ошибка при загрузке данных'
      this.$emit('no-data') // При ошибке тоже считаем, что данных нет
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
          .select('subject1')
          .eq('user_id', this.user_id)
          .single()

        if (error) {
          // Если записи нет в students
          if (error.code === 'PGRST116') {
            this.subject1 = null
            return
          }
          throw error
        }
        
        this.subject1 = data?.subject1 || null
        
      } catch (err) {
        console.error('Ошибка при загрузке данных студента:', err)
        this.subject1 = null
      }
    },

    async fetchChemistryRating() {
      try {
        const { data, error } = await supabase
          .from('chemistry_rating')
          .select('total_score')
          .eq('user_id', this.user_id)
          .single()

        if (error) {
          // Если записи нет, создаем новую с нулевым счетом
          if (error.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('chemistry_rating')
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
      } catch (err) {
        console.error('Ошибка при загрузке рейтинга:', err)
        this.total_score = 0
      }
    },

    async calculateGlobalRating() {
      try {
        // Получаем всех пользователей с их баллами, отсортированными по убыванию
        const { data: allRatings, error } = await supabase
          .from('chemistry_rating')
          .select('user_id, total_score')
          .order('total_score', { ascending: false })

        if (error) throw error

        if (allRatings) {
          // Находим позицию текущего пользователя в рейтинге
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
</style>