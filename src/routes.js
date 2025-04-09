const express = require("express");
const pool = require("./db");

const router = express.Router();

// 1. Создать обращение
router.post("/requests", async (req, res) => {
  const { text, topic } = req.body;

  // Проверка наличия и типа данных
  if (!text || !topic || typeof text !== "string" || typeof topic !== "string") {
    return res.status(400).json({ ошибка: "Текст и тема должны быть строками и обязательны" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO requests (text, topic) VALUES ($1, $2) RETURNING *",
      [text, topic]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

// 2. Взять обращение в работу
router.patch("/requests/:id/start", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  // Проверка типа ID
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ ошибка: "ID должен быть положительным числом" });
  }

  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1 WHERE id = $2 RETURNING *",
      ["in_progress", id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ошибка: "Обращение не найдено" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

// 3. Завершить обработку обращения
router.patch("/requests/:id/complete", async (req, res) => {
  const { resolution } = req.body;
  const id = parseInt(req.params.id, 10);

  // Проверка типов и наличие
  if (!resolution || typeof resolution !== "string") {
    return res.status(400).json({ ошибка: "Решение должно быть строкой и обязательно" });
  }
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ ошибка: "ID должен быть положительным числом" });
  }

  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, resolution = $2 WHERE id = $3 RETURNING *",
      ["completed", resolution, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ошибка: "Обращение не найдено" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

// 4. Отмена обращения
router.patch("/requests/:id/cancel", async (req, res) => {
  const { cancel_reason } = req.body;
  const id = parseInt(req.params.id, 10);

  // Проверка типов и их наличие
  if (!cancel_reason || typeof cancel_reason !== "string") {
    return res.status(400).json({ ошибка: "Причина отмены должна быть строкой и обязательна" });
  }
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ ошибка: "ID должен быть положительным числом" });
  }

  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, cancel_reason = $2 WHERE id = $3 RETURNING *",
      ["canceled", cancel_reason, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ошибка: "Обращение не найдено" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

// 5. Получить список обращений с фильтрацией
router.get("/requests", async (req, res) => {
  const { date, start_date, end_date } = req.query;
  let query = "SELECT * FROM requests";
  const params = [];

  // Проверка типов для фильтров
  if (date) {
    if (typeof date !== "string") {
      return res.status(400).json({ ошибка: "Дата должна быть строкой" });
    }
    query += " WHERE DATE(created_at) = $1";
    params.push(date);
  } else if (start_date || end_date) {
    if (!start_date || !end_date || typeof start_date !== "string" || typeof end_date !== "string") {
      return res.status(400).json({ ошибка: "Начальная и конечная даты должны быть строками и обязательны" });
    }
    query += " WHERE created_at BETWEEN $1 AND $2";
    params.push(start_date, end_date);
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

// 6. Отменить все обращения "в работе"
router.patch("/requests/cancel-all-in-progress", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE requests SET status = $1, cancel_reason = $2 WHERE status = $3 RETURNING *",
      ["canceled", "Отменено системой", "in_progress"]
    );
    let сообщение;
    if (result.rows.length > 0) {
      сообщение = `${result.rows.length} обращений отменено`;
    } else {
      сообщение = "Нечего отменять";
    }
    res.json({ сообщение });
  } catch (error) {
    res.status(500).json({ ошибка: "Ошибка базы данных: " + error.message });
  }
});

module.exports = router;