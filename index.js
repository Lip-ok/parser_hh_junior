const express = require("express");
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
const PORT = 3000;
const HH_API_URL = "https://api.hh.ru/vacancies";
const FILE_PATH = "vacancies.txt";

async function fetchVacancies() {
    try {
        console.log("Запуск парсинга вакансий...");
        const { data } = await axios.get(HH_API_URL, {
            params: {
                text: "Front-end React",
                experience: "between1And3",
                area: "113", // Вся Россия
                per_page: 20 // Количество вакансий на странице
            },
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "application/json",
                "Accept-Language": "ru"
            }
        });

        if (!fs.existsSync(FILE_PATH)) {
            fs.writeFileSync(FILE_PATH, "", "utf8");
        }
        
        let vacancies = new Set(fs.readFileSync(FILE_PATH, "utf8").split("\n").filter(line => line.trim() !== "" && !line.startsWith("Последнее обновление:")));

        data.items.forEach(vacancy => {
            if (vacancy.alternate_url) {
                vacancies.add(vacancy.alternate_url);
            }
        });

        const timestamp = `Последнее обновление: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;
        fs.writeFileSync(FILE_PATH, `${timestamp}\n${Array.from(vacancies).join("\n")}`, "utf8");
        console.log(timestamp);
        console.log("Загружено вакансий:", vacancies.size);
    } catch (error) {
        console.error("Ошибка при запросе к HH:", error.response ? error.response.data : error.message);
    }
}

// Запуск обновления каждый час
cron.schedule("0 * * * *", fetchVacancies);

app.get("/vacancies", (req, res) => {
    try {
        if (!fs.existsSync(FILE_PATH) || !fs.readFileSync(FILE_PATH, "utf8").trim()) {
            console.log("Файл пуст, пробуем загрузить вакансии...");
            fetchVacancies();
            return res.status(404).json({ error: "Вакансии пока не найдены, попробуйте позже." });
        }
        
        const data = fs.readFileSync(FILE_PATH, "utf8").split("\n");
        const timestamp = data.shift();
        
        const html = `
            <html>
            <head><title>Вакансии</title></head>
            <body>
                <h1>${timestamp}</h1>
                ${data.map(vacancy => `<p><a href="${vacancy}" target="_blank">${vacancy}</a></p>`).join("\n")}
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