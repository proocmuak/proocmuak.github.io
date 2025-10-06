from telegram import Bot
from telegram.error import TelegramError
import asyncio
from datetime import datetime, timedelta
import pytz

async def send_scheduled_messages():
    BOT_TOKEN = "7985803825:AAG-5Z8FmJOWD7JkQSzy3lzVjA7gTtbN8hE"
    
    # Список ID пользователей
    USER_IDS = [
        710425319,
        888552030# добавьте нужные ID
    ]
    
    bot = Bot(token=BOT_TOKEN)
    
    # Устанавливаем время отправки (20:00 по Москве)
    moscow_tz = pytz.timezone('Europe/Moscow')
    target_time = datetime.now(moscow_tz).replace(
        hour=20, minute=00, second=00, microsecond=0
    )
    
    # Если текущее время уже после 20:00, планируем на завтра
    if datetime.now(moscow_tz) > target_time:
        target_time += timedelta(days=1)
    
    # Вычисляем сколько секунд ждать
    wait_seconds = (target_time - datetime.now(moscow_tz)).total_seconds()
    
    print(f"⏰ Сообщения будут отправлены в {target_time.strftime('%H:%M %d.%m.%Y')}")
    print(f"📋 Получатели: {len(USER_IDS)} пользователей")
    print(f"⏳ Ожидание: {wait_seconds:.0f} секунд...")
    
    # Ждем нужное время
    await asyncio.sleep(wait_seconds)
    
    # Отправляем сообщения всем пользователям
    successful_sends = 0
    failed_sends = 0
    
    for user_id in USER_IDS:
        try:
            await bot.send_message(
                chat_id=user_id,
                text="Приглашаю тебя на свидание в воскресенье. \nДресс-код простой: элегантность с намёком на дерзость — так, чтобы глаза смотрели в восхищении, и обязательно красивое белье) \n Я обещаю флирт, интригу и вечер, который будет сложно забыть… \nЖду в 18:00 на Чистых Прудах"
            )
            print(f"✅ Сообщение отправлено пользователю {user_id}")
            successful_sends += 1
            
            # Небольшая задержка между отправками, чтобы не превысить лимиты Telegram
            await asyncio.sleep(0.1)
            
        except TelegramError as e:
            print(f"❌ Ошибка отправки пользователю {user_id}: {e}")
            failed_sends += 1
    
    print(f"\n📊 Итог: успешно отправлено {successful_sends}, ошибок: {failed_sends}")

asyncio.run(send_scheduled_messages())