// Put shared navbar into all pages
async function loadNavbar() {
  const navbarContainer = document.getElementById("navbar");
  if (!navbarContainer) return;

  // Load navBar.html file
  const res = await fetch("navBar.html");
  const html = await res.text();

  navbarContainer.innerHTML = html;
}

// script.js - ADDITIONS near the top

let pitchDataCache = {}; // Cache for full pitch data (used by scatterplot)
let scatterChartInstance = null; 

// Metrics list for scatterplot dropdowns
const SCATTER_METRICS = {
    'RelSpeed': 'Release Speed (MPH)',
    'InducedVertBreak': 'Induced Vertical Break (in)',
    'HorzBreak': 'Horizontal Break (in)',
    'RelSide': 'Horizontal Release (ft)',
    'RelHeight': 'Vertical Release (ft)',
    'SpinRate': 'Spin Rate (RPM)',
    'Extension': 'Extension (ft)',
};

// Moved pitch colors into a function for re-use
function getPitchColors() {
  return {
      'fastball': '#d22d49',           
      'four-seam fastball': '#d22d49', 
      'fourseamfastball': '#d22d49',
      'four-seam': '#d22d49', 
      'ff': '#d22d49',
      'sinker': '#fe9d00',             
      'si': '#fe9d00',
      'sink': '#fe9d00',
      'two-seam fastball': '#fe9d00',
      'cutter': '#933f2c',             
      'fc': '#933f2c',
      'cut': '#933f2c',
      'slider': '#eee716',             
      'sl': '#eee716',
      'sweeper': '#eee716',
      'st': '#eee716',        
      'curveball': '#00d1ed',          
      'cu': '#00d1ed',
      'cb': '#00d1ed',
      'knuckle curve': '#3c44cd',      
      'kc': '#3c44cd',
      'changeup': '#1db053',           
      'ch': '#1db053',
      'change': '#1db053',
      'splitter': '#3ea430',           
      'fs': '#3ea430',
      'spl': '#3ea430'
  };
}


// Load on startup
loadNavbar();

// script.js - REPLACEMENT for async function loadStats()

async function loadAllStats() {
  const player = document.getElementById('player').value;
  const gameDate = document.getElementById('gameDate').value;
  const tableContainer = document.getElementById('statsDisplay');

  if (!player || !gameDate) {
      // Clear both outputs if selections are not done
      tableContainer.innerHTML = 'Select a player and a game date to view report.';
      clearScatterplot(); // New helper function
      return;
  }

  tableContainer.innerHTML = "Calculating metrics for table report...";
  clearScatterplot("Loading pitch data for scatterplot...");

  try {
    // 1. Load Aggregated Stats (For Table Report)
    await loadStatsTable(player, gameDate);

    // 2. Load and Render Scatterplot
    const xAxisKey = document.getElementById('xAxis').value;
    const yAxisKey = document.getElementById('yAxis').value;
    await loadAndRenderScatterplot(player, gameDate, xAxisKey, yAxisKey);

  } catch (err) {
    console.error("Error in loadAllStats:", err);
    tableContainer.innerHTML = `<div style="color:red">Error loading report: ${err.message}</div>`;
    clearScatterplot(`Error loading scatterplot data.`);
  }
}

// RENAME your existing loadStats function to loadStatsTable 
// and ensure it no longer contains the alert for missing player/date.
// It should only contain the fetch to /api/stats and the call to displayStats.
async function loadStatsTable(player, gameDate) {
  const container = document.getElementById('statsDisplay');
  // ... (Your original fetch('/api/stats...') and processing logic here)
  try {
    const res = await fetch(`/api/stats?player=${player}&date=${gameDate}`);
    if (!res.ok) throw new Error(`Server status: ${res.status}`);

    const data = await res.json();

    // CALCULATE USAGE PERCENTAGE HERE
    const totalPitches = data.reduce((sum, row) => sum + row.count, 0);

    const processedData = data.map(row => ({
        "Pitch Type": row.pitch_type,
        "Count": row.count,
        "Usage %": ((row.count / totalPitches) * 100).toFixed(1) + '%',
        "Max Vel": row.max_vel ? row.max_vel.toFixed(1) : "-",
        "Avg Vel": row.avg_vel ? row.avg_vel.toFixed(1) : "-",
        "IVB": row.ivb ? row.ivb.toFixed(1) : "-",
        "HB": row.hb ? row.hb.toFixed(1) : "-",
        "Horz Rel": row.horz_rel ? row.horz_rel.toFixed(2) : "-",
        "Vert Rel": row.vert_rel ? row.vert_rel.toFixed(2) : "-",
        "Spin": row.spin ? Math.round(row.spin) : "-",
        "Extension": row.extension ? row.extension.toFixed(1) : "-"
    }));

    displayStats(processedData);

  } catch (err) {
    console.error(err);
    throw new Error("Failed to load table metrics."); // Throw error for loadAllStats to catch
  }
}
// ... (rest of the file follows)




function displayStats(stats) {
  const container = document.getElementById('statsDisplay');
  container.innerHTML = '';

  if (!stats || stats.length === 0) {
    container.textContent = 'No stats available.';
    return;
  }

  // --- DEFINE PITCH COLORS ---
  const pitchColors = {
      'fastball': '#d22d49',           // Red
      'four-seam fastball': '#d22d49', 
      'fourseamfastball': '#d22d49',
      'four-seam': '#d22d49', 
      'ff': '#d22d49',
      
      'sinker': '#fe9d00',             // Orange
      'si': '#fe9d00',
      'sink': '#fe9d00',
      'two-seam fastball': '#fe9d00',
      
      'cutter': '#933f2c',             // Dark Red
      'fc': '#933f2c',
      'cut': '#933f2c',
      
      'slider': '#eee716',             // Yellow
      'sl': '#eee716',
      'sweeper': '#eee716',
      'st': '#eee716',        
      
      'curveball': '#00d1ed',          // Cyan/Blue
      'cu': '#00d1ed',
      'cb': '#00d1ed',
      
      'knuckle curve': '#3c44cd',      // Darker Blue
      'kc': '#3c44cd',
      
      'changeup': '#1db053',           // Green
      'ch': '#1db053',
      'change': '#1db053',
      
      'splitter': '#3ea430',           // Darker Green
      'fs': '#3ea430',
      'spl': '#3ea430'
  };
//Create table to view stats
  const table = document.createElement('table');
  table.border = '1';
  table.style.borderCollapse = 'collapse';

  // Create Headers
  const headerRow = document.createElement('tr');
  const headers = Object.keys(stats[0]);
  
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.padding = '8px 12px';
    th.style.backgroundColor = '#333';
    th.style.color = '#fff';
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Create Rows
  stats.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      let value = row[header] !== null ? row[header] : "-";
      
      td.textContent = value; 
      td.style.padding = '8px 12px';
      td.style.textAlign = 'center';

      // --- COLOR LOGIC ---
      if (header === "Pitch Type" && value !== "-") {
          // Convert value to lowercase and trim spaces for matching
          const cleanValue = String(value).trim().toLowerCase();
          
          if (pitchColors[cleanValue]) {
              // Apply background color
              td.style.setProperty('background-color', pitchColors[cleanValue], 'important');
              td.style.fontWeight = 'bold';
              
              // Set text color to white for dark backgrounds, black for light
              const darkBackgrounds = ['#933f2c', '#3c44cd', '#d22d49', '#3ea430'];
              if (darkBackgrounds.includes(pitchColors[cleanValue])) {
                  td.style.color = 'white';
              } else {
                  td.style.color = 'black';
              }
          } else {
             console.log(`No color match for: ${cleanValue}`);
          }
      }

      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}
function downloadReport() {
  const table = document.querySelector('#statsDisplay table');

  if (!table) {
    alert("No stats available to download. Please load stats first.");
    return;
  }

  const playerName = document.getElementById('player').options[document.getElementById('player').selectedIndex].text;
  const gameDate = document.getElementById('gameDate').value;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'pt', 'a4'); 

  doc.setFontSize(14);
  doc.text("Pitching Performance Report", 40, 40);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Player: ${playerName} | Game Date: ${gameDate}`, 40, 55);

  doc.autoTable({ 
    html: table,
    startY: 70,
    theme: 'grid', 
    styles: { fontSize: 7, cellPadding: 3, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    margin: { top: 70, left: 40, right: 40 },
    horizontalPageBreak: true 
  });

  const safeName = playerName.replace(/\s+/g, '_');
  doc.save(`Stats_${safeName}_${gameDate}.pdf`);
}

// script.js - ADDITIONS (Scatterplot Logic)

// --- Pitch-Level Data Fetching ---
async function getPitchData(playerId, gameDate) {
    const cacheKey = `${playerId}_${gameDate}`; 
    if (pitchDataCache[cacheKey]) {
        return pitchDataCache[cacheKey];
    }
    
    // Calls the new /api/pitchDataForDate on the server
    const res = await fetch(`/api/pitchDataForDate?player=${playerId}&date=${gameDate}`);
    if (!res.ok) throw new Error(`Server status: ${res.status} when fetching pitch-level data.`);

    const data = await res.json();
    pitchDataCache[cacheKey] = data; 
    return data;
}

// --- Rendering Logic ---
async function loadAndRenderScatterplot(playerId, gameDate, xAxisKey, yAxisKey) {
    const data = await getPitchData(playerId, gameDate);

    const pitchTypes = [...new Set(data.map(d => d.TaggedPitchType))].filter(Boolean).sort();
    const datasets = [];
    const pitchColors = getPitchColors(); 

    pitchTypes.forEach(type => {
        const filteredPitches = data.filter(d => d.TaggedPitchType === type);
        const colorKey = String(type).trim().toLowerCase();
        const color = pitchColors[colorKey] || '#888'; 

        datasets.push({
            label: type,
            data: filteredPitches
                .map(d => ({ 
                    x: parseFloat(d[xAxisKey]), 
                    y: parseFloat(d[yAxisKey]) 
                }))
                .filter(point => !isNaN(point.x) && !isNaN(point.y)),
            backgroundColor: color,
            borderColor: color,
            pointRadius: 4,
            pointHoverRadius: 6,
        });
    });

    renderScatterChart(datasets, xAxisKey, yAxisKey);
}

function clearScatterplot(message = "Select player and game date to view scatterplot.") {
    const chartCanvas = document.getElementById('scatterChart');
    if (scatterChartInstance) {
        scatterChartInstance.destroy();
    }
    if (chartCanvas) {
        const ctx = chartCanvas.getContext('2d');
        ctx.font = "12px Arial";
        ctx.fillStyle = "gray";
        ctx.textAlign = "center";
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
}

function renderScatterChart(datasets, xAxisKey, yAxisKey) {
    const ctx = document.getElementById('scatterChart').getContext('2d');
    if (scatterChartInstance) scatterChartInstance.destroy();

    scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${SCATTER_METRICS[yAxisKey]} vs ${SCATTER_METRICS[xAxisKey]}`
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: SCATTER_METRICS[xAxisKey] }
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: SCATTER_METRICS[yAxisKey] }
                }
            }
        }
    });
}

// Ensure getPitchColors is accessible if it's not global
// You can move the pitchColors object from displayStats into a new function:
function getPitchColors() {
    return {
      'fastball': '#d22d49',           // Red
      'four-seam fastball': '#d22d49', 
      'fourseamfastball': '#d22d49',
      'four-seam': '#d22d49', 
      'ff': '#d22d49',
      
      'sinker': '#fe9d00',             // Orange
      'si': '#fe9d00',
      'sink': '#fe9d00',
      'two-seam fastball': '#fe9d00',
      
      'cutter': '#933f2c',             // Dark Red
      'fc': '#933f2c',
      'cut': '#933f2c',
      
      'slider': '#eee716',             // Yellow
      'sl': '#eee716',
      'sweeper': '#eee716',
      'st': '#eee716',        
      
      'curveball': '#00d1ed',          // Cyan/Blue
      'cu': '#00d1ed',
      'cb': '#00d1ed',
      
      'knuckle curve': '#3c44cd',      // Darker Blue
      'kc': '#3c44cd',
      
      'changeup': '#1db053',           // Green
      'ch': '#1db053',
      'change': '#1db053',
      
      'splitter': '#3ea430',           // Darker Green
      'fs': '#3ea430',
      'spl': '#3ea430'
    };
}

async function loadGameDates(playerId) {
  const selectDate = document.getElementById('gameDate');
  selectDate.innerHTML = '<option value="">Loading...</option>';
  
  try {
    const res = await fetch(`/api/dates?player=${playerId}`);
    const dates = await res.json();
    
    if (dates.length === 0) {
         selectDate.innerHTML = '<option value="">No games found</option>';
    } else {
        selectDate.innerHTML = '<option value="">Select game date</option>';
        dates.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.date_str;
            opt.textContent = d.date_str;
            selectDate.appendChild(opt);
        });
    }
    selectDate.disabled = false;
  } catch (error) {
    console.error("Error loading dates:", error);
    selectDate.innerHTML = '<option value="">Error</option>';
    selectDate.disabled = false;
  }
}

// script.js - CORRECTED window.onload FUNCTION

window.onload = async () => {
    const selectPlayer = document.getElementById('player');
    const selectDate = document.getElementById('gameDate');
    const xAxisSelect = document.getElementById('xAxis'); 
    const yAxisSelect = document.getElementById('yAxis'); 

    // --- 1. Load Players (RESTORED ORIGINAL LOGIC) ---
    try {
        const res = await fetch('/api/players');
        const players = await res.json();
        
        selectPlayer.innerHTML = '<option value="">Select player</option>';
        const seen = new Set();
        players.forEach(p => {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                selectPlayer.appendChild(opt);
            }
        });
    } catch (err) {
        console.error("Error fetching players:", err);
    }

    if (selectPlayer) {
        selectPlayer.addEventListener('change', (e) => {
            const playerId = e.target.value;
            if (playerId) {
                loadGameDates(playerId);
            } else {
                if (selectDate) {
                    selectDate.innerHTML = '<option value="">Select player first</option>';
                    selectDate.disabled = true;
                }
            }
            // Clear reports when player changes
            const statsDisplay = document.getElementById('statsDisplay');
            if (statsDisplay) statsDisplay.innerHTML = '';
            clearScatterplot(); // New scatterplot helper function
        });
    }
    
    // Set the "View Stats" button to use the new unified function
    const viewStatsButton = document.querySelector('button'); 
    if (viewStatsButton && viewStatsButton.textContent.trim() === 'View Stats') {
        viewStatsButton.onclick = loadAllStats; 
    }
    
    // Axis listeners for scatterplot updates 
    if (xAxisSelect) xAxisSelect.addEventListener('change', loadAllStats);
    if (yAxisSelect) yAxisSelect.addEventListener('change', loadAllStats);
    // ------------------------------------------

    // --- 3. Initialize Scatterplot Dropdowns  ---
    if (xAxisSelect && yAxisSelect) {
        // SCATTER_METRICS must be defined globally for this to work
        const keys = Object.keys(SCATTER_METRICS); 
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = SCATTER_METRICS[key];
            xAxisSelect.appendChild(option.cloneNode(true));
            yAxisSelect.appendChild(option.cloneNode(true));
        });
        xAxisSelect.value = 'RelSide';
        yAxisSelect.value = 'RelHeight';
    }
    
    // Show initial empty message for chart
    clearScatterplot();
};

