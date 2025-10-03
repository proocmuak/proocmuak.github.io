from telegram import Bot
from telegram.error import TelegramError
import asyncio

async def send_message_without_start():
    BOT_TOKEN = "7985803825:AAG-5Z8FmJOWD7JkQSzy3lzVjA7gTtbN8hE"
    USER_ID = 710425319  # Замените на реальный ID
    
    bot = Bot(token=BOT_TOKEN)
    
    try:
        # Пытаемся отправить сообщение напрямую
        await bot.send_message(
            chat_id=USER_ID,
            text="Приглашаю тебя на свидание в воскресенье. \nДресс-код простой: элегантность с намёком на дерзость — так, чтобы глаза смотрели в восхищении, а мысли уходили совсем не в сторону ужина. Я обещаю флирт, интригу и вечер, который будет сложно забыть… \nЖду в 18:00 на Чистых Прудах"
        )
        print("✅ Сообщение успешно отправлено!")
        
    except TelegramError as e:
        print(f"❌ Ошибка: {e}")

asyncio.run(send_message_without_start())