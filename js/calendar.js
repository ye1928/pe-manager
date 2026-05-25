// ============================================================
// INVESTMENT CALENDAR
// ============================================================
let calendarEvents = DB.load('calendar_events_v1', []);

function renderCalendar() {
  const today = new Date();
  renderCalendarMonth(today.getFullYear(), today.getMonth());
}

function getCalendarEvents(year, month) {
  const events = [...calendarEvents];
  // 自动加入基金分红登记日
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  funds.forEach(f => {
    (f.dividends || []).forEach(d => {
      if (d.date && d.date.startsWith(monthStr)) {
        events.push({
          id: 'div-' + d.id,
          date: d.date,
          title: `📋 ${f.name} 分红`,
          type: 'dividend',
          color: '#f59e0b',
        });
      }
    });
  });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function switchCalendarMonth(delta) {
  const today = new Date();
  let year = today.getFullYear(), month = today.getMonth();
  month += delta;
  if (month < 0) { month = 11; year--; }
  if (month > 11) { month = 0; year++; }
  renderCalendarMonth(year, month);
}

function renderCalendarMonth(year, month) {
  const container = document.getElementById('page-calendar');
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const monthStr = `${year}年${String(month + 1).padStart(2, '0')}月`;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const events = getCalendarEvents(year, month);

  let prevY = year, prevM = month - 1;
  if (prevM < 0) { prevM = 11; prevY--; }
  let nextY = year, nextM = month + 1;
  if (nextM > 11) { nextM = 0; nextY++; }

  let gridHtml = '';
  for (let i = 0; i < startPad; i++) gridHtml += '<div style="min-height:70px;"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    const isToday = isCurrentMonth && d === today.getDate();
    const isWeekend = (startPad + d - 1) % 7 >= 5;
    gridHtml += `<div style="min-height:70px;background:${isToday ? 'rgba(59,130,246,0.12)' : 'var(--bg3)'};border-radius:8px;padding:6px;${isToday ? 'border:1px solid rgba(59,130,246,0.4);' : ''}">
      <div style="font-size:12px;font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent)' : isWeekend ? 'var(--text3)' : 'var(--text)'};margin-bottom:3px;">${d}</div>
      ${dayEvents.map(e => `<div data-action="cal-event-detail" data-event-id="${e.id}" onclick="event.stopPropagation();showCalEventDetail('${e.id}')" style="font-size:10px;background:${e.color || 'var(--accent)'};color:white;border-radius:3px;padding:2px 4px;margin-bottom:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${e.title}">${e.title}</div>`).join('')}
      <button data-action="add-cal-event" data-date="${dateStr}" onclick="openAddCalEvent('${dateStr}')" style="width:100%;margin-top:2px;background:none;border:1px dashed var(--border);border-radius:3px;color:var(--text3);font-size:10px;padding:1px 2px;cursor:pointer;opacity:0;">+</button>
    </div>`;
  }

  const upcomingEvents = events.filter(e => e.date >= today.toISOString().slice(0, 10)).slice(0, 5);
  let eventsListHtml = upcomingEvents.length > 0
    ? upcomingEvents.map(e => `<div data-action="cal-event-detail" data-event-id="${e.id}" onclick="showCalEventDetail('${e.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:6px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${e.color || 'var(--accent)'};flex-shrink:0;"></div>
          <div style="font-size:12px;">${e.title}</div>
        </div>
        <div style="font-size:11px;color:var(--text3);">${e.date}</div>
      </div>`).join('')
    : `<div style="color:var(--text3);font-size:12px;text-align:center;padding:16px;">暂无近期事件</div>`;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <button class="btn btn-secondary btn-sm" onclick="renderCalendarMonth(${prevY},${prevM})">← 上月</button>
      <div style="font-size:16px;font-weight:700;">${monthStr}</div>
      <button class="btn btn-secondary btn-sm" onclick="renderCalendarMonth(${nextY},${nextM})">下月 →</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">
      ${['周一','周二','周三','周四','周五','周六','周日'].map(d => `<div style="text-align:center;font-size:11px;color:var(--text3);font-weight:600;padding:6px 0;">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
      ${gridHtml}
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-secondary btn-sm" onclick="openAddCalEvent()">＋ 添加事件</button>
    </div>
    <div style="margin-top:16px;">
      <div class="section-title" style="margin-bottom:8px;">📌 近期事件</div>
      ${eventsListHtml}
    </div>
  `;

  container.querySelectorAll('[data-action="add-cal-event"]').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
    btn.addEventListener('mouseleave', () => btn.style.opacity = '0');
  });
}

function openAddCalEvent(prefillDate) {
  const title = prompt('📅 事件标题：');
  if (!title || !title.trim()) return;
  const date = prefillDate || prompt('📅 日期（YYYY-MM-DD）：');
  if (!date) return;
  const colorMap = { '分红': '#f59e0b', '财报': '#ef4444', '业绩': '#3b82f6', '重要': '#8b5cf6' };
  const color = colorMap[Object.keys(colorMap).find(k => title.includes(k))] || '#64748b';
  const event = { id: uuid(), title: title.trim(), date, color };
  calendarEvents.push(event);
  DB.save('calendar_events_v1', calendarEvents);
  renderCalendar();
}

function showCalEventDetail(eventId) {
  const ev = calendarEvents.find(e => e.id === eventId);
  if (!ev) {
    // 分红等自动生成事件只展示信息
    alert(`${ev?.title || '事件'}\n日期：${evId}`);
    return;
  }
  if (confirm(`📅 ${ev.title}\n📆 日期：${ev.date}\n\n删除此事件？`)) {
    calendarEvents = calendarEvents.filter(e => e.id !== eventId);
    DB.save('calendar_events_v1', calendarEvents);
    renderCalendar();
  }
}

