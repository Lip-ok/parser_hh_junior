const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const cron = require("node-cron");

const app = express();
const PORT = 3000;
const HH_URL = "https://hh.ru/search/vacancy";
const FILE_PATH = "vacancies.txt";

async function fetchVacancies() {
    try {
        const { data } = await axios.get(HH_URL, {
            params: {
                text: "Front-end React",
                experience: "between1And3",
                area: "113", // Вся Россия
                page: 0,
                per_page: 10 // Количество вакансий на странице
            },
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });

        const $ = cheerio.load(data);
        let vacancies = new Set(fs.existsSync(FILE_PATH) ? fs.readFileSync(FILE_PATH, "utf8").split("\n") : []);

        $(".vacancy-serp-item").each((index, element) => {
            const link = $(element).find("a.bloko-link").attr("href");
            if (link) vacancies.add(link);
        });

        fs.writeFileSync(FILE_PATH, Array.from(vacancies).join("\n"), "utf8");
        console.log("Вакансии обновлены и сохранены в файл без дубликатов.");
    } catch (error) {
        console.error("Ошибка при запросе к HH:", error);
    }
}

// Запуск обновления каждый 1 час
cron.schedule("0 * * * *", fetchVacancies);

app.get("/vacancies", (req, res) => {
    try {
        const data = fs.readFileSync(FILE_PATH, "utf8");
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: "Ошибка при чтении файла" });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    fetchVacancies(); // Первоначальный запуск при старте
});
