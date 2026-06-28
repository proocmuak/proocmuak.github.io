<template>
  <div class="main-student-page">
    <!-- Модальное окно для просроченных платежей -->
    <div v-if="showOverdueModal" class="modal-overlay-payment">
      <div class="modal-content-payment">
        <div class="modal-header-payment">
          <h3>Внимание!</h3>
        </div>
        <div class="modal-body-payment">
          <p>{{ overdueModalText }}</p>
        </div>
        <div class="modal-footer-payment">
          <p>Закрытие через 10 секунд...</p>
        </div>
      </div>
    </div>
    
    <div class="title">
      <div v-if="showPaymentNotification" class="payment-notification">
        {{ paymentNotificationText }}
      </div>
      <DailyMotivation v-else />
    </div>
    
    <div class="content-wrapper">
      <StudentDigest v-if="!showPaymentNotification" />

      <div class="block_of_content">
        <subject_chemistry 
          v-if="hasChemistry"
          @has-data="handleChemistryData(true)"
          @no-data="handleChemistryData(false)"
        />
        <subject_biology 
          v-if="hasBiology"
          @has-data="handleBiologyData(true)"
          @no-data="handleBiologyData(false)"
        />
        <subject_additional
          v-if="hasAdditional"
          @has-data="handleAdditionalData(true)"
          @no-data="handleAdditionalData(false)"
        />
      </div>
    </div>
    
    <div v-if="showNoCoursesMessage" class="no-courses-message">
      Нет информации о доступных курсах, обратитесь к учителю
    </div>
  </div>
</template>

<script>
import DailyMotivation from './DailyMotivation.vue';
import subject_chemistry from './subject_chemistry.vue'
import subject_biology from './subject_biology.vue'
import subject_additional from './subject_additional.vue'
import StudentDigest from './StudentDigest.vue'
import { supabase } from '../supabase';

export default {
  components: {
    DailyMotivation,
    subject_chemistry,
    subject_biology,
    subject_additional,
    StudentDigest
  },
  data() {
    return {
      chemistryHasData: false,
      biologyHasData: false,
      additionalHasData: false,
      showNoCoursesMessage: false,
      studentData: {
        subject1: '',
        subject2: '',
        subject1_payment_date: null,
        subject2_payment_date: null
      },
      showPaymentNotification: false,
      paymentNotificationText: '',
      showOverdueModal: false,
      overdueModalText: '',
      loading: true,
      hasChemistry: false,
      hasBiology: false,
      hasAdditional: false
    }
  },
  async mounted() {
    await this.loadStudentData();
    this.loading = false;
    setTimeout(() => {
      this.checkCoursesAvailability();
    }, 1000);
  },
  methods: {
    handleChemistryData(hasData) {
      this.chemistryHasData = hasData;
      this.hasChemistry = hasData;
      this.checkCoursesAvailability();
    },
    handleBiologyData(hasData) {
      this.biologyHasData = hasData;
      this.hasBiology = hasData;
      this.checkCoursesAvailability();
    },
    handleAdditionalData(hasData) {
      this.additionalHasData = hasData;
      this.hasAdditional = hasData;
      this.checkCoursesAvailability();
    },
    checkCoursesAvailability() {
      const hasAnyCourse = this.chemistryHasData || this.biologyHasData;
      this.showNoCoursesMessage = !hasAnyCourse;
    },
    
    async loadStudentData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('Пользователь не авторизован');
          return;
        }
        
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
          
          this.hasChemistry = !!data.subject1;
          this.hasBiology = !!data.subject2;
          
          if (data.additional_courses) {
            try {
              const courses = typeof data.additional_courses === 'string' 
                ? JSON.parse(data.additional_courses) 
                : data.additional_courses;
              this.hasAdditional = courses && courses.length > 0;
            } catch (e) {
              this.hasAdditional = false;
            }
          }
          
          this.checkPaymentDates();
        }
      } catch (error) {
        console.error('Исключение при загрузке данных:', error);
      }
    },
    
    checkPaymentDates() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const notificationMessages = [];
      const overdueMessages = [];
      
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
      
      if (notificationMessages.length > 0) {
        this.showPaymentNotification = true;
        this.paymentNotificationText = notificationMessages.join(', ');
      }
      
      if (overdueMessages.length > 0) {
        this.showOverdueModal = true;
        if (overdueMessages.length === 1) {
          this.overdueModalText = `Срочно оплатите ${overdueMessages[0]}, чтобы продолжить обучение`;
        } else {
          this.overdueModalText = `Срочно оплатите ${overdueMessages.join(' и ')}, чтобы продолжить обучение`;
        }
        
        setTimeout(() => {
          this.showOverdueModal = false;
        }, 10 * 1000);
      }
    },
    
    formatDate(date) {
      return date.toLocaleDateString('ru-RU');
    },
    
    formatSubjectName(subject, caseType) {
      if (!subject) return '';
      
      const firstWord = subject.split(' ')[0];
      
      if (caseType === 'accusative') {
        if (firstWord.endsWith('ия')) {
          return firstWord.replace('ия', 'ию');
        }
        if (firstWord.endsWith('а')) {
          return firstWord.replace('а', 'у');
        }
        if (firstWord.endsWith('я')) {
          return firstWord.replace('я', 'ю');
        }
        return firstWord;
      }
      
      return firstWord;
    },
    
    closeOverdueModal() {
      this.showOverdueModal = false;
    }
  }
}
</script>

<style scoped>
.main-student-page {
  min-height: 80vh;
  background-color: #f9f8ff;
  border-radius: 2.5%;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 1.6vw;
  font-weight: bold;
  display: flex;
  align-items: center;
  padding: 12px 20px 8px 20px;
  flex-shrink: 0;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px 12px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.block_of_content {
  background-color: #f9f8ff;
  border-radius: 2%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 16px;
  padding: 8px;
  flex: 1;
  min-height: 0;
}

.block_of_content > * {
  flex: 0 1 calc(33.33% - 16px);
  min-width: 160px;
  max-width: 320px;
}

.block_of_content:has(> :nth-child(2):last-child) > * {
  flex: 0 1 calc(50% - 16px);
  max-width: 380px;
}

.block_of_content:has(> :nth-child(1):last-child) > * {
  flex: 0 1 100%;
  max-width: 400px;
}

.no-courses-message {
  text-align: center;
  padding: 30px;
  font-size: 1.2rem;
  color: #666;
  background-color: #f8f9fa;
  border-radius: 10px;
  margin: 20px auto;
  max-width: 500px;
}

.payment-notification {
  text-align: center;
  padding: 12px 20px;
  font-size: 1rem;
  color: #d9534f;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  margin: 4px 0;
  width: 100%;
}

.modal-overlay-payment {
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

.modal-content-payment {
  background-color: white;
  padding: 20px 25px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 380px;
  width: 90%;
  text-align: center;
  animation: modal-appear 0.3s ease-out;
}

.modal-header-payment h3 {
  margin: 0 0 10px 0;
  color: #d9534f;
  font-size: 1.3rem;
}

.modal-body-payment p {
  margin: 0 0 15px 0;
  font-size: 1rem;
  line-height: 1.4;
  color: #333;
}

.modal-footer-payment p {
  margin: 0;
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: translateY(-15px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 1024px) {
  .block_of_content {
    gap: 12px;
    padding: 6px;
  }
  
  .block_of_content > * {
    flex: 0 1 calc(50% - 12px);
    min-width: 140px;
  }
  
  .block_of_content:has(> :nth-child(3)) > * {
    flex: 0 1 calc(50% - 12px);
  }
  
  .block_of_content:has(> :nth-child(3)) > *:last-child {
    flex: 0 1 100%;
    max-width: 380px;
  }
}

@media (max-width: 768px) {
  .title {
    font-size: 3.5vw;
    padding: 8px 15px 6px 15px;
  }
  
  .content-wrapper {
    padding: 0 12px 10px 12px;
  }
  
  .block_of_content {
    gap: 10px;
    padding: 6px;
  }
  
  .block_of_content > * {
    flex: 0 1 100%;
    min-width: unset;
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(2):last-child) > * {
    flex: 0 1 calc(50% - 10px);
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(3)) > * {
    flex: 0 1 100%;
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(3)) > *:last-child {
    flex: 0 1 100%;
    max-width: 100%;
    margin-top: 4px;
  }
  
  .no-courses-message {
    padding: 25px;
    font-size: 1rem;
    margin: 15px;
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 4vw;
    padding: 6px 10px 4px 10px;
  }
  
  .content-wrapper {
    padding: 0 8px 8px 8px;
  }
  
  .block_of_content {
    gap: 8px;
    padding: 4px;
  }
  
  .block_of_content > * {
    flex: 0 1 100%;
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(2):last-child) > * {
    flex: 0 1 100%;
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(3)) > * {
    flex: 0 1 100%;
    max-width: 100%;
  }
  
  .block_of_content:has(> :nth-child(3)) > *:last-child {
    flex: 0 1 100%;
    max-width: 100%;
    margin-top: 2px;
  }
  
  .no-courses-message {
    padding: 20px;
    font-size: 0.9rem;
    margin: 10px;
  }
}
</style>