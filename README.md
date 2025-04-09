Стек технологий

- Node.js: Серверная среда выполнения JavaScript.
- Express.js: Веб-фреймворк для Node.js.
- PostgreSQL: Система управления базами данных.
- pg: Драйвер PostgreSQL для Node.js.
- dotenv: Загрузка переменных окружения.
- Nodemon: Утилита для автоматического перезапуска сервера при изменении файлов.

Функциональность

Система поддерживает следующие действия:

1. Создание обращения: Пользователь может создать новое обращение, указав текст и тему.
2. Перевод обращения в работу: Обращение можно взять в работу, обновив его статус на `in_progress`.
3. Завершение обращения: После обработки, обращение можно завершить, указав текст решения.
4. Отмена обращения: Можно отменить обращение с обязательным указанием причины отмены.
5. Получение списка обращений: Получение всех обращений с возможностью фильтрации по дате или диапазону дат.
6. Отмена всех обращений в статусе "в работе": Позволяет отменить все обращения с текущим статусом `in_progress`.

Структура прокта
```
├── src/
│   ├── db.js         // Подключение к базе данных PostgreSQL
│   ├── routes.js     // Маршруты (эндпоинты) REST API
│   └── index.js      // Главный файл сервера
├── .env              // Переменные окружения (не в Git)
├── .gitignore        // Исключения для Git
├── package.json      // Конфигурация и зависимости
```

src/db.js
Описание: Этот файл отвечает за настройку подключения к базе данных PostgreSQL через пул соединений из библиотеки `pg`. Он использует переменные окружения из файла `.env` для конфигурации подключения.


```
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

module.exports = pool;

Роль: Создает объект pool, который используется для выполнения SQL-запросов в других частях приложения.


src/routes.js

Описание: Этот файл определяет все маршруты (эндпоинты) REST API для управления обращениями. Включает обработку ошибок с помощью try/catch, а также проверку типов данных для входящих запросов.

```const express = require("express");
const pool = require("./db");

const router = express.Router();

// Создать обращение
router.post("/requests", async (req, res) => {
  const { text, topic } = req.body;
  if (!text || !topic || typeof text !== "string" || typeof topic !== "string") {
    return res.status(400).json({ error: "Text and topic are required and should be strings" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO requests (text, topic) VALUES ($1, $2) RETURNING *",
      [text, topic]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Перевести обращение в работу
router.patch("/requests/:id/start", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "ID must be a positive number" });
  }
  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1 WHERE id = $2 RETURNING *",
      ["in_progress", id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Завершить обращение
router.patch("/requests/:id/complete", async (req, res) => {
  const { resolution } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!resolution || typeof resolution !== "string") {
    return res.status(400).json({ error: "Resolution must be a string and required" });
  }
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "ID must be a positive number" });
  }
  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, resolution = $2 WHERE id = $3 RETURNING *",
      ["completed", resolution, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Отменить обращение
router.patch("/requests/:id/cancel", async (req, res) => {
  const { cancel_reason } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!cancel_reason || typeof cancel_reason !== "string") {
    return res.status(400).json({ error: "Cancel reason must be a string and required" });
  }
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "ID must be a positive number" });
  }
  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, cancel_reason = $2 WHERE id = $3 RETURNING *",
      ["canceled", cancel_reason, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Получить список обращений
router.get("/requests", async (req, res) => {
  const { date, start_date, end_date } = req.query;
  let query = "SELECT * FROM requests";
  const params = [];
  if (date) {
    if (typeof date !== "string") {
      return res.status(400).json({ error: "Date must be a string" });
    }
    query += " WHERE DATE(created_at) = $1";
    params.push(date);
  } else if (start_date || end_date) {
    if (!start_date || !end_date || typeof start_date !== "string" || typeof end_date !== "string") {
      return res.status(400).json({ error: "Start date and end date must be strings and required" });
    }
    query += " WHERE created_at BETWEEN $1 AND $2";
    params.push(start_date, end_date);
  }
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

// Отменить все обращения в статусе "в работе"
router.patch("/requests/cancel-all-in-progress", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, cancel_reason = $2 WHERE status = $3 RETURNING *",
      ["canceled", "Cancelled by system", "in_progress"]
    );
    let message;
    if (result.rows.length > 0) {
      message = `${result.rows.length} requests canceled`;
    } else {
      message = "Nothing to cancel";
    }
    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

module.exports = router;
```
Роль: Реализует все эндпоинты API для работы с обращениями, включая валидацию входных данных и обработку ошибок.
Зависимости: express, pg.
3. src/index.js

Описание: Главный файл приложения, который запускает сервер Express.js и подключает маршруты.

```
const express = require("express");
const routes = require("./routes");

const app = express();
app.use(express.json());
app.use("/api", routes);

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
Роль: Инициализирует сервер, парсит JSON в теле запросов и привязывает маршруты под префикс /api.
