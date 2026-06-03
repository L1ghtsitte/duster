# Установка Duster в ПК-клубе

## 1. Сервер

Рекомендуется выделенный ПК или VM в локальной сети с статическим IP (например `192.168.10.10`).

```powershell
cd packages\server
copy .env.example .env   # при необходимости
npx prisma db push
npm run db:seed
npm run dev   # или npm run build && npm start как служба
```

Порт по умолчанию: **3847**.

### Сервер как служба Windows

Используйте [NSSM](https://nssm.cc/) или `pm2-windows-service`:

```powershell
nssm install DusterServer "C:\Program Files\nodejs\node.exe" "C:\duster\packages\server\dist\index.js"
nssm set DusterServer AppDirectory C:\duster\packages\server
```

Откройте в брандмауэре TCP **3847** только для подсети клуба.

## 2. Админ-пК (касса)

На главном ПК администратора:

```powershell
npm run dev:admin
# продакшен: npm run build --workspace=@duster/admin-web
# раздавать dist через nginx или открывать file:// не рекомендуется
```

В `vite.config.ts` прокси указывает на сервер. В продакшене задайте `VITE_API_URL` или настройте reverse proxy на тот же хост, что и API.

Ярлык на рабочем столе: `http://localhost:5173` или `http://192.168.10.10:5173`.

## 3. Игровые ПК

Для каждого компьютера:

1. **Админка** → Компьютеры → Добавить ПК (номер, имя, MAC для WoL).
2. Скопировать **agentToken** в `appsettings.json` агента.
3. Установить **Duster.Agent** как службу (автозапуск).
4. Выбрать оболочку:
   - **native**: блокировка через агент (`LockWorkStation`), после `unlock` - обычный рабочий стол под учёткой игрока.
   - **web**: ярлык Edge в киоске на `http://192.168.10.10:5174?pc=N`.

### Учётная запись Windows

Типовая схема (как в Gizmo):

- Одна локальная учётка `club` (или доменная) с автовходом.
- Агент запускается от SYSTEM или от `club` с правами на shutdown.
- Игрок не знает пароль администратора Windows.

## 4. Первый запуск клуба

| Шаг | Действие |
|-----|----------|
| 1 | Запустить сервер, проверить `GET /api/health` |
| 2 | Войти в админку, сменить пароль owner |
| 3 | Добавить все ПК с MAC |
| 4 | Установить агенты, убедиться что статус `online` |
| 5 | Создать товары, пакеты, тестового игрока |
| 6 | Тест: WoL → старт сессии → lock |

## 5. PostgreSQL (опционально)

Для крупного клуба замените в `schema.prisma` provider на `postgresql` и `DATABASE_URL` из `docker-compose.yml`.
