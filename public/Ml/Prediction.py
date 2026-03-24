import pandas as pd
import joblib
import numpy as np
import tensorflowjs as tfjs

# Загрузка модели и порога
model = joblib.load('best_model.pkl')
with open('optimal_threshold.txt', 'r') as f:
    threshold = float(f.read())

# Функция для предсказания
def predict_student_success(attempts, weighted_accuracy, avg_score, 
                           days_since_last_attempt, avg_difficulty):
    """
    Предсказание успеха ученика в следующей попытке
    """
    data = pd.DataFrame([[attempts, weighted_accuracy, avg_score, 
                          days_since_last_attempt, avg_difficulty]],
                       columns=['attempts', 'weighted_accuracy', 'avg_score',
                                'days_since_last_attempt', 'avg_difficulty'])
    
    probability = model.predict_proba(data)[0, 1]
    prediction = 1 if probability >= threshold else 0
    
    return {
        'probability': probability,
        'prediction': 'УСПЕХ' if prediction == 1 else 'НЕУСПЕХ',
        'confidence': probability if prediction == 1 else 1 - probability
    }

# Пример использования
result = predict_student_success(
    attempts=3,
    weighted_accuracy=0.7,
    avg_score=0.65,
    days_since_last_attempt=5,
    avg_difficulty=0.5
)

print(f"Вероятность успеха: {result['probability']:.2%}")
print(f"Предсказание: {result['prediction']}")
print(f"Уверенность: {result['confidence']:.2%}")

# Сохраните вашу модель для браузера
tfjs.converters.save_keras_model(model, 'public/models/random_forest_model')