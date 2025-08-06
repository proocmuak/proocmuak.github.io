<template>
  <div class="motivation-quote">
    {{ dailyQuote }}
  </div>
</template>

<script>
import quotes from '../assets/motivationalQuotes.js';

export default {
  name: 'DailyMotivation',
  data() {
    return {
      dailyQuote: ''
    }
  },
  created() {
    this.setDailyQuote();
  },
  methods: {
    getDailyIndex() {
      // Получаем уникальный индекс для дня
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now - start;
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      
      return dayOfYear % quotes.length;
    },
    setDailyQuote() {
      // Проверяем, есть ли сохраненная цитата для сегодня
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem('motivationDate');
      const savedQuote = localStorage.getItem('dailyMotivation');
      
      if (savedDate === today && savedQuote) {
        this.dailyQuote = savedQuote;
      } else {
        const index = this.getDailyIndex();
        this.dailyQuote = quotes[index];
        // Сохраняем в localStorage
        localStorage.setItem('dailyMotivation', this.dailyQuote);
        localStorage.setItem('motivationDate', today);
      }
    }
  }
}
</script>

<style scoped>
.motivation-quote {
  font-size: 1.2rem;
}
</style>