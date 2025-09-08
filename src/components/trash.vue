<template>
  <div class="allpage" @contextmenu.prevent @copy.prevent>
    <!-- остальной код без изменений -->
    
    <div class="task-content">
      <div 
        class="task-text" 
        v-html="sanitizeHtml(getTaskTextWithoutTables(task))"
        @copy.prevent
        @cut.prevent
        @dragstart.prevent
      ></div>
      <!-- остальной код -->
    </div>
    
    <!-- остальной код -->
  </div>
</template>

<script>
// В секции setup добавьте обработчик глобальных событий
onMounted(() => {
  // Блокировка контекстного меню
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.task-text')) {
      e.preventDefault()
      return false
    }
  })
  
  // Блокировка выделения текста (опционально)
  document.addEventListener('selectstart', (e) => {
    if (e.target.closest('.task-text')) {
      e.preventDefault()
      return false
    }
  })
})
</script>

<style scoped>
/* Добавьте эти стили для блокировки выделения текста */
.task-text {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
}

.task-text ::selection {
  background: transparent;
}

.task-text ::-moz-selection {
  background: transparent;
}

/* Дополнительная защита через псевдо-элемент */
.task-text {
  position: relative;
}

.task-text::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}
</style>