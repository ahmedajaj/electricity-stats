let dailyChart, pieChart;
let currentStartDate, currentEndDate;
let currentView = 'list';
let allOutages = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setDateRange(7); // Default to last 7 days
});

function setDateRange(days) {
    const endDate = new Date();
    let startDate;

    if (days === 'all') {
        // Get earliest date from data
        fetch('/api/events')
            .then(response => response.json())
            .then(events => {
                if (events.length > 0) {
                    startDate = new Date(events[0].date);
                } else {
                    startDate = new Date('2025-10-01');
                }
                document.getElementById('startDate').valueAsDate = startDate;
                document.getElementById('endDate').valueAsDate = endDate;
                loadData();
            });
        return;
    }

    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    document.getElementById('startDate').valueAsDate = startDate;
    document.getElementById('endDate').valueAsDate = endDate;
    
    loadData();
}

async function loadData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Будь ласка, виберіть початкову та кінцеву дату');
        return;
    }

    currentStartDate = startDate;
    currentEndDate = endDate;

    showLoading(true);

    try {
        // Load statistics
        const statsResponse = await fetch(`/api/statistics?startDate=${startDate}&endDate=${endDate}`);
        const stats = await statsResponse.json();

        // Load daily statistics
        const dailyResponse = await fetch(`/api/statistics/daily?startDate=${startDate}&endDate=${endDate}`);
        const dailyStats = await dailyResponse.json();

        // Update summary cards
        updateSummaryCards(stats);

        // Update charts
        updateDailyChart(dailyStats);
        updateTimelineChart(stats.periods, dailyStats);

        // Update events list
        updateEventsList(stats.events);

        // Store outages for calendar view
        allOutages = calculateOutages(stats.events);
        
        // Render calendar
        renderCalendar();

        // Update last update time
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('uk-UA');

    } catch (error) {
        alert('Помилка завантаження даних. Спробуйте ще раз.');
    } finally {
        showLoading(false);
    }
}

function updateSummaryCards(stats) {
    const onHours = (stats.totalOnTime / (1000 * 60 * 60)).toFixed(1);
    const offHours = (stats.totalOffTime / (1000 * 60 * 60)).toFixed(1);
    
    // Count only OFF events (outages)
    const outages = stats.events.filter(e => e.status === 'off').length;

    document.getElementById('onPercentage').textContent = stats.percentageOn.toFixed(1) + '%';
    document.getElementById('offPercentage').textContent = stats.percentageOff.toFixed(1) + '%';
    document.getElementById('onHours').textContent = `${onHours} год`;
    document.getElementById('offHours').textContent = `${offHours} год`;
    document.getElementById('totalEvents').textContent = outages;
    
    const start = new Date(currentStartDate).toLocaleDateString('uk-UA');
    const end = new Date(currentEndDate).toLocaleDateString('uk-UA');
    document.getElementById('dateRange').textContent = `${start} - ${end}`;
}

function updateDailyChart(dailyStats) {
    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChart) {
        dailyChart.destroy();
    }

    const labels = dailyStats.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
    });

    const onData = dailyStats.map(day => day.onHours.toFixed(2));
    const offData = dailyStats.map(day => day.offHours.toFixed(2));

    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Є світло (годин)',
                    data: onData,
                    backgroundColor: 'rgba(76, 175, 80, 0.8)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 0
                },
                {
                    label: 'Немає світла (годин)',
                    data: offData,
                    backgroundColor: 'rgba(244, 67, 54, 0.8)',
                    borderColor: 'rgba(244, 67, 54, 1)',
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 24,
                    title: {
                        display: true,
                        text: 'Години'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        footer: (items) => {
                            const index = items[0].dataIndex;
                            const day = dailyStats[index];
                            return `Є світло: ${day.percentageOn.toFixed(1)}% | Немає: ${day.percentageOff.toFixed(1)}%`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'offHoursLabel',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    // Only draw labels on the "Немає світла" dataset (index 1)
                    if (datasetIndex === 1) {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        meta.data.forEach((bar, index) => {
                            const offHours = parseFloat(offData[index]);
                            if (offHours > 0.5) { // Only show if more than 0.5 hours
                                ctx.save();
                                ctx.font = 'bold 11px Arial';
                                ctx.fillStyle = '#fff';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                const label = `${offHours.toFixed(1)}г`;
                                const x = bar.x;
                                const y = bar.y + (bar.height / 2);
                                ctx.fillText(label, x, y);
                                ctx.restore();
                            }
                        });
                    }
                });
            }
        }]
    });
}

function updateTimelineChart(periods, dailyStats) {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = '';
    
    if (!dailyStats || dailyStats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Немає даних для відображення</p>';
        return;
    }

    // Create timeline visualization
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    
    // Add time scale
    const timeScale = document.createElement('div');
    timeScale.className = 'timeline-time-scale';
    timeScale.innerHTML = `
        <div class="timeline-day-label"></div>
        <div class="time-markers">
            <span>0:00</span>
            <span>6:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
        </div>
    `;
    timeline.appendChild(timeScale);
    
    // Create timeline for each day using dailyStats
    dailyStats.forEach(dayStat => {
        const date = dayStat.date;
        const dayContainer = document.createElement('div');
        dayContainer.className = 'timeline-day';
        
        const dayLabel = document.createElement('div');
        dayLabel.className = 'timeline-day-label';
        const dateObj = new Date(date);
        dayLabel.textContent = dateObj.toLocaleDateString('uk-UA', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const dayBar = document.createElement('div');
        dayBar.className = 'timeline-day-bar';
        
        // Day starts at 00:00 and ends at 23:59:59 in Kyiv time
        // Kyiv is UTC+2, so 00:00 Kyiv = 22:00 UTC (previous day)
        const dayStart = new Date(date + 'T00:00:00+02:00').getTime();
        const dayEnd = new Date(date + 'T23:59:59.999+02:00').getTime();
        const dayDuration = dayEnd - dayStart;
        
        // Filter periods that overlap with this specific day
        const dayPeriods = periods.filter(period => {
            const periodStart = new Date(period.start).getTime();
            const periodEnd = new Date(period.end).getTime();
            // Include if period overlaps with this day
            return periodEnd > dayStart && periodStart < dayEnd;
        }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        
        // Process each period
        dayPeriods.forEach(period => {
            const periodStart = Math.max(new Date(period.start).getTime(), dayStart);
            const periodEnd = Math.min(new Date(period.end).getTime(), dayEnd);
            
            // Skip if period is completely outside this day
            if (periodStart >= dayEnd || periodEnd <= dayStart || periodEnd <= periodStart) {
                return;
            }
            
            const segment = document.createElement('div');
            segment.className = `timeline-segment ${period.status}`;
            
            const duration = periodEnd - periodStart;
            const startPercent = ((periodStart - dayStart) / dayDuration) * 100;
            const widthPercent = (duration / dayDuration) * 100;
            
            segment.style.left = startPercent + '%';
            segment.style.width = widthPercent + '%';
            
            // Format time as HH:MM in Kyiv timezone (UTC+2)
            const startDate = new Date(periodStart);
            const endDate = new Date(periodEnd);
            const startTimeStr = startDate.toLocaleTimeString('uk-UA', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Europe/Kiev',
                hour12: false
            });
            const endTimeStr = endDate.toLocaleTimeString('uk-UA', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'Europe/Kiev',
                hour12: false
            });
            const hours = (duration / (1000 * 60 * 60)).toFixed(1);
            
            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'timeline-tooltip';
            
            // Different tooltip for on/off periods
            if (period.status === 'off') {
                tooltip.textContent = `Відключення з ${startTimeStr} до ${endTimeStr} (${hours} год)`;
            } else {
                tooltip.textContent = `Є світло ${startTimeStr} - ${endTimeStr} (${hours} год)`;
            }
            
            segment.appendChild(tooltip);
            dayBar.appendChild(segment);
        });
        
        dayContainer.appendChild(dayLabel);
        dayContainer.appendChild(dayBar);
        timeline.appendChild(dayContainer);
    });
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'timeline-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color on"></div>
            <span>Є світло</span>
        </div>
        <div class="legend-item">
            <div class="legend-color off"></div>
            <span>Немає світла</span>
        </div>
    `;
    
    container.appendChild(legend);
    container.appendChild(timeline);
}

function updatePieChart(stats) {
    const ctx = document.getElementById('pieChart').getContext('2d');

    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Є світло', 'Немає світла'],
            datasets: [{
                data: [stats.percentageOn.toFixed(2), stats.percentageOff.toFixed(2)],
                backgroundColor: [
                    'rgba(76, 175, 80, 0.9)',
                    'rgba(244, 67, 54, 0.9)'
                ],
                borderColor: [
                    'rgba(76, 175, 80, 1)',
                    'rgba(244, 67, 54, 1)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const hours = label.includes('Є') 
                                ? (stats.totalOnTime / (1000 * 60 * 60)).toFixed(1)
                                : (stats.totalOffTime / (1000 * 60 * 60)).toFixed(1);
                            return `${label}: ${value}% (${hours} год)`;
                        }
                    }
                }
            }
        }
    });
}

function updateEventsList(events) {
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';

    if (events.length === 0) {
        eventsList.innerHTML = '<p style="text-align: center; color: #666;">Немає подій за цей період</p>';
        return;
    }

    // Create outage periods by pairing OFF events with the next ON event
    const outages = [];
    for (let i = 0; i < events.length; i++) {
        if (events[i].status === 'off') {
            const startDate = new Date(events[i].date);
            let endDate = null;
            let duration = null;
            
            // Find the next ON event
            for (let j = i + 1; j < events.length; j++) {
                if (events[j].status === 'on') {
                    endDate = new Date(events[j].date);
                    duration = endDate - startDate;
                    break;
                }
            }
            
            // If no ON event found, outage is ongoing
            if (!endDate) {
                endDate = new Date(); // Current time
                duration = endDate - startDate;
            }
            
            outages.push({
                startDate,
                endDate,
                duration,
                isOngoing: !events.find((e, idx) => idx > i && e.status === 'on')
            });
        }
    }

    // Show all outages (most recent first)
    const recentOutages = outages.reverse();

    if (recentOutages.length === 0) {
        eventsList.innerHTML = '<p style="text-align: center; color: #666;">Немає відключень за цей період</p>';
        return;
    }

    recentOutages.forEach(outage => {
        const eventItem = document.createElement('div');
        eventItem.className = outage.isOngoing ? 'event-item ongoing' : 'event-item';

        // Format dates and times
        const startDate = outage.startDate.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short'
        });
        const startTime = outage.startDate.toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const endDate = outage.endDate.toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'short'
        });
        const endTime = outage.endDate.toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const hours = (outage.duration / (1000 * 60 * 60)).toFixed(1);

        eventItem.innerHTML = `
            <div class="event-icon ${outage.isOngoing ? 'ongoing' : ''}">
                <span class="material-icons">power_off</span>
                <span class="event-icon-label">Вимк</span>
            </div>
            <div class="event-details">
                ${outage.isOngoing ? '<div class="event-status-label">Відключення триває</div>' : ''}
                <div class="event-timeline">
                    <div class="event-time-block">
                        <div class="event-date">${startDate}</div>
                        <div class="event-time">${startTime}</div>
                    </div>
                    <span class="event-arrow material-icons">arrow_forward</span>
                    <div class="event-time-block">
                        <div class="event-date">${endDate}</div>
                        <div class="event-time">${endTime}</div>
                    </div>
                    <div class="event-icon end">
                        <span class="material-icons">power</span>
                        <span class="event-icon-label">Увімк</span>
                    </div>
                </div>
            </div>
            <div class="event-duration-badge ${outage.isOngoing ? 'ongoing' : ''}">
                <div class="event-duration-value">${hours}</div>
                <div class="event-duration-label">годин</div>
            </div>
        `;

        eventsList.appendChild(eventItem);
    });
}

function calculateOutages(events) {
    const outages = [];
    for (let i = 0; i < events.length; i++) {
        if (events[i].status === 'off') {
            const startDate = new Date(events[i].date);
            let endDate = null;
            let duration = null;
            
            // Find the next ON event
            for (let j = i + 1; j < events.length; j++) {
                if (events[j].status === 'on') {
                    endDate = new Date(events[j].date);
                    duration = endDate - startDate;
                    break;
                }
            }
            
            // If no ON event found, outage is ongoing
            if (!endDate) {
                endDate = new Date(); // Current time
                duration = endDate - startDate;
            }
            
            outages.push({
                startDate,
                endDate,
                duration,
                isOngoing: !events.find((e, idx) => idx > i && e.status === 'on')
            });
        }
    }
    return outages;
}

function renderCalendar() {
    const calendarContainer = document.getElementById('eventsCalendar');
    calendarContainer.innerHTML = '';
    
    if (!currentStartDate || !currentEndDate) {
        calendarContainer.innerHTML = '<p style="text-align: center; color: #666;">Виберіть діапазон дат</p>';
        return;
    }

    const start = new Date(currentStartDate);
    const end = new Date(currentEndDate);
    
    // Get first day of the week containing start date (Monday)
    const firstDay = new Date(start);
    const day = firstDay.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    firstDay.setDate(firstDay.getDate() + diff);
    
    // Week labels
    const weekLabels = document.createElement('div');
    weekLabels.className = 'calendar-week-labels';
    weekLabels.innerHTML = `
        <div class="calendar-week-label">Пн</div>
        <div class="calendar-week-label">Вт</div>
        <div class="calendar-week-label">Ср</div>
        <div class="calendar-week-label">Чт</div>
        <div class="calendar-week-label">Пт</div>
        <div class="calendar-week-label">Сб</div>
        <div class="calendar-week-label">Нд</div>
    `;
    calendarContainer.appendChild(weekLabels);
    
    // Calendar grid
    const calendar = document.createElement('div');
    calendar.className = 'events-calendar';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentDay = new Date(firstDay);
    const endPlusWeek = new Date(end);
    endPlusWeek.setDate(endPlusWeek.getDate() + 7);
    
    let lastMonth = null;
    let isFirstMonthDay = false;
    
    while (currentDay <= endPlusWeek) {
        // Add month header when month changes
        const currentMonth = currentDay.getMonth();
        const currentYear = currentDay.getFullYear();
        const monthKey = `${currentYear}-${currentMonth}`;
        
        if (lastMonth !== monthKey) {
            const monthHeader = document.createElement('div');
            monthHeader.className = 'calendar-month-header';
            monthHeader.style.gridColumn = '1 / -1';
            const monthName = currentDay.toLocaleDateString('uk-UA', { 
                month: 'long', 
                year: 'numeric' 
            });
            monthHeader.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            calendar.appendChild(monthHeader);
            lastMonth = monthKey;
            
            // Add empty cells to align first day of month with correct weekday
            // Only if current day is actually the 1st of the month
            if (currentDay.getDate() === 1) {
                const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
                let dayOfWeek = firstDayOfMonth.getDay();
                // Convert Sunday (0) to 7, Monday becomes 1
                dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
                
                // Add empty cells for days before the month starts
                for (let i = 1; i < dayOfWeek; i++) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'calendar-day empty-placeholder';
                    calendar.appendChild(emptyDiv);
                }
            }
        }
        
        const dayDiv = document.createElement('div');
        const isToday = currentDay.toDateString() === today.toDateString();
        const isEmpty = currentDay < start || currentDay > end;
        
        dayDiv.className = `calendar-day ${isToday ? 'today' : ''} ${isEmpty ? 'empty' : ''}`;
        
        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.innerHTML = `
            <div class="calendar-day-number">${currentDay.getDate()}</div>
        `;
        dayDiv.appendChild(dayHeader);
        
        if (!isEmpty) {
            // Find outages for this day
            const dayStart = new Date(currentDay);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(currentDay);
            dayEnd.setHours(23, 59, 59, 999);
            
            // Only show outages that START on this day
            const dayOutages = allOutages.filter(outage => {
                return outage.startDate >= dayStart && outage.startDate <= dayEnd;
            });
            
            if (dayOutages.length > 0) {
                const outagesContainer = document.createElement('div');
                outagesContainer.className = 'calendar-outages';
                
                dayOutages.forEach(outage => {
                    const outageDiv = document.createElement('div');
                    outageDiv.className = `calendar-outage ${outage.isOngoing ? 'ongoing' : ''}`;
                    
                    const startTimeStr = outage.startDate.toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const endTimeStr = outage.endDate.toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const hours = (outage.duration / (1000 * 60 * 60)).toFixed(1);
                    
                    outageDiv.innerHTML = `
                        <span class="calendar-outage-time">${startTimeStr} → ${endTimeStr}</span>
                        <span class="calendar-outage-duration">${hours} год</span>
                    `;
                    
                    outageDiv.title = `${outage.startDate.toLocaleString('uk-UA')} → ${outage.endDate.toLocaleString('uk-UA')}`;
                    
                    outagesContainer.appendChild(outageDiv);
                });
                
                dayDiv.appendChild(outagesContainer);
            }
        }
        
        calendar.appendChild(dayDiv);
        currentDay.setDate(currentDay.getDate() + 1);
    }
    
    calendarContainer.appendChild(calendar);
}

async function updateData() {
    if (!confirm('Це завантажить нові повідомлення з Telegram. Продовжити?')) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch('/api/update', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            alert('Дані успішно оновлено!');
            loadData();
        } else {
            alert('Помилка оновлення даних: ' + result.error);
        }
    } catch (error) {
        alert('Помилка оновлення даних. Спробуйте ще раз.');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}
