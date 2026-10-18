import { normalizeAgendaSearch, sortAgendaAppointments } from "./agenda-list.js";

export function countAgendaStatus(appointments, status) {
  return appointments.filter(appointment => appointment.status === status).length;
}

export function storeAgendaMetrics(appointments) {
  return {
    total: appointments.length,
    aguardando: countAgendaStatus(appointments,"aguardando"),
    recebido: countAgendaStatus(appointments,"recebido"),
    naoChegou: countAgendaStatus(appointments,"nao_chegou"),
    trocas: appointments.filter(appointment => appointment.hasExchanges).length
  };
}

export function filterStoreAppointments(appointments, search) {
  const query = normalizeAgendaSearch(search);
  const sorted = sortAgendaAppointments(appointments);
  return !query ? sorted : sorted.filter(item =>
    normalizeAgendaSearch(`${item.supplier} ${item.protocol}`).includes(query));
}

export function storeAgendaEndpoint(selectedDate,today) {
  return selectedDate === today
    ? "/api/store/today"
    : `/api/store/history/${encodeURIComponent(selectedDate)}`;
}

export function formatStoreDate(value) {
  const [year,month,day]=String(value).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}
export function addStoreDays(value,amount) {
  const day = new Date(`${value}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate()+amount);
  return day.toISOString().slice(0,10);
}
