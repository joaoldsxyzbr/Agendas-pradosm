const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function parseAgendaDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}
export function toIsoDate(year, month, day) {
  return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}
export function agendaCalendarDays(year, month, selected, today) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const previousDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstDay + 1;
    let y = year, m = month, day = offset, outside = false;
    if (offset < 1) {
      outside = true; m -= 1;
      if (m < 1) { m = 12; y -= 1; }
      day = previousDays + offset;
    } else if (offset > monthDays) {
      outside = true; m += 1;
      if (m > 12) { m = 1; y += 1; }
      day = offset - monthDays;
    }
    const iso = toIsoDate(y, m, day);
    return { iso, day, outside, selected: iso === selected, today: iso === today };
  });
}
function format(value) {
  const { day, month, year } = parseAgendaDate(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
function monthLabel(year, month) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long", year: "numeric", timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
function dayLabel(iso) {
  const { year, month, day } = parseAgendaDate(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
export function renderAgendaDatePicker(root, { value, today, onChange }) {
  let chosen = value, currentToday = today, open = false;
  let { year, month } = parseAgendaDate(chosen);
  const draw = () => {
    root.innerHTML = `<div class="agenda-calendar">
      <button class="agenda-calendar-trigger" type="button"
        aria-label="Data da agenda" aria-expanded="${open}" aria-haspopup="dialog" data-calendar-trigger>
        <strong>${format(chosen)}</strong>
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
          <path d="M7 3v3M17 3v3M4.5 9h15M5 5.5h14a1 1 0 0 1 1 1V20H4V6.5a1 1 0 0 1 1-1Z"
            fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
            stroke-linejoin="round"></path>
        </svg>
      </button>
      ${open ? `<button class="agenda-calendar-dismiss" type="button" aria-label="Fechar calendário" data-calendar-close></button>
      <div class="agenda-calendar-popover" role="dialog" aria-label="Calendário da agenda">
        <div class="agenda-calendar-header"><strong>${monthLabel(year, month)}</strong>
          <div><button type="button" aria-label="Mês anterior" data-calendar-prev>‹</button>
               <button type="button" aria-label="Próximo mês" data-calendar-next>›</button></div>
        </div>
        <div class="agenda-calendar-weekdays" aria-hidden="true">
          ${WEEKDAYS.map((d, i) => `<span data-weekday="${i}">${d}</span>`).join("")}
        </div>
        <div class="agenda-calendar-grid">
          ${agendaCalendarDays(year, month, chosen, currentToday).map(item =>
            `<button class="${["agenda-calendar-day", item.outside ? "outside" : "", item.today ? "today" : "", item.selected ? "selected" : ""].filter(Boolean).join(" ")}"
              type="button" aria-label="${dayLabel(item.iso)}" aria-pressed="${item.selected}"
              data-calendar-date="${item.iso}">${item.day}</button>`
          ).join("")}
        </div>
        <div class="agenda-calendar-footer"><button type="button" data-calendar-today>Hoje</button></div>
      </div>` : ""}
    </div>`;
  };
  const changeMonth = delta => {
    month += delta;
    if (month < 1) { month = 12; year--; }
    if (month > 12) { month = 1; year++; }
    draw();
  };
  const select = iso => {
    chosen = iso; open = false;
    ({ year, month } = parseAgendaDate(chosen));
    draw(); onChange(iso);
  };
  const click = event => {
    const target = event.target.closest?.("button");
    if (!target || !root.contains(target)) return;
    if (target.matches("[data-calendar-trigger]")) {
      open = !open;
      if (open) ({ year, month } = parseAgendaDate(chosen));
      draw();
    } else if (target.matches("[data-calendar-close]")) {
      open = false; draw();
    } else if (target.matches("[data-calendar-prev]")) changeMonth(-1);
    else if (target.matches("[data-calendar-next]")) changeMonth(1);
    else if (target.matches("[data-calendar-today]")) select(currentToday);
    else if (target.matches("[data-calendar-date]")) select(target.dataset.calendarDate);
  };
  root.addEventListener("click", click);
  draw();
  return {
    setValue(next) {
      chosen = next;
      if (!open) ({ year, month } = parseAgendaDate(chosen));
      draw();
    },
    setToday(next) { currentToday = next; draw(); },
    destroy() { root.removeEventListener("click", click); }
  };
}