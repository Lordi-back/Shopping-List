import sys
import json
import easyocr
import re
import requests
from PIL import Image
from io import BytesIO

def scan_receipt(image_url: str) -> list:
    """
    Принимает URL изображения чека, возвращает список товаров.
    """
    try:
        # Загружаем изображение
        response = requests.get(image_url)
        img = Image.open(BytesIO(response.content))
        
        # Распознаём текст (русский + английский)
        reader = easyocr.Reader(['ru', 'en'])
        results = reader.readtext(img)
        
        # Собираем весь текст построчно
        lines = []
        for (bbox, text, confidence) in results:
            if confidence > 0.3:  # фильтруем мусор
                lines.append(text.strip())
        
        # Парсим товары из строк
        items = parse_receipt_lines(lines)
        
        return items
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return []

def parse_receipt_lines(lines: list) -> list:
    """
    Парсит строки чека, ищет названия товаров и цены.
    Пример формата:
    МОЛОКО 3,2% 1Л         89.90
    ХЛЕБ БОРОДИНСКИЙ       45.00
    """
    items = []
    
    # Регулярка для цены в конце строки
    price_pattern = re.compile(r'(\d+[.,]\d{2})\s*$')
    
    # Стоп-слова (не товары)
    stop_words = ['итог', 'итого', 'сумма', 'сдача', 'кассир', 'чек', 'ндс', 'в т.ч.', 'всего', 'карта', 'наличные']
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 3:
            continue
        
        # Пропускаем строки со стоп-словами
        if any(sw in line.lower() for sw in stop_words):
            continue
        
        # Ищем цену в конце
        price_match = price_pattern.search(line)
        if price_match:
            price_str = price_match.group(1).replace(',', '.')
            price = float(price_str)
            
            # Название товара — всё до цены
            name = line[:price_match.start()].strip()
            # Чистим название от лишних символов
            name = re.sub(r'[=*_#]', '', name).strip()
            
            if len(name) > 2 and price > 0:
                items.append({
                    'name': name,
                    'price': price,
                })
        else:
            # Строка без цены — может быть названием товара
            # Пропускаем строки с цифрами в начале (количества)
            if not re.match(r'^\d+[\sxх]', line) and len(line) > 3:
                # Проверяем, не является ли это продолжением предыдущего товара
                pass
    
    # Убираем дубликаты
    seen = set()
    unique_items = []
    for item in items:
        key = item['name'].lower()
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
    
    return unique_items

if __name__ == '__main__':
    if len(sys.argv) > 1:
        image_url = sys.argv[1]
        items = scan_receipt(image_url)
        print(json.dumps(items, ensure_ascii=False))
    else:
        print(json.dumps([], ensure_ascii=False))
