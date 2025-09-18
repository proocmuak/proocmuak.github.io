computed: {
  filteredTasks() {
    if (!this.filters.subject) return [];
    
    // Конфигурация для разных предметов
    const partConfig = {
      'Химия ЕГЭ': { firstPartMax: 28 },
      'Биология ЕГЭ': { firstPartMax: 21 }
    };
    
    const config = partConfig[this.filters.subject];
    
    let tasks = this.allTasks.filter(task => {
      // Фильтрация по предмету
      if (task.subject !== this.filters.subject) return false;
      
      // Фильтрация по разделам
      if (this.filters.sections && this.filters.sections.length > 0 && 
          !this.filters.sections.includes(task.section)) {
        return false;
      }
      
      // Фильтрация по темам
      if (this.filters.topics && this.filters.topics.length > 0 && 
          !this.filters.topics.includes(task.topic)) {
        return false;
      }
      
      // Фильтрация по части (универсальная)
      if (this.filters.part && config) {
        const isFirstPart = this.filters.part === 'Первая часть';
        // Преобразуем номер задачи в число для сравнения с firstPartMax
        const taskNumber = Number(task.number);
        const taskPart = taskNumber <= config.firstPartMax 
          ? 'Первая часть' 
          : 'Вторая часть';
        
        if (taskPart !== this.filters.part) return false;
      }
      
      // ФИКС: Фильтрация по номеру задания (сравниваем как строки)
      if (this.filters.taskNumber && this.filters.taskNumber.length > 0) {
        // Преобразуем фильтры в строки и сравниваем со строковым значением задачи
        const taskNumbers = this.filters.taskNumber.map(num => String(num));
        
        if (!taskNumbers.includes(String(task.number))) {
          return false;
        }
      }
      
      return true;
    });

    // Сортировка по номеру задания (преобразуем в числа для сортировки)
    tasks = [...tasks].sort((a, b) => Number(a.number) - Number(b.number));

    return tasks;
  },
  // ... остальной код
}