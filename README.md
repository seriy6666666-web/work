# BELMY ENERGY — система управления производством

Веб-приложение для управления производством ООО «БЕЛМИ ЭНЕРДЖИ»: заказы,
операции, компетенции сотрудников, распределение работ, смены, отсутствия,
переводы, простои, статистика и аналитика.

Стек: **NestJS + Prisma (PostgreSQL)** · **React + Vite** · **Docker Compose**.

---

> Продолжаете работу на другом компьютере или после перерыва? — [HANDOFF.md](HANDOFF.md):
> что сделано, что решено, что делать дальше и как поднять окружение для разработки.

## Запуск на новом ПК

### 1. Установить Docker Desktop
Скачать и установить: <https://www.docker.com/products/docker-desktop/>
После установки **запустить Docker Desktop и дождаться**, пока значок кита 🐳
в трее покажет статус «Docker Desktop is running» (не «starting»).

> Больше ничего ставить не нужно — ни Node.js, ни PostgreSQL. Всё внутри Docker.

### 2. Скачать проект
```bash
git clone https://github.com/seriy6666666-web/work.git
cd work
```
(Или скачать ZIP на странице репозитория → «Code» → «Download ZIP» и распаковать.)

### 3. Запустить
**Простой способ:** двойной клик по **`start-belmy.bat`** в папке проекта —
он сам соберёт образы (первый раз 2–5 минут), поднимет всё и откроет браузер.

**Или вручную:**
```bash
docker compose up --build -d
```
Затем открыть в браузере <http://localhost:5173>.

### 4. Войти
Тестовые учётные записи (пароль у всех одинаковый — `password123`):

| Логин             | Роль                  |
|-------------------|-----------------------|
| `admin`           | Администратор         |
| `planner`         | Планировщик           |
| `production_head` | Начальник производства|
| `site_lead`       | Начальник участка     |
| `worker`          | Сотрудник             |

---

## Порты
| Сервис    | Адрес                     |
|-----------|---------------------------|
| Интерфейс | <http://localhost:5173>   |
| API       | <http://localhost:3000>   |
| PostgreSQL| `localhost:5432`          |

Если порты заняты другой программой — освободите их или измените в
`docker-compose.yml`.

---

## Полезные команды
```bash
docker compose ps                 # статус контейнеров
docker compose logs -f backend    # логи бэкенда
docker compose down               # остановить (данные сохраняются)
docker compose down -v            # остановить и УДАЛИТЬ базу (полный сброс)
docker compose up --build -d      # пересобрать после изменений кода
```

База данных сохраняется в Docker-томе `postgres_data` между перезапусками.

---

## Резервные копии и восстановление

Копии складываются в `./backups` — ежедневно, хранятся 7 дней, плюс папки `weekly`
и `monthly`. Снять копию прямо сейчас:
```bash
docker compose exec backup /backup.sh
```
Свежая всегда лежит в `backups/last/belmy-latest.sql.gz`.

> Версия образа `backup` обязана совпадать с версией `postgres`. При несовпадении
> дамп получается с директивами более новых версий, и восстановление ругается на
> незнакомые параметры.

### Проверить копию, не трогая рабочую базу

Так проверяют, что копия действительно разворачивается. Делать это стоит хотя бы раз
перед запуском и потом изредка — иначе о негодности копий узнают в тот день, когда они
понадобятся.

```bash
# 1. Чистая база рядом с рабочей
docker compose exec -T postgres psql -U belmy -d postgres -c 'CREATE DATABASE belmy_check;'

# 2. Развернуть в неё копию (ошибок в выводе быть не должно)
gzip -dc backups/last/belmy-latest.sql.gz | docker compose exec -T postgres psql -U belmy -d belmy_check

# 3. Поднять приложение на этой базе на порту 3001
docker compose run --rm -d -p 3001:3000 --name belmy-check --entrypoint node \
  -e DATABASE_URL="postgresql://belmy:ПАРОЛЬ@postgres:5432/belmy_check?schema=public" \
  -e SEED_DEMO_DATA=true backend dist/main.js

# 4. Проверить, что вход работает и данные на месте
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"ПАРОЛЬ"}'

# 5. Убрать за собой
docker rm -f belmy-check
docker compose exec -T postgres psql -U belmy -d postgres -c 'DROP DATABASE belmy_check;'
```

`--entrypoint node` здесь важен: он обходит миграции и сид, поэтому проверяемая копия
остаётся ровно такой, какой была в файле.

### Восстановление после потери данных

```bash
docker compose stop backend
gzip -dc backups/last/belmy-latest.sql.gz | docker compose exec -T postgres psql -U belmy -d belmy
docker compose start backend
```
Если база повреждена целиком — сначала пересоздать её:
`docker compose down -v && docker compose up -d postgres`, затем развернуть копию.

---

## Настройки для разработки и показа
Значения по умолчанию поднимают демо-стенд как есть — `.env` не нужен. В логах
бэкенда при этом висит предупреждение о слабых секретах: так и должно быть, это
напоминание, что стенд не рабочий.

---

## Запуск на производстве

Демо-режим на производстве использовать нельзя: он заводит сотрудников с паролем
`password123`, включая администратора. Порядок рабочего запуска:

### 1. Заполнить `.env`
```bash
cp .env.example .env
```
Обязательны четыре вещи — `POSTGRES_PASSWORD`, `JWT_SECRET`, `SEED_DEMO_DATA=false`
и `ADMIN_PASSWORD`. Сгенерировать секрет:
```bash
openssl rand -base64 48
```
На Windows:
```bash
powershell -c "[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))"
```

Если секреты остались из примеров, **бэкенд не запустится** и напишет, чего не хватает.
Это защита от случайного запуска демо-конфигурации в цеху, а не ошибка.

### 2. Поднять
```bash
docker compose up --build -d
```
База создаётся пустой: ни участков, ни сотрудников, только один администратор из
`ADMIN_USERNAME` / `ADMIN_PASSWORD`. Всю структуру предприятия он создаёт через админку.

`ADMIN_PASSWORD` применяется **один раз** — когда в базе ещё нет ни одного
администратора. После первого входа пароль меняется через интерфейс и из `.env`
больше не восстанавливается, поэтому смена пароля не откатится при рестарте.

### 3. Проверить доступ с других устройств
По умолчанию интерфейс ждёт API на `localhost` — это работает только на самом сервере.
Для планшетов и телефонов укажите адрес сервера и перечислите разрешённые источники:
```bash
VITE_API_URL=http://192.168.1.50:3000
CORS_ORIGIN=http://192.168.1.50:5173
```
После смены `VITE_API_URL` фронтенд нужно пересобрать — адрес вшивается в сборку:
```bash
docker compose up --build -d frontend
```

> **HTTPS.** Стек отдаёт HTTP: пароли и токены идут по сети открытым текстом.
> Внутри цеховой сети это терпимо, при доступе из интернета — нет. Поставьте перед
> стеком reverse proxy с сертификатом (nginx, Caddy, Traefik).

---

## Разработка и тесты
```bash
# фронтенд (dev-режим с hot-reload)
cd frontend && npm install && npm run dev

# бэкенд (dev-режим)
cd backend && npm install && npm run start:dev

# тесты
cd backend  && npm test            # unit-тесты бизнес-логики
cd frontend && npm run test:e2e    # e2e (нужен запущенный стек)
```

Приёмочный чеклист — [QA_CHECKLIST.md](QA_CHECKLIST.md).
