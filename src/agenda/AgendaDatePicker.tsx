import { useEffect, useMemo, useState } from "react";

type AgendaDatePickerProps = {
  value: string;
  today: string;
  onChange: (value: string) => void;
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  const { year, month, day } = parseDate(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function dayLabel(value: string) {
  const { year, month, day } = parseDate(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function AgendaDatePicker({
  value,
  today,
  onChange,
}: AgendaDatePickerProps) {
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);

  useEffect(() => {
    if (!open) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
  }, [open, selected.month, selected.year]);

  const days = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const currentMonthDays = new Date(
      Date.UTC(viewYear, viewMonth, 0),
    ).getUTCDate();
    const previousMonthDays = new Date(
      Date.UTC(viewYear, viewMonth - 1, 0),
    ).getUTCDate();

    return Array.from({ length: 42 }, (_, index) => {
      const offset = index - firstDay + 1;
      let year = viewYear;
      let month = viewMonth;
      let day = offset;
      let outside = false;

      if (offset < 1) {
        outside = true;
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        day = previousMonthDays + offset;
      } else if (offset > currentMonthDays) {
        outside = true;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        day = offset - currentMonthDays;
      }

      const iso = toIsoDate(year, month, day);
      return {
        iso,
        day,
        outside,
        selected: iso === value,
        today: iso === today,
      };
    });
  }, [today, value, viewMonth, viewYear]);

  function changeMonth(offset: number) {
    let month = viewMonth + offset;
    let year = viewYear;

    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }

    setViewMonth(month);
    setViewYear(year);
  }

  function selectDate(date: string) {
    onChange(date);
    setOpen(false);
  }

  return (
    <div className="agenda-calendar">
      <button
        className="agenda-calendar-trigger"
        type="button"
        aria-label="Data da agenda"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <strong>{formatDate(value)}</strong>
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 3v3M17 3v3M4.5 9h15M5 5.5h14a1 1 0 0 1 1 1V20H4V6.5a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <button
            className="agenda-calendar-dismiss"
            type="button"
            aria-label="Fechar calendário"
            onClick={() => setOpen(false)}
          />
          <div
            className="agenda-calendar-popover"
            role="dialog"
            aria-label="Calendário da agenda"
          >
            <div className="agenda-calendar-header">
              <strong>{monthLabel(viewYear, viewMonth)}</strong>
              <div>
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => changeMonth(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => changeMonth(1)}
                >
                  ›
                </button>
              </div>
            </div>

            <div className="agenda-calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday, index) => (
                <span key={`${weekday}-${index}`}>{weekday}</span>
              ))}
            </div>

            <div className="agenda-calendar-grid">
              {days.map((item) => (
                <button
                  key={item.iso}
                  className={[
                    "agenda-calendar-day",
                    item.outside ? "outside" : "",
                    item.today ? "today" : "",
                    item.selected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-label={dayLabel(item.iso)}
                  aria-pressed={item.selected}
                  onClick={() => selectDate(item.iso)}
                >
                  {item.day}
                </button>
              ))}
            </div>

            <div className="agenda-calendar-footer">
              <button type="button" onClick={() => selectDate(today)}>
                Hoje
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
