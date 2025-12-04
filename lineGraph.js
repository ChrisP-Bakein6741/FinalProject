// Global variables
let velocityChartInstance = null;
let strikeChartInstance = null;
let allParsedData = [];

document.addEventListener("DOMContentLoaded", () => {
    loadPitchersFromDatabase();
});

// --- REMOVED THE app.get() CODE THAT WAS CAUSING THE CRASH ---

async function loadPitchersFromDatabase() {
    const select = document.getElementById("pitcherSelect");
    if (!select) return;

    const res = await fetch("/api/players");
    const players = await res.json();

    select.innerHTML = '<option value="">Select a pitcher</option>';

    players.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });

    select.addEventListener("change", loadStatsFromDatabase);
}

async function loadStatsFromDatabase() {
    const pitcherId = document.getElementById("pitcherSelect").value;
    if (!pitcherId) return;

    // UPDATED: Pointing to a specific history endpoint to avoid conflicts
    const res = await fetch(`/api/stats/history?player=${pitcherId}`);
    
    if (!res.ok) {
        console.error("Failed to fetch data");
        return;
    }

    const rawData = await res.json();

    const formatted = rawData.map(row => ({
        date: row.game_date,
        velocity: row.EffectiveVelo,
        pitcher: row.Pitcher,
        call: row.PitchCall
    }));

    allParsedData = formatted;

    const chartData = calculateStats(allParsedData);
    renderVelocityChart(chartData);
    renderStrikeChart(chartData);
}

function updateGraphFromSelection() {
    const select = document.getElementById('pitcherSelect');
    const selectedPitcher = select.value || "All";

    if (allParsedData.length === 0) return;

    let filteredData = allParsedData;
    // Since the API already filters by player, this might be redundant, 
    // but we keep it for client-side safety.
    if (selectedPitcher !== "All") {
        filteredData = allParsedData.filter(row => row.pitcher === selectedPitcher);
    }

    const chartData = calculateStats(filteredData);
    
    // Render both charts independently
    renderVelocityChart(chartData, selectedPitcher);
    renderStrikeChart(chartData, selectedPitcher);
}


// --- Calculations ---
function calculateStats(data) {
    const dateGroups = {};
    const strikeCalls = ['StrikeCalled', 'StrikeSwinging', 'FoulBall', 'InPlay', 'FoulBallNotFieldable', 'FoulBallFieldable'];

    data.forEach(row => {
        // Ensure valid velocity and date exist
        if (row.velocity !== null && !isNaN(row.velocity) && row.velocity > 0 && row.velocity < 150 && row.date) {
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
function renderVelocityChart(chartData) {
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
function renderStrikeChart(chartData) {
    // Only render if element exists (since it wasn't in your HTML snippet, but is in your JS)
    const chartEl = document.getElementById('strikeChart');
    if(!chartEl) return;

    const ctx = chartEl.getContext('2d');
    if (strikeChartInstance) strikeChartInstance.destroy();

    strikeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Strike Percentage (%)',
                data: chartData.strikes,
                borderColor: '#1d4ed8', 
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