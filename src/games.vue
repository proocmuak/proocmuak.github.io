<template>
  <div class="games-page">
    <div class="topmenu">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <div class="rightparttopmenu">
        <div class="redirect_menu" @click="redirectToMenu">На главную</div>
        <div class="go_back"><a href="index.html">Выйти</a></div>
      </div>
    </div> 
    
    <div class="centerpartpage">
      <GamesMenu :current-game="currentGame" @select-game="selectGame" />
      
      <div class="game-content-wrapper">
        <CardGame v-if="currentGame === 'cards'" />
        <div v-else class="game-placeholder">
          <div class="placeholder-icon">
            {{ getGameIcon(currentGame) }}
          </div>
          <h2>{{ getGameTitle(currentGame) }}</h2>
          <p class="placeholder-text">Игра в разработке</p>
          <p class="placeholder-hint">Скоро здесь появится увлекательная игра</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from './supabase'
import GamesMenu from './components/GamesMenu.vue'
import CardGame from './components/CardGame.vue'

export default {
  name: 'Games',
  components: {
    GamesMenu,
    CardGame
  },
  data() {
    return {
      currentGame: 'cards'
    }
  },
  methods: {
    selectGame(gameId) {
      this.currentGame = gameId
    },

    getGameIcon(gameId) {
      const icons = {
        quiz: '🧬',
        constructor: '🧪',
        simulator: '🌍',
        detective: '🔍',
        genetic: '🧬'
      }
      return icons[gameId] || '🎮'
    },

    getGameTitle(gameId) {
      const titles = {
        quiz: 'Биологический квиз',
        constructor: 'Органический конструктор',
        simulator: 'Экологический симулятор',
        detective: 'Химический детектив',
        genetic: 'Генетический редактор'
      }
      return titles[gameId] || 'Игра'
    },

    async redirectToMenu() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          window.location.href = '/login.html'
          return
        }

        const { data: personalityData, error: personalityError } = await supabase
          .from('personalities')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (personalityError) throw personalityError
        if (!personalityData) {
          alert('Профиль пользователя не найден')
          return
        }

        switch(personalityData.role) {
          case 'student': window.location.href = '/student_menu.html'
            break
          case 'teacher': window.location.href = '/teacher_menu.html'
            break
          case 'tutor': window.location.href = '/tutor_menu.html'
            break
          default: alert('Неизвестная роль пользователя')
        }
      } catch (err) {
        console.error('Ошибка при перенаправлении:', err)
        alert('Произошла ошибка при переходе на главную')
      }
    }
  }
}
</script>

<style>
html,
body {
  margin: 0 !important;
  padding: 0 !important;
  background: #f9f8ff;
  min-height: 100vh;
}

* {
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, sans-serif;
  box-sizing: border-box;
}
</style>

<style scoped>
.games-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  background: #f9f8ff;
  margin: 0;
  padding: 0;
}

.topmenu {
  width: 100%;
  padding: 12px 24px;
  color: white;
  font-size: clamp(0.9rem, 2vw, 1.2rem);
  background-image: url(./assets/background_line.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
  margin: 0;
}

.logo {
  font-weight: bold;
  white-space: nowrap;
  font-size: clamp(0.8rem, 1.8vw, 1.1rem);
  color: white;
}

.rightparttopmenu {
  display: flex;
  gap: clamp(12px, 3vw, 20px);
  align-items: center;
  flex-wrap: wrap;
  font-size: clamp(0.8rem, 1.8vw, 1rem);
}

.redirect_menu {
  padding: 4px 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
  cursor: pointer;
  color: white;
}

.redirect_menu:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.go_back {
  padding: 4px 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.go_back:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.go_back a {
  color: white;
  text-decoration: none;
}

.centerpartpage {
  flex: 1;
  width: 100%;
  padding: 20px 24px;
  display: flex;
  gap: 20px;
  overflow-x: hidden;
  max-width: 1400px;
  margin: 0 auto;
  align-items: flex-start;
}

.game-content-wrapper {
  flex: 1;
  min-height: 500px;
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0e6f7;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.game-placeholder {
  text-align: center;
  padding: 40px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
}

.game-placeholder h2 {
  color: #5a2d7a;
  font-size: 1.8rem;
  margin: 0 0 8px 0;
}

.placeholder-text {
  font-size: 1.2rem;
  color: #b241d1;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.placeholder-hint {
  color: #888;
  font-size: 0.95rem;
  margin: 0;
}

@media (max-width: 1024px) {
  .centerpartpage {
    padding: 16px 20px;
    gap: 16px;
  }

  .game-content-wrapper {
    min-height: 400px;
    padding: 24px;
  }
}

@media (max-width: 768px) {
  .topmenu {
    flex-direction: column;
    text-align: center;
    gap: 6px;
    padding: 8px 16px;
  }

  .rightparttopmenu {
    justify-content: center;
  }

  .centerpartpage {
    flex-direction: column;
    padding: 16px;
    gap: 16px;
    align-items: stretch;
  }

  .game-content-wrapper {
    min-height: 350px;
    padding: 20px;
    border-radius: 12px;
  }

  .game-placeholder {
    padding: 24px;
  }

  .placeholder-icon {
    font-size: 48px;
  }

  .game-placeholder h2 {
    font-size: 1.5rem;
  }
}

@media (max-width: 480px) {
  .topmenu {
    padding: 6px 12px;
    font-size: 0.8rem;
  }

  .logo {
    font-size: 0.75rem;
  }

  .rightparttopmenu {
    font-size: 0.75rem;
    gap: 8px;
  }

  .redirect_menu,
  .go_back {
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  .centerpartpage {
    padding: 12px;
    gap: 12px;
  }

  .game-content-wrapper {
    min-height: 250px;
    padding: 16px;
    border-radius: 10px;
  }

  .game-placeholder {
    padding: 16px;
  }

  .placeholder-icon {
    font-size: 36px;
  }

  .game-placeholder h2 {
    font-size: 1.2rem;
  }

  .placeholder-text {
    font-size: 1rem;
  }

  .placeholder-hint {
    font-size: 0.85rem;
  }
}
</style>