# Duster - возможности (v0.5)

## Установка

Единый скрипт: `scripts/install.ps1` (от администратора)

1. **Сервер клуба** - Node.js, БД, API, сборка админки  
2. **Админ-ПК** - касса, браузер к серверу  
3. **ПК в зале** - агент Windows + WPF или Web-киоск  

## Ядро (v0.1–v0.4)

- Сервер Fastify + SQLite (Prisma), JWT, WebSocket  
- Админка React: ПК, игроки, POS, смены, PDF, карта, тарифы, права, i18n (ru/en/zh)  
- Агент .NET: WoL, lock, stream JPEG, USB, очистка сессий, офлайн, телеметрия  
- Станция: PIN / логин, WPF Game Hub  

## v0.5

| # | Функция | Описание |
|---|---------|----------|
| 21 | **Telegram** | `/link` по телефону, код от админа, `/balance`, `/pcs`, `/book`, `/topup` Stars (курс в админке) |
| 22 | **Античит** | Список процессов с ПК, правила kill/alert, агент сканирует |
| 23 | **QR-вход** | Токен в профиле игрока → станция «QR-вход» |
| 24 | **Excel** | Экспорт смены CSV (UTF-8 BOM) из «Смены» |
| 25 | **Календарь** | `/calendar` - брони по дням |
| 26 | **WebRTC** | Сигналинг + MJPEG поток; полное видео - при поддержке агента |

## Game Hub (WPF)

Сканирует Steam / Epic / Riot и запускает игры после входа на станции.

## Telegram (настройка)

1. @BotFather → токен  
2. Админка → Telegram → включить, курс **1⭐ = X ₽** (по умолчанию 1.65)  
3. BotFather → Payments → Stars  
4. Игрок: `/link` + телефон или код от админа в профиле  

## Запуск разработки

```powershell
cd packages\server
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Админка: `npm run dev:admin` из корня репозитория.
