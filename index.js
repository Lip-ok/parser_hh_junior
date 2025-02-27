const express = require("express");
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
const PORT = 3000;
const HH_API_URL = "https://api.hh.ru/vacancies";
const FILE_PATH = "vacancies.json";

async function fetchVacancies() {
    try {
        console.log("Запуск парсинга вакансий...");
        const { data } = await axios.get(HH_API_URL, {
            params: {
                text: "Front-end React",
                experience: "between1And3",
                area: "113", // Вся Россия
                per_page: 5 // Сохраняем только 5 вакансий
            },
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "application/json",
                "Accept-Language": "ru"
            }
        });

        const vacancies = data.items.map(vacancy => ({
            url: vacancy.alternate_url,
            title: vacancy.name,
            salary: vacancy.salary ? `От ${vacancy.salary.from || "–"} -  До ${vacancy.salary.to || "–"} ${vacancy.salary.currency || ""}` : "Не указано",
            skills: vacancy.key_skills ? vacancy.key_skills.slice(0, 4).map(skill => skill.name) : []
        }));

        const timestamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        fs.writeFileSync(FILE_PATH, JSON.stringify({ timestamp, vacancies }, null, 2), "utf8");
        console.log(`Последнее обновление: ${timestamp}`);
        console.log("Загружено вакансий:", vacancies.length);
    } catch (error) {
        console.error("Ошибка при запросе к HH:", error.response ? error.response.data : error.message);
    }
}

// Запуск обновления каждые 10 минут
cron.schedule("*/10 * * * *", fetchVacancies);

app.get("/vacancies", (req, res) => {
    try {
        if (!fs.existsSync(FILE_PATH) || !fs.readFileSync(FILE_PATH, "utf8").trim()) {
            console.log("Файл пуст, пробуем загрузить вакансии...");
            fetchVacancies();
            return res.status(404).json({ error: "Вакансии пока не найдены, попробуйте позже." });
        }
        
        const { timestamp, vacancies } = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
        
        const html = `
            <html>
            <head><title>Вакансии</title></head>
            <body>
                <h1>Последнее обновление: ${timestamp}</h1>
                ${vacancies.map(vacancy => `
                    <div>
                        <p><a href="${vacancy.url}" target="_blank">${vacancy.title}</a></p>
                        <p>Зарплата: ${vacancy.salary}</p>
                        <p>Ключевые навыки: ${vacancy.skills.length > 0 ? vacancy.skills.join(", ") : "Не указаны"}</p>
                    </div>
                `).join("\n")}
            </body>
            </html>
        `;
        
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    } catch (error) {
        console.error("Ошибка при чтении файла:", error);
        res.status(500).json({ error: "Ошибка при чтении файла" });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    if (!fs.existsSync(FILE_PATH) || !fs.readFileSync(FILE_PATH, "utf8").trim()) {
        console.log("Файл вакансий пуст, выполняем загрузку...");
        fetchVacancies();
    }
});