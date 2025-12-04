const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = 3000;

app.use(express.static(__dirname));
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'KtPfw05gs67!',
    database: 'pitchers_data'
});

connection.connect(err => {
    if (err) {
        console.error("Error connecting:", err);
        return;
    }
    console.log("Connected to MySQL!");
});


// Line graphs
app.get('/api/stats/history', (req, res) => {
    const pitcherId = req.query.player;

    
    const sql = `
        SELECT Date AS game_date, EffectiveVelo, PitchCall, Pitcher
        FROM sample_data
        WHERE PitcherId = ?
        ORDER BY Date;
    `;

    connection.query(sql, [pitcherId], (err, results) => {
        if (err) {
            console.error("Error fetching history stats:", err);
            return res.status(500).send("Error fetching stats");
        }
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

app.get('/api/players', (req, res) => {
    const sql = `
        SELECT 
            MIN(PitcherId) AS id,
            TRIM(Pitcher) AS name
        FROM sample_data
        GROUP BY TRIM(Pitcher)
        ORDER BY TRIM(Pitcher);
    `;

    console.log("Executing:", sql);

    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Query error:", err);
            return res.status(500).send("Error fetching players");
        }

        res.json(results);
    });
});

// Find by exact Date 
app.get('/api/stats', (req, res) => {
    const pitcherId = req.query.player;
    const gameDate = req.query.date;

    console.log(`--- Aggregating Stats ---`);
    console.log(`Player: ${pitcherId}, Date: ${gameDate}`);

    const sql = `
        SELECT 
            TaggedPitchType as pitch_type,
            COUNT(*) as count,
            MAX(RelSpeed) as max_vel,
            AVG(RelSpeed) as avg_vel,
            AVG(InducedVertBreak) as ivb,
            AVG(HorzBreak) as hb,         -- REPLACE with your Horizontal Break column
            AVG(RelSide) as horz_rel,     -- REPLACE with your Horizontal Release column
            AVG(RelHeight) as vert_rel,   -- REPLACE with your Vertical Release column
            AVG(SpinRate) as spin,
            AVG(Extension) as extension
        FROM sample_data
        WHERE PitcherId = ? 
          AND DATE(Date) = ?
        GROUP BY TaggedPitchType`;

    connection.query(sql, [pitcherId, gameDate], (err, results) => {
        if (err) {
            console.error(">>> SQL ERROR:", err.sqlMessage); 
            return res.status(500).send("Database error");
        }

        console.log(`Aggregated into ${results.length} pitch types.`);
        res.json(results);
    });
});

app.get('/api/dates', (req, res) => {
    const pitcherId = req.query.player;
    console.log(`Fetching dates for pitcher ID: ${pitcherId}`);

 
    const sql = `
        SELECT DISTINCT Date 
        FROM sample_data 
        WHERE PitcherId = ?
        ORDER BY Date DESC`;

    connection.query(sql, [pitcherId], (err, results) => {
        if (err) {
            // This will print the EXACT SQL error to your terminal
            console.error(">>> SQL ERROR in /api/dates:", err.sqlMessage); 
            return res.status(500).send("Database error");
        }

        console.log(`Found ${results.length} dates.`);

        const formattedResults = results.map(row => {
            // Create a JS Date object
            const d = new Date(row.Date);
            // Convert to YYYY-MM-DD string
            return { 
                date_str: d.toISOString().split('T')[0] 
            };
        });

        res.json(formattedResults);
    });
});

// server.js - ADDITION (The one and only /api/pitchDataForDate route)

// Find all pitch data for a player on a specific DATE
app.get('/api/pitchDataForDate', (req, res) => {
    const pitcherId = req.query.player;
    const gameDate = req.query.date;

    console.log(`--- Fetching pitch data for player ${pitcherId} on ${gameDate} ---`);

    const sql = `
        SELECT 
            TaggedPitchType,
            RelSpeed,
            InducedVertBreak,
            HorzBreak,         
            RelSide,     
            RelHeight,   
            SpinRate,
            Extension
        FROM sample_data
        WHERE PitcherId = ? 
          AND DATE(Date) = ? 
    `;

    connection.query(sql, [pitcherId, gameDate], (err, results) => {
        if (err) {
            console.error(">>> SQL ERROR in /api/pitchDataForDate:", err.sqlMessage); 
            return res.status(500).send("Database error");
        }

        console.log(`Found ${results.length} pitches for the game.`);
        res.json(results);
    });
});

//Upload page functions
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

app.post("/upload-csv", upload.single("csvFile"), (req, res) => {
    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
            results.push(row);  // row = { columnName: value }
        })
        .on("end", () => {
            console.log("CSV Parsed. Rows:", results.length);

            const insertQuery = `
                INSERT INTO sample_data
                SET ?
            `;

            results.forEach(row => {
                connection.query(insertQuery, row, (err) => {
                    if (err) console.error("Insert error:", err);
                });
            });

            fs.unlinkSync(filePath); // delete temp file

            res.send("CSV upload complete. " + results.length + " rows added.");
        });
});