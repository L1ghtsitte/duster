# Duster


> **Версия 0.1.0** - ранний релиз, пока не тестировалось. Тесты будут добавлены в версии 1.0.0.

---

![License](https://img.shields.io/github/license/L1ghtsitte/duster?color=green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20Docker-lightgrey)
![Status](https://img.shields.io/badge/status-v0.1.0%20(pre--release)-orange)

**PC Club Management System** с аналитикой, Telegram ботом и WebRTC видеопотоком

# [![GitHub](https://img.shields.io/badge/GitHub-L1ghtsitte-000?logo=github)](https://github.com/L1ghtsitte) [![Telegram Channel](https://img.shields.io/badge/Telegram-duster__pc-0088cc?logo=telegram)](https://t.me/duster_pc) [![Contact](https://img.shields.io/badge/Contact-pisunyra-pink)](https://t.me/pisunyra?text=1000-7)

## 🚀 Быстрая установка (один клик)

### Windows

```powershell
.\install.ps1
```

**Режимы:**
- `[0]` Docker Compose (PostgreSQL + Redis + Server)
- `[1]` Сервер (полная установка)
- `[2]` Админ-панель
- `[3]` ПК в зале (Agent)

### Linux (Ubuntu/Debian/CentOS)

```bash
sudo ./install.sh
```

### Docker (универсальный)

```bash
git clone https://github.com/L1ghtsitte/duster.git
cd duster
docker compose up -d
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Админ-панель (React)                 │
│         http://localhost:3847/admin                     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│              API Сервер (Fastify + Node.js)              │
│         :3847 HTTP / :3847 WebSocket / WebRTC           │
├─────────────────────────────────────────────────────────┤
│          WebRTC видеопоток (H.264/NVENC)               │
│          JWT аутентификация                            │
│          Мультитенантность (clubId)                    │
│          Telegram Bot API                              │
└──────────────┬──────────────┬──────────────┬─────────────┘
               │              │              │
        ┌──────▼──────┐ ┌─────▼─────┐ ┌────▼────┐
        │ PostgreSQL  │ │ Redis     │ │Telegram │
        │ (данные)    │ │ (кеш)     │ │(бот)    │
        └─────────────┘ └─────────────┘ └─────────┘
```

---

## 📦 Компоненты

| Компонент | Технологии | Назначение |
|-----------|------------|-----------|
| **Agent** | .NET 8, C# | Мониторинг, управление ПК в зале |
| **Server** | Node.js, Fastify, TypeScript | API сервер, бизнес-логика |
| **Admin** | React 19, Vite | Веб-интерфейс для администраторов |
| **Game Hub** | WPF / Web | Клиент для входа игроков |
| **Telegram** | Bot API, Grammy | Уведомления, пополнение, рефералы |

---

## ✨ Возможности

### Управление компьютерами
- WoL - удалённое включение
- Блокировка/разблокировка
- WebRTC видеопоток (JPEG/H.264)
- Аппаратное ускорение NVIDIA NVENC
- Мониторинг CPU/GPU/RAM

### Игроки и сессии
- Регистрация, профили, аватары
- QR вход
- Таймер сессий
- История поиграть

### Финансы
- Тарифы и пакеты
- Кассовые смены
- Telegram Stars пополнение
- Система бонусов и лояльности
- Реферальная программа

### Аналитика
- Хитмап загруженности
- Статистика по часам
- Отчёты по сменам
- Экспорт PDF/Excel

### Безопасность
- JWT токены
- 2FA для админов
- Аудит операций
- Multi-tenant изоляция

---

## 📊 Технологический стек

```
Node.js 20+     TypeScript     Fastify         PostgreSQL
   │              │            │                │
React 19         Prisma       Redis           .NET 8
   │              │            │                │
Vite            SSE/WebSocket  WebRTC          WPF
```

---

## 📂 Структура проекта

```
duster/
├── apps/
│   ├── client-agent/        # .NET агент для ПК
│   └── client-shell/        # WPF Game Hub
├── packages/
│   ├── server/              # Fastify API
│   ├── admin-web/           # React админка
│   ├── client-web/          # Веб клиент для зала
│   ├── player-pwa/          # PWA для игроков
│   ├── shared/              # Общие типы
│   └── i18n/                # Локализация (EN/RU/ZH)
├── scripts/
│   ├── install.ps1          # Windows установщик
│   ├── install.sh           # Linux установщик
│   └── setup-nginx-certbot.sh
└── docker-compose.yml       # Production стек
```

---

## 🛠️ Требования

### Сервер
- Node.js 20+
- PostgreSQL 13+
- Redis 6+
- 2+ ГБ RAM
- Docker (опционально)

### ПК в зале
- Windows 10/11
- .NET 8 Runtime
- 2+ ГБ RAM
- NVIDIA GPU (опционально) для H.264 NVENC

---

## 🔧 Разработка

```bash
# Установка зависимостей
npm install

# Запуск всех компонентов
npm run dev

# Отдельные компоненты
npm run dev:server    # API сервер
npm run dev:admin     # Админка
npm run dev:client-web

# Сборка
npm run build

# База данных
npm run db:migrate
npm run db:seed
```

---

## 🌐 API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/health | Проверка здоровья сервера |
| POST | /auth/admin/login | Вход админа |
| GET | /admin/computers | Список ПК |
| GET | /ws | WebSocket видеопоток |

---

## 📝 Конфигурация (.env)

```env
# Сервер
DUSTER_HOST=0.0.0.0
DUSTER_PORT=3847
DUSTER_JWT_SECRET=случайная-строка-32-символа
DUSTER_PUBLIC_URL=https://your-club.example

# База данных
DATABASE_URL=postgresql://duster:duster@localhost:5432/duster
REDIS_URL=redis://localhost:6379

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=токен-от-botfather
```

---

## 🤝 Сообщество

- **GitHub:** https://github.com/L1ghtsitte/duster
- **Telegram канал:** https://t.me/duster_pc
- **Связь с автором:** https://t.me/pisunyra?text=1000-7

---

## 📄 Лицензия

MIT License - свободное использование и модификация

---
