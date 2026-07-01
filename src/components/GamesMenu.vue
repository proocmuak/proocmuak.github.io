<template>
  <div class="games-menu" 
       @mouseenter="isExpanded = true" 
       @mouseleave="isExpanded = false"
       :class="{ expanded: isExpanded }">
    <div class="menu-item" 
         :class="{ active: currentGame === 'cards' }"
         @click="$emit('select-game', 'cards')">
      <span class="menu-icon">🃏</span>
      <span class="menu-text">Карточки для изучения</span>
    </div>
    <div class="menu-item" 
         :class="{ active: currentGame === 'quiz' }"
         @click="$emit('select-game', 'quiz')">
      <span class="menu-icon">🧬</span>
      <span class="menu-text">Биологический квиз</span>
    </div>
    <div class="menu-item" 
         :class="{ active: currentGame === 'constructor' }"
         @click="$emit('select-game', 'constructor')">
      <span class="menu-icon">🧪</span>
      <span class="menu-text">Органический конструктор</span>
    </div>
    <div class="menu-item" 
         :class="{ active: currentGame === 'simulator' }"
         @click="$emit('select-game', 'simulator')">
      <span class="menu-icon">🌍</span>
      <span class="menu-text">Экологический симулятор</span>
    </div>
    <div class="menu-item" 
         :class="{ active: currentGame === 'detective' }"
         @click="$emit('select-game', 'detective')">
      <span class="menu-icon">🔍</span>
      <span class="menu-text">Химический детектив</span>
    </div>
    <div class="menu-item" 
         :class="{ active: currentGame === 'genetic' }"
         @click="$emit('select-game', 'genetic')">
      <span class="menu-icon">🧬</span>
      <span class="menu-text">Генетический редактор</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GamesMenu',
  props: {
    currentGame: {
      type: String,
      default: 'cards'
    }
  },
  data() {
    return {
      isExpanded: false
    }
  }
}
</script>

<style scoped>
.games-menu {
  background: #f9f8ff;
  border-radius: 16px;
  padding: 8px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  width: 48px;
  flex-shrink: 0;
  align-self: flex-start;
  position: sticky;
  top: 20px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  min-height: 300px;
}

.games-menu.expanded {
  width: 220px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  color: #333;
  font-size: 13px;
  font-family: 'Evolventa', sans-serif;
  white-space: nowrap;
}

.menu-item:hover {
  background-color: rgba(178, 65, 209, 0.05);
  color: #b241d1;
}

.menu-item.active {
  background-color: rgba(178, 65, 209, 0.08);
  color: #b241d1;
  border-left-color: #b241d1;
  font-weight: 600;
}

.menu-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.menu-text {
  opacity: 0;
  transition: opacity 0.25s ease;
  overflow: hidden;
  flex: 1;
}

.games-menu.expanded .menu-text {
  opacity: 1;
}

@media (max-width: 768px) {
  .games-menu {
    width: 100%;
    position: relative;
    top: 0;
    display: flex;
    overflow-x: auto;
    padding: 6px 12px;
    gap: 2px;
    border-radius: 12px;
    height: auto;
    min-height: 40px;
    min-width: 100%;
  }

  .games-menu.expanded {
    width: 100%;
  }

  .menu-item {
    padding: 4px 10px;
    font-size: 12px;
    white-space: nowrap;
    border-left: none;
    border-bottom: 2px solid transparent;
    flex-shrink: 0;
  }

  .menu-item.active {
    border-left: none;
    border-bottom-color: #b241d1;
  }

  .menu-text {
    opacity: 1;
  }

  .games-menu.expanded .menu-text {
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .games-menu {
    padding: 4px 8px;
    min-height: 34px;
    border-radius: 10px;
  }

  .menu-item {
    padding: 3px 8px;
    font-size: 11px;
    gap: 4px;
  }

  .menu-icon {
    font-size: 14px;
    width: 18px;
  }

  .menu-text {
    font-size: 11px;
  }
}
</style>