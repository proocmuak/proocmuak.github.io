import os
import logging
import cv2
import numpy as np
from telegram import Update, InputFile
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from PIL import Image
import pytesseract
import io
from pdf2image import convert_from_bytes
import tempfile
from dotenv import load_dotenv

BOT_TOKEN = '8264719055:AAE6Ytr85Lh8MqRUozmkVyTQd_VhVXh--LQ'

def preprocess_image(image):
    """Предобработка изображения для улучшения распознавания"""
    # Конвертируем PIL Image в numpy array для OpenCV
    if isinstance(image, Image.Image):
        image = np.array(image)
        # Конвертируем RGB в BGR (OpenCV format)
        if image.shape[2] == 3:
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    
    # Конвертируем в grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Применяем Gaussian blur для уменьшения шума
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Применяем adaptive thresholding
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # Убираем шум с помощью морфологических операций
    kernel = np.ones((1, 1), np.uint8)
    processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    processed = cv2.medianBlur(processed, 3)
    
    return processed

def improve_ocr_quality(text):
    """Постобработка текста для улучшения качества"""
    # Убираем лишние переносы строк
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        if line:  # Пропускаем пустые строки
            # Исправляем common OCR ошибки
            line = line.replace('|', 'I').replace('l', 'I')
            line = line.replace('0', 'O').replace('1', 'I')
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = """
🤖 Добро пожаловать в улучшенный OCR бот!

📝 Советы для лучшего распознавания:
• Используйте хорошее освещение
• Фотографируйте текст под прямым углом
• Убедитесь, что текст в фокусе
• Используйте контрастный текст на однородном фоне

Отправьте мне:
📷 Фото с текстом
📄 PDF файл

Поддерживаются: русский, английский, немецкий, французский языки
    """
    await update.message.reply_text(welcome_text)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        await update.message.reply_text("🔄 Обрабатываю изображение...")
        
        # Получаем файл фото
        photo_file = await update.message.photo[-1].get_file()
        photo_bytes = await photo_file.download_as_bytearray()
        
        # Преобразуем в изображение
        image = Image.open(io.BytesIO(photo_bytes))
        
        # Предобработка изображения
        processed_image = preprocess_image(image)
        
        # Распознаем текст с улучшенными настройками
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789.,!?-+()/:;%&" '
        text = pytesseract.image_to_string(processed_image, lang='rus+eng', config=custom_config)
        
        # Улучшаем качество текста
        improved_text = improve_ocr_quality(text)
        
        if improved_text.strip():
            if len(improved_text) > 4000:
                with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', encoding='utf-8', delete=False) as temp_file:
                    temp_file.write(improved_text)
                    temp_file.flush()
                    await update.message.reply_document(
                        document=InputFile(temp_file.name, filename='recognized_text.txt')
                    )
                os.unlink(temp_file.name)
            else:
                await update.message.reply_text(f"📝 Распознанный текст:\n\n{improved_text}")
        else:
            await update.message.reply_text("❌ Не удалось распознать текст. Попробуйте другое изображение с более четким текстом.")
            
    except Exception as e:
        logger.error(f"Ошибка при обработке фото: {e}")
        await update.message.reply_text("❌ Произошла ошибка при обработке изображения.")

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        document = update.message.document
        
        if not document.file_name.lower().endswith('.pdf'):
            await update.message.reply_text("❌ Пожалуйста, отправьте PDF файл.")
            return
            
        await update.message.reply_text("🔄 Обрабатываю PDF... Это может занять некоторое время...")
        
        file = await document.get_file()
        pdf_bytes = await file.download_as_bytearray()
        
        # Конвертируем PDF в изображения с высоким DPI
        images = convert_from_bytes(pdf_bytes, dpi=300, poppler_path=r'C:\Program Files\poppler-23.11.0\Library\bin')  # Укажите путь если нужно
        
        all_text = []
        total_pages = len(images)
        
        for i, image in enumerate(images):
            # Отправляем прогресс каждые 5 страниц
            if (i + 1) % 5 == 0 or (i + 1) == total_pages:
                await update.message.reply_text(f"📄 Обработано {i + 1}/{total_pages} страниц...")
            
            # Предобработка и распознавание
            processed_image = preprocess_image(image)
            text = pytesseract.image_to_string(processed_image, lang='rus+eng')
            improved_text = improve_ocr_quality(text)
            
            if improved_text.strip():
                all_text.append(f"--- Страница {i+1} ---\n{improved_text}\n")
        
        if all_text:
            full_text = "\n".join(all_text)
            
            if len(full_text) > 4000:
                with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', encoding='utf-8', delete=False) as temp_file:
                    temp_file.write(full_text)
                    temp_file.flush()
                    await update.message.reply_document(
                        document=InputFile(temp_file.name, filename='recognized_text.txt')
                    )
                os.unlink(temp_file.name)
            else:
                await update.message.reply_text(f"📄 Распознанный текст из PDF:\n\n{full_text}")
        else:
            await update.message.reply_text("❌ Не удалось распознать текст в PDF.")
            
    except Exception as e:
        logger.error(f"Ошибка при обработке PDF: {e}")
        await update.message.reply_text("❌ Произошла ошибка при обработке PDF.")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Ошибка: {context.error}")
    if update and update.message:
        await update.message.reply_text("❌ Произошла непредвиденная ошибка.")

def main():
    if not BOT_TOKEN:
        raise ValueError("Не задан BOT_TOKEN в переменных окружения")
    
    # Укажите путь к tesseract если нужно (обычно для Windows)
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    application.add_error_handler(error_handler)
    
    print("Улучшенный OCR бот запущен...")
    application.run_polling()

if __name__ == "__main__":
    main()