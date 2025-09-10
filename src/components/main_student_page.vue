<script>
import DailyMotivation from './DailyMotivation.vue';
import subject_chemistry from './subject_chemistry.vue'
import subject_biology from './subject_biology.vue';
import { supabase } from '../supabase'; // Импортируем клиент Supabase

export default {
  components: {
    DailyMotivation,
    subject_chemistry,
    subject_biology
  },
  data() {
    return {
      chemistryHasData: false,
      biologyHasData: false,
      showNoCoursesMessage: false,
      // Добавляем данные о студенте
      studentData: {
        subject1: '',
        subject2: '',
        subject1_payment_date: null,
        subject2_payment_date: null
      },
      // Флаг для отображения уведомления об оплате
      showPaymentNotification: false,
      paymentNotificationText: '',
      // Флаг для отображения модального окна просрочки
      showOverdueModal: false,
      overdueModalText: '',
      loading: true
    }
  },
  async mounted() {
    // Загружаем данные студента из Supabase
    await this.loadStudentData();
    this.loading = false;
  },
  methods: {
    handleChemistryData(hasData) {
      this.chemistryHasData = hasData;
      this.checkCoursesAvailability();
    },
    handleBiologyData(hasData) {
      this.biologyHasData = hasData;
      this.checkCoursesAvailability();
    },
    checkCoursesAvailability() {
      // Проверяем после небольшой задержки, чтобы оба компонента успели загрузиться
      setTimeout(() => {
        this.showNoCoursesMessage = !this.chemistryHasData && !this.biologyHasData;
      }, 5000);
    },
    // Метод для загрузки данных студента из Supabase
    async loadStudentData() {
      try {
        // Получаем текущего пользователя
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('Пользователь не авторизован');
          return;
        }
        
        // Запрашиваем данные студента из таблицы students
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          console.error('Ошибка при загрузке данных студента:', error);
          return;
        }
        
        if (data) {
          this.studentData = {
            subject1: data.subject1 || '',
            subject2: data.subject2 || '',
            subject1_payment_date: data.subject1_payment_date,
            subject2_payment_date: data.subject2_payment_date
          };
          
          // Проверяем необходимость показа уведомления
          this.checkPaymentDates();
        }
      } catch (error) {
        console.error('Исключение при загрузке данных:', error);
      }
    },
    // Метод для проверки дат оплаты
    checkPaymentDates() {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня для точного сравнения
      
      const notificationMessages = [];
      const overdueMessages = [];
      
      // Проверяем subject1_payment_date
      if (this.studentData.subject1_payment_date) {
        const paymentDate = new Date(this.studentData.subject1_payment_date);
        paymentDate.setHours(0, 0, 0, 0);
        
        const daysUntilPayment = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilPayment <= 3 && daysUntilPayment >= 0) {
          const subjectName = this.formatSubjectName(this.studentData.subject1, 'accusative');
          notificationMessages.push(
            `Оплатите ${subjectName} до ${this.formatDate(paymentDate)}`
          );
        } else if (daysUntilPayment < 0) {
          const subjectName = this.formatSubjectName(this.studentData.subject1, 'accusative');
          overdueMessages.push(subjectName);
        }
      }
      
      // Проверяем subject2_payment_date
      if (this.studentData.subject2_payment_date) {
        const paymentDate = new Date(this.studentData.subject2_payment_date);
        paymentDate.setHours(0, 0, 0, 0);
        
        const daysUntilPayment = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilPayment <= 3 && daysUntilPayment >= 0) {
          const subjectName = this.formatSubjectName(this.studentData.subject2, 'accusative');
          notificationMessages.push(
            `Оплатите ${subjectName} до ${this.formatDate(paymentDate)}`
          );
        } else if (daysUntilPayment < 0) {
          const subjectName = this.formatSubjectName(this.studentData.subject2, 'accusative');
          overdueMessages.push(subjectName);
        }
      }
      
      // Если есть сообщения для показа (предупреждение за 3 дня)
      if (notificationMessages.length > 0) {
        this.showPaymentNotification = true;
        this.paymentNotificationText = notificationMessages.join(', ');
      }
      
      // Если есть просроченные платежи
      if (overdueMessages.length > 0) {
        this.showOverdueModal = true;
        if (overdueMessages.length === 1) {
          this.overdueModalText = `Срочно оплатите ${overdueMessages[0]}, чтобы продолжить обучение`;
        } else {
          this.overdueModalText = `Срочно оплатите ${overdueMessages.join(' и ')}, чтобы продолжить обучение`;
        }
        
        // Автоматически закрываем модальное окно через 3 секунды
        setTimeout(() => {
          this.showOverdueModal = false;
        }, 10*1000);
      }
    },
    // Вспомогательный метод для форматирования даты
    formatDate(date) {
      return date.toLocaleDateString('ru-RU');
    },
    // Метод для обработки названий предметов
    formatSubjectName(subject, caseType) {
      if (!subject) return '';
      
      // Убираем второе слово (все после пробела)
      const firstWord = subject.split(' ')[0];
      
      // Преобразуем в нужный падеж
      if (caseType === 'accusative') {
        // Правила преобразования в винительный падеж
        if (firstWord.endsWith('ия')) {
          return firstWord.replace('ия', 'ию');
        }
        if (firstWord.endsWith('а')) {
          return firstWord.replace('а', 'у');
        }
        if (firstWord.endsWith('я')) {
          return firstWord.replace('я', 'ю');
        }
        // Для слов мужского рода без изменения окончания
        return firstWord;
      }
      
      return firstWord;
    },
    // Метод для ручного закрытия модального окна
    closeOverdueModal() {
      this.showOverdueModal = false;
    }
  }
}
</script>

<template>

  
  
    <!-- Модальное окно для просроченных платежей -->
    <div v-if="showOverdueModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Внимание!</h3>
        </div>
        <div class="modal-body">
          <p>{{ overdueModalText }}</p>
        </div>
        <div class="modal-footer">
          <p>Закрытие через 10 секунд...</p>
        </div>
      </div>
    </div>
    
    <div class="title">
      <!-- Показываем уведомление об оплате вместо DailyMotivation, если нужно -->
      <div v-if="showPaymentNotification" class="payment-notification">
        {{ paymentNotificationText }}
      </div>
      <DailyMotivation v-else />
    </div>
    
    <div v-if="showNoCoursesMessage" class="no-courses-message">
      Нет информации о доступных курсах, обратитесь к учителю
    </div>
    
    <div v-else class="block_of_content">
      <subject_chemistry 
        @has-data="handleChemistryData(true)"
        @no-data="handleChemistryData(false)"
      />
      <subject_biology 
        @has-data="handleBiologyData(true)"
        @no-data="handleBiologyData(false)"
      />
    </div>

</template>

<style>
  .title{
    font-size: 2vw;
    font-weight: bold;
    display: flex;
    align-items: center;
  }
  
  .block_of_content{
    background-color: #f9f8ff;
    margin-bottom: 5%;
    border-radius: 2%;
    display: grid;
    grid-template-columns: 35% 35%;
    gap: 30%;
    padding: 10%;
  }

  .no-courses-message {
    text-align: center;
    padding: 40px;
    font-size: 1.5rem;
    color: #666;
    background-color: #f8f9fa;
    border-radius: 10px;
    margin: 20px 0;
  }
  
  .payment-notification {
    text-align: center;
    padding: 20px;
    font-size: 1.2rem;
    color: #d9534f;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 10px;
    margin: 10px 0;
    width: 100%;
  }
  
  .loading {
    text-align: center;
    padding: 40px;
    font-size: 1.2rem;
    color: #666;
  }
  
  /* Стили для модального окна */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background-color: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    width: 90%;
    text-align: center;
    animation: modal-appear 0.3s ease-out;
  }
  
  .modal-header h3 {
    margin: 0 0 15px 0;
    color: #d9534f;
    font-size: 1.5rem;
  }
  
  .modal-body p {
    margin: 0 0 20px 0;
    font-size: 1.1rem;
    line-height: 1.5;
    color: #333;
  }
  
  .modal-footer p {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
    font-style: italic;
  }
  
  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>