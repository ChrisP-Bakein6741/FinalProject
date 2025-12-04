// Global variables
let velocityChartInstance = null;
let strikeChartInstance = null;
let allParsedData = [];

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    const pitcherSelect = document.getElementById('pitcherSelect');
    if (pitcherSelect) {
        pitcherSelect.addEventListener('change', updateGraphFromSelection);
    }
    
    showWaitingMessages();
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        processData(e.target.result);
    };
    reader.onerror = () => alert("Error reading file");
    reader.readAsText(file);
}

function processData(csvText) {
    try {
        allParsedData = parseCSV(csvText);
        populatePitcherDropdown(allParsedData);
        updateGraphFromSelection();
    } catch (err) {
        console.error(err);
        alert("Error processing data: " + err.message);
    }
}

function showWaitingMessages() {
    const charts = ['velocityChart', 'strikeChart'];
    charts.forEach(id => {
        const ctx = document.getElementById(id).getContext('2d');
        ctx.font = "16px Arial";
        ctx.fillStyle = "gray";
        ctx.textAlign = "center";
        ctx.fillText("Upload a CSV file to view data", ctx.canvas.width / 2, ctx.canvas.height / 2);
    });
}

function populatePitcherDropdown(data) {
    const select = document.getElementById('pitcherSelect');
    if (!select) return;

    const pitchers = new Set();
    data.forEach(row => {
        if (row.pitcher && row.pitcher !== "Unknown") pitchers.add(row.pitcher);
    });

    select.innerHTML = '<option value="All">All Pitchers</option>';
    Array.from(pitchers).sort().forEach(pitcher => {
        const option = document.createElement('option');
        option.value = pitcher;
        option.textContent = pitcher;
        select.appendChild(option);
    });
}

function updateGraphFromSelection() {
    const select = document.getElementById('pitcherSelect');
    const selectedPitcher = select.value || "All";

    if (allParsedData.length === 0) return;

    let filteredData = allParsedData;
    if (selectedPitcher !== "All") {
        filteredData = allParsedData.filter(row => row.pitcher === selectedPitcher);
    }

    const chartData = calculateStats(filteredData);
    
    // Render both charts independently
    renderVelocityChart(chartData, selectedPitcher);
    renderStrikeChart(chartData, selectedPitcher);
}

// --- CSV Parsing ---
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseLine(lines[0]);
    const dateIdx = headers.indexOf('Date');
    const veloIdx = headers.indexOf('EffectiveVelo'); 
    const pitcherIdx = headers.indexOf('Pitcher');
    const callIdx = headers.indexOf('PitchCall');

    if (dateIdx === -1 || veloIdx === -1) {
        throw new Error('CSV must contain "Date" and "EffectiveVelo" columns.');
    }

    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row[dateIdx] && row[veloIdx]) {
            parsedData.push({
                date: row[dateIdx].trim(),
                velocity: parseFloat(row[veloIdx].trim()),
                pitcher: pitcherIdx !== -1 ? row[pitcherIdx].trim() : "Unknown",
                call: callIdx !== -1 ? row[callIdx].trim() : null
            });
        }
    }
    return parsedData;
}

function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { result.push(cleanCell(current)); current = ''; }
        else { current += char; }
    }
    result.push(cleanCell(current));
    return result;
}

function cleanCell(val) {
    val = val.trim();
    if (val.startsWith('"') && val.endsWith('"')) return val.substring(1, val.length - 1);
    return val;
}

// --- Calculations ---
function calculateStats(data) {
    const dateGroups = {};
    const strikeCalls = ['StrikeCalled', 'StrikeSwinging', 'FoulBall', 'InPlay', 'FoulBallNotFieldable', 'FoulBallFieldable'];

    data.forEach(row => {
        if (!isNaN(row.velocity) && row.velocity > 0 && row.velocity < 150 && row.date) {
            const d = new Date(row.date);
            if (!isNaN(d.getTime())) {
                const dateKey = d.toISOString().split('T')[0];
                
                if (!dateGroups[dateKey]) {
                    dateGroups[dateKey] = { 
                        veloSum: 0, veloCount: 0,
                        strikeCount: 0, totalPitches: 0
                    };
                }

                dateGroups[dateKey].veloSum += row.velocity;
                dateGroups[dateKey].veloCount++;
                dateGroups[dateKey].totalPitches++;
                if (strikeCalls.includes(row.call)) {
                    dateGroups[dateKey].strikeCount++;
                }
            }
        }
    });

    const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(a) - new Date(b));
    
    return { 
        labels: sortedDates, 
        velo: sortedDates.map(d => (dateGroups[d].veloSum / dateGroups[d].veloCount).toFixed(1)),
        strikes: sortedDates.map(d => ((dateGroups[d].strikeCount / dateGroups[d].totalPitches) * 100).toFixed(1))
    };
}

// --- Chart 1: Velocity ---
function renderVelocityChart(chartData, labelPrefix) {
    const ctx = document.getElementById('velocityChart').getContext('2d');
    if (velocityChartInstance) velocityChartInstance.destroy();

    velocityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Avg Effective Velocity (MPH)',
                data: chartData.velo,
                borderColor: '#d22d49',
                backgroundColor: 'rgba(210, 45, 73, 0.2)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#ae4545',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: 'Velocity (MPH)' },
                    suggestedMin: 70,
                    suggestedMax: 100
                },
                x: { title: { display: true, text: 'Date' } }
            }
        }
    });
}

// --- Chart 2: Strike % ---
function renderStrikeChart(chartData, labelPrefix) {
    const ctx = document.getElementById('strikeChart').getContext('2d');
    if (strikeChartInstance) strikeChartInstance.destroy();

    strikeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Strike Percentage (%)',
                data: chartData.strikes,
                borderColor: '#1d4ed8', // Blue
                backgroundColor: 'rgba(29, 78, 216, 0.2)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#1d4ed8',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: 'Strike %' },
                    min: 0,
                    max: 100
                },
                x: { title: { display: true, text: 'Date' } }
            }
        }
    });
}