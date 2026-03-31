<template>
  <div class="ml-predict-container">
    <!-- Переключатель между режимами -->
    <div class="mode-switcher">
      <button 
        :class="['mode-btn', { active: currentMode === 'numbers' }]"
        @click="switchMode('numbers')"
      >
        По номерам
      </button>
      <button 
        :class="['mode-btn', { active: currentMode === 'topics' }]"
        @click="switchMode('topics')"
      >
        По темам
      </button>
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Анализируем данные с помощью ИИ...</p>
    </div>

    <!-- Ошибка -->
    <div v-if="error" class="error-state">
      <p class="error-icon">⚠️</p>
      <p class="error-message">{{ error }}</p>
      <button @click="loadPredictions" class="retry-btn">Повторить</button>
    </div>

    <!-- Результаты по номерам -->
    <div v-if="!loading && !error && currentMode === 'numbers'" class="results">
      <div class="results-header">
        <h3>Вероятность успешного решения</h3>
        <p class="results-subtitle">Чем выше процент - тем лучше вы владеете материалом</p>
      </div>

      <div class="results-grid">
        <div 
          v-for="item in sortedNumbers" 
          :key="item.number"
          class="result-card"
          :class="getChanceClass(item.success_probability)"
        >
          <div class="card-header">
            <span class="card-title">Задание №{{ item.number }}</span>
            <span class="chance-badge">{{ getChanceLevel(item.success_probability) }}</span>
          </div>
          
          <div class="card-content">
            <div class="probability-bar-container">
              <div class="probability-bar">
                <div 
                  class="probability-fill" 
                  :style="{ width: (item.success_probability * 100) + '%' }"
                  :class="getSuccessClass(item.success_probability)"
                ></div>
              </div>
              <span class="probability-value">{{ (item.success_probability * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="card-metrics">
              <div class="metric">
                <span class="metric-label">Попыток:</span>
                <span class="metric-value">{{ item.attempts }}</span>
              </div>
              <div class="metric" v-if="item.avg_score">
                <span class="metric-label">Ср. балл:</span>
                <span class="metric-value">{{ (item.avg_score * 100).toFixed(1) }}%</span>
              </div>
              <div class="metric" v-if="item.weighted_accuracy">
                <span class="metric-label">Взвеш. точность:</span>
                <span class="metric-value">{{ (item.weighted_accuracy * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          
          <div class="card-footer">
            <p class="recommendation" v-if="item.success_probability < 0.5">
              🔴 Низкий шанс успеха. Требуется срочное повторение материала
            </p>
            <p class="recommendation" v-else-if="item.success_probability < 0.7">
              🟡 Средний шанс успеха. Рекомендуется дополнительная практика
            </p>
            <p class="recommendation" v-else-if="item.success_probability < 0.9">
              🟢 Хороший шанс успеха. Продолжай в том же духе
            </p>
            <p class="recommendation" v-else>
              💪 Высокий шанс успеха! Ты отлично владеешь материалом
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Результаты по темам -->
    <div v-if="!loading && !error && currentMode === 'topics'" class="results">
      <div class="results-header">
        <h3>Вероятность успешного решения</h3>
        <p class="results-subtitle">Чем выше процент - тем лучше вы владеете темой</p>
      </div>

      <div class="results-grid">
        <div 
          v-for="item in sortedTopics" 
          :key="item.topic"
          class="result-card"
          :class="getChanceClass(item.success_probability)"
        >
          <div class="card-header">
            <span class="card-title">{{ item.topic }}</span>
            <span class="chance-badge">{{ getChanceLevel(item.success_probability) }}</span>
          </div>
          
          <div class="card-content">
            <div class="probability-bar-container">
              <div class="probability-bar">
                <div 
                  class="probability-fill" 
                  :style="{ width: (item.success_probability * 100) + '%' }"
                  :class="getSuccessClass(item.success_probability)"
                ></div>
              </div>
              <span class="probability-value">{{ (item.success_probability * 100).toFixed(1) }}%</span>
            </div>
            
            <div class="card-metrics">
              <div class="metric">
                <span class="metric-label">Номера:</span>
                <span class="metric-value">{{ item.numbers.join(', ') }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Попыток:</span>
                <span class="metric-value">{{ item.total_attempts }}</span>
              </div>
            </div>
          </div>
          
          <div class="card-footer">
            <p class="recommendation" v-if="item.success_probability < 0.5">
              🔴 Низкий шанс успеха. Требуется срочное повторение материала
            </p>
            <p class="recommendation" v-else-if="item.success_probability < 0.7">
              🟡 Средний шанс успеха. Рекомендуется дополнительная практика
            </p>
            <p class="recommendation" v-else-if="item.success_probability < 0.9">
              🟢 Хороший шанс успеха. Продолжай в том же духе
            </p>
            <p class="recommendation" v-else>
              💪 Высокий шанс успеха! Ты отлично владеешь материалом
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Нет данных -->
    <div v-if="!loading && !error && (!predictionsByNumber.length && !predictionsByTopic.length)" class="no-data">
      <p class="no-data-icon">📊</p>
      <p class="no-data-text">Недостаточно данных для ML предсказаний</p>
      <p class="no-data-hint">Нужно минимум 3 попытки по каждому номеру/теме</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

// Определяем окружение и соответствующий URL
const isProduction = import.meta.env.PROD
const ML_API_URL = isProduction 
  ? '/ml-api'  // Прямой URL на сервер с моделью в продакшене
  : '/api'                         // Прокси для разработки (работает через Vite)

export default {
  name: 'MlPredict',
  props: {
    subject: {
      type: String,
      required: true
    },
    subjectName: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const currentMode = ref('numbers')
    const loading = ref(true)
    const error = ref(null)
    
    const predictionsByNumber = ref([])
    const predictionsByTopic = ref([])
    
    // Логирование этапов
    const logStage = (stage, data) => {
      console.log(`[ML Predict] ${stage}:`, data)
    }
    
    const callPredictApi = async (features, originalItem) => {
      const startTime = Date.now()
      try {
        const requestBody = {
          attempts: features.attempts,
          avg_score: features.avg_score,
          weighted_accuracy: features.weighted_accuracy,
          recent_accuracy: features.recent_accuracy || features.weighted_accuracy,
          days_since_last_attempt: features.days_since_last_attempt,
          avg_difficulty: features.avg_difficulty,
          number: features.number,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }
        
        logStage('API Request', {
          number: features.number,
          topic: originalItem?.topic,
          requestBody,
          url: `${ML_API_URL}/predict`
        })
        
        const response = await fetch(`${ML_API_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
        
        const responseTime = Date.now() - startTime
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }
        
        const result = await response.json()
        
        let successProbability = result.prediction
        
        if (successProbability < 0) successProbability = 0
        if (successProbability > 1) successProbability = 1
        
        logStage('API Response', {
          number: features.number,
          topic: originalItem?.topic,
          rawPrediction: result.prediction,
          adjustedPrediction: successProbability,
          responseTime: `${responseTime}ms`,
          modelInfo: result.model_info || 'Not provided'
        })
        
        return {
          success: true,
          success_probability: successProbability,
          raw_prediction: result.prediction
        }
      } catch (err) {
        const responseTime = Date.now() - startTime
        logStage('API Error', {
          number: features.number,
          topic: originalItem?.topic,
          error: err.message,
          responseTime: `${responseTime}ms`
        })
        console.error('API call failed:', err)
        return {
          success: false,
          error: err.message,
          success_probability: 0.5
        }
      }
    }
    
    const loadPredictions = async () => {
      const overallStartTime = Date.now()
      logStage('Start', { subject: props.subject, timestamp: new Date().toISOString() })
      
      try {
        loading.value = true
        error.value = null
        
        // 1. Проверка аутентификации
        logStage('Auth Check', 'Getting user...')
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw new Error('Ошибка аутентификации')
        if (!user) throw new Error('Пользователь не аутентифицирован')
        logStage('Auth Success', { userId: user.id })
        
        // 2. Загрузка фич
        const tableName = `feature_snapshot_${props.subject}`
        logStage('Fetch Features', { tableName, userId: user.id })
        
        const { data: features, error: featuresError } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id)
        
        if (featuresError) throw featuresError
        
        logStage('Features Loaded', {
          count: features?.length || 0,
          sample: features?.slice(0, 3).map(f => ({
            number: f.number,
            topic: f.topic,
            attempts: f.attempts,
            avg_score: f.avg_score,
            weighted_accuracy: f.weighted_accuracy,
            days_since_last_attempt: f.days_since_last_attempt
          }))
        })
        
        if (!features || features.length === 0) {
          logStage('No Data', 'No features found for user')
          predictionsByNumber.value = []
          predictionsByTopic.value = []
          return
        }
        
        // 3. Анализ распределения данных
        const numbersDistribution = {}
        const topicsDistribution = {}
        features.forEach(f => {
          numbersDistribution[f.number] = (numbersDistribution[f.number] || 0) + 1
          if (f.topic) topicsDistribution[f.topic] = (topicsDistribution[f.topic] || 0) + 1
        })
        
        logStage('Data Distribution', {
          uniqueNumbers: Object.keys(numbersDistribution).length,
          numbersWithCounts: numbersDistribution,
          uniqueTopics: Object.keys(topicsDistribution).length,
          topicsWithCounts: Object.keys(topicsDistribution).slice(0, 10).reduce((acc, t) => {
            acc[t] = topicsDistribution[t]
            return acc
          }, {})
        })
        
        const numbersMap = new Map()
        const topicsMap = new Map()
        
        let apiCallsCount = 0
        let apiErrorsCount = 0
        
        // 4. Обработка каждой фичи
        for (const item of features) {
          try {
            const featuresData = {
              attempts: item.attempts,
              avg_score: item.avg_score,
              weighted_accuracy: item.weighted_accuracy,
              recent_accuracy: item.recent_accuracy || item.weighted_accuracy,
              days_since_last_attempt: item.days_since_last_attempt,
              avg_difficulty: item.avg_difficulty,
              number: item.number
            }
            
            logStage('Processing Item', {
              number: item.number,
              topic: item.topic,
              featuresData
            })
            
            const prediction = await callPredictApi(featuresData, item)
            apiCallsCount++
            if (!prediction.success) apiErrorsCount++
            
            // Агрегация по номерам
            if (!numbersMap.has(item.number)) {
              numbersMap.set(item.number, {
                number: item.number,
                attempts: 0,
                total_success_probability: 0,
                count: 0,
                rawPredictions: [],
                avg_scores: [],
                weighted_accuracies: []
              })
            }
            
            const numData = numbersMap.get(item.number)
            numData.attempts += item.attempts
            numData.total_success_probability += prediction.success_probability
            numData.count += 1
            numData.rawPredictions.push(prediction.success_probability)
            numData.avg_scores.push(item.avg_score)
            numData.weighted_accuracies.push(item.weighted_accuracy)
            
            // Агрегация по темам
            if (item.topic && item.topic.trim() !== '') {
              const topicName = item.topic.trim()
              
              if (!topicsMap.has(topicName)) {
                topicsMap.set(topicName, {
                  topic: topicName,
                  numbers: new Set(),
                  total_attempts: 0,
                  total_success_probability: 0,
                  count: 0,
                  rawPredictions: [],
                  numbersList: []
                })
              }
              
              const topicData = topicsMap.get(topicName)
              topicData.numbers.add(item.number)
              topicData.total_attempts += item.attempts
              topicData.total_success_probability += prediction.success_probability
              topicData.count += 1
              topicData.rawPredictions.push(prediction.success_probability)
              topicData.numbersList.push(item.number)
            }
            
          } catch (err) {
            console.error('Error predicting for item:', item.number, err)
            apiErrorsCount++
          }
        }
        
        logStage('API Calls Summary', {
          totalCalls: apiCallsCount,
          errors: apiErrorsCount,
          successRate: `${((apiCallsCount - apiErrorsCount) / apiCallsCount * 100).toFixed(1)}%`
        })
        
        // 5. Преобразование номеров с детальной статистикой
        const numbersData = Array.from(numbersMap.values())
          .filter(item => item.attempts >= 3)
          .map(item => {
            const success_probability = item.total_success_probability / item.count
            const avg_score = item.avg_scores.reduce((a, b) => a + b, 0) / item.avg_scores.length
            const weighted_accuracy = item.weighted_accuracies.reduce((a, b) => a + b, 0) / item.weighted_accuracies.length
            
            const deviation = Math.abs(success_probability - avg_score)
            
            logStage('Number Aggregation', {
              number: item.number,
              attempts: item.attempts,
              topicsCount: item.count,
              avgScore: avg_score,
              weightedAccuracy: weighted_accuracy,
              modelPrediction: success_probability,
              deviation: deviation,
              isOptimistic: success_probability > avg_score + 0.15 ? '⚠️ TOO OPTIMISTIC' : 'OK',
              rawPredictions: item.rawPredictions
            })
            
            return {
              number: item.number,
              attempts: item.attempts,
              success_probability: success_probability,
              avg_score: avg_score,
              weighted_accuracy: weighted_accuracy,
              deviation: deviation
            }
          })
        
        predictionsByNumber.value = numbersData
        
        // 6. Преобразование тем с детальной статистикой
        const topicsData = Array.from(topicsMap.values())
          .filter(item => item.count >= 3)
          .map(item => {
            const success_probability = item.total_success_probability / item.count
            
            logStage('Topic Aggregation', {
              topic: item.topic,
              numbers: Array.from(item.numbers),
              totalAttempts: item.total_attempts,
              topicsCount: item.count,
              modelPrediction: success_probability,
              rawPredictions: item.rawPredictions
            })
            
            return {
              topic: item.topic,
              numbers: Array.from(item.numbers).sort((a, b) => a - b),
              total_attempts: item.total_attempts,
              success_probability: success_probability
            }
          })
        
        predictionsByTopic.value = topicsData
        
        // 7. Итоговая статистика
        const optimisticNumbers = numbersData.filter(n => n.deviation > 0.15 && n.success_probability > n.avg_score)
        const pessimisticNumbers = numbersData.filter(n => n.deviation > 0.15 && n.success_probability < n.avg_score)
        
        logStage('Final Summary', {
          totalNumbers: numbersData.length,
          totalTopics: topicsData.length,
          numbersWithHighDeviation: optimisticNumbers.length + pessimisticNumbers.length,
          optimisticNumbers: optimisticNumbers.map(n => ({
            number: n.number,
            prediction: n.success_probability,
            avgScore: n.avg_score,
            diff: n.deviation
          })),
          pessimisticNumbers: pessimisticNumbers.map(n => ({
            number: n.number,
            prediction: n.success_probability,
            avgScore: n.avg_score,
            diff: n.deviation
          })),
          totalExecutionTime: `${Date.now() - overallStartTime}ms`
        })
        
        if (optimisticNumbers.length > 0) {
          console.warn('[ML Predict] ⚠️ Обнаружены оптимистичные предсказания:', optimisticNumbers)
        }
        
      } catch (err) {
        logStage('Fatal Error', {
          message: err.message,
          stack: err.stack
        })
        console.error('Ошибка при загрузке предсказаний:', err)
        error.value = err.message
      } finally {
        loading.value = false
        logStage('Complete', { timestamp: new Date().toISOString() })
      }
    }
    
    const sortedNumbers = computed(() => {
      return [...predictionsByNumber.value]
        .sort((a, b) => a.success_probability - b.success_probability)
    })
    
    const sortedTopics = computed(() => {
      return [...predictionsByTopic.value]
        .sort((a, b) => a.success_probability - b.success_probability)
    })
    
    const switchMode = (mode) => {
      logStage('Switch Mode', { from: currentMode.value, to: mode })
      currentMode.value = mode
    }
    
    const getChanceClass = (successProbability) => {
      if (successProbability < 0.5) return 'low-chance'
      if (successProbability < 0.7) return 'medium-chance'
      if (successProbability < 0.9) return 'good-chance'
      return 'high-chance'
    }
    
    const getSuccessClass = (successProbability) => {
      if (successProbability >= 0.9) return 'excellent'
      if (successProbability >= 0.7) return 'good'
      if (successProbability >= 0.5) return 'average'
      return 'poor'
    }
    
    const getChanceLevel = (successProbability) => {
      if (successProbability < 0.5) return 'Низкий шанс'
      if (successProbability < 0.7) return 'Средний шанс'
      if (successProbability < 0.9) return 'Хороший шанс'
      return 'Высокий шанс'
    }
    
    onMounted(() => {
      loadPredictions()
    })
    
    return {
      currentMode,
      loading,
      error,
      predictionsByNumber,
      predictionsByTopic,
      sortedNumbers,
      sortedTopics,
      switchMode,
      getChanceClass,
      getSuccessClass,
      getChanceLevel,
      loadPredictions
    }
  }
}
</script>

<style scoped>
/* ... остальные стили остаются без изменений ... */
.metric {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.metric:last-child {
  border-bottom: none;
}

.metric-label {
  font-size: 13px;
  color: #666;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
</style>

<style scoped>
.ml-predict-container {
  width: 100%;
  min-height: 400px;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mode-switcher {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  padding: 4px;
  background: #f0f0f0;
  border-radius: 40px;
  max-width: 300px;
}

.mode-btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 30px;
  background: transparent;
  color: #666;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.mode-btn.active {
  background: white;
  color: #b241d1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f0f0f0;
  border-top-color: #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 40px 20px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  color: #d32f2f;
  margin-bottom: 20px;
  font-size: 16px;
}

.retry-btn {
  padding: 12px 30px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 30px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.retry-btn:hover {
  background: #8e24aa;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(178, 65, 209, 0.3);
}

.results-header {
  margin-bottom: 24px;
  padding: 0 4px;
}

.results-header h3 {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  font-weight: 600;
}

.results-subtitle {
  color: #666;
  font-size: 14px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
  width: 100%;
}

@media (min-width: 1600px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  }
}

@media (max-width: 1200px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  }
}

@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .mode-switcher {
    max-width: 100%;
  }
}

.result-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

.result-card.low-chance {
  border-left: 4px solid #d32f2f;
}

.result-card.medium-chance {
  border-left: 4px solid #ff9800;
}

.result-card.good-chance {
  border-left: 4px solid #b8e86c;
}

.result-card.high-chance {
  border-left: 4px solid #4caf50;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.chance-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.low-chance .chance-badge {
  background: #ffebee;
  color: #d32f2f;
}

.medium-chance .chance-badge {
  background: #fff3e0;
  color: #ef6c00;
}

.good-chance .chance-badge {
  background: #e9f6d2;
  color: #61bc00;
}

.high-chance .chance-badge {
  background: #e8f5e8;
  color: #2e7d32;
}

.card-content {
  padding: 20px;
  flex: 1;
}

.probability-bar-container {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.probability-bar {
  flex: 1;
  height: 24px;
  background: #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
}

.probability-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.probability-fill.excellent {
  background: linear-gradient(90deg, #4caf50, #8bc34a);
}

.probability-fill.good {
  background: linear-gradient(90deg, #8bc34a, #cddc39);
}

.probability-fill.average {
  background: linear-gradient(90deg, #ffc107, #ff9800);
}

.probability-fill.poor {
  background: linear-gradient(90deg, #ff9800, #f44336);
}

.probability-value {
  min-width: 70px;
  font-weight: 700;
  font-size: 18px;
  color: #333;
  text-align: right;
}

.card-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.metric:last-child {
  border-bottom: none;
}

.metric-label {
  font-size: 13px;
  color: #666;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.card-footer {
  padding: 16px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.recommendation {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.low-chance .recommendation {
  color: #d32f2f;
}

.medium-chance .recommendation {
  color: #ef6c00;
}

.good-chance .recommendation {
  color: #61bc00;
}

.high-chance .recommendation {
  color: #2e7d32;
}

.no-data {
  text-align: center;
  padding: 60px 20px;
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-data-text {
  font-size: 18px;
  color: #666;
  margin-bottom: 8px;
}

.no-data-hint {
  font-size: 14px;
  color: #999;
}
</style>