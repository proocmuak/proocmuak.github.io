<template>
  <div v-if="loading" class="loading">Загрузка данных...</div>
  <div v-else-if="error" class="error">{{ error }}</div>
  <div v-else-if="subject1" class="block">
    <div class="subject_name">{{ subject1 }}</div>
    <div class="score">Количество баллов: {{ score }}</div>
    <div class="rating">Место в рейтинге: {{ rating }}</div>
    
<a v-if="subject1 === 'Химия ЕГЭ'" href="/chemistry_ege.html" class="button">
  Перейти
</a>
<a v-if="subject1 === 'Химия ОГЭ'" href="/chemistry_oge.html" class="button">
  Перейти
</a>
    <div v-else class="button">Перейти</div>
  </div>
</template>

<script>
import { supabase } from '../supabase'

export default {
  data() {
    return {
      subject1: null,
      score: 0,
      rating: 0,
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
        .select('subject1, score, rating')
        .eq('user_id', this.user_id)
        .single()

      if (error) throw error
      
      if (data) {
        this.subject1 = data.subject1
        this.score = data.score || 0
        this.rating = data.rating || 0
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
  text-decoration: none; /* Убираем подчеркивание у ссылки */
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