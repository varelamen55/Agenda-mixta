import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "agenda_mixta_ready_v2";
const categories = ["general", "trabajo", "estudios", "hockey", "personal"];
const priorities = ["baja", "media", "alta"];
const recurrenceOptions = [
  { value: "none", label: "Sin repetición" },
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "weekdays", label: "Lunes a viernes" },
  { value: "custom_weekdays", label: "Días concretos" },
];
const weekDays = [
  { key: 1, label: "L" },
  { key: 2, label: "M" },
  { key: 3, label: "X" },
  { key: 4, label: "J" },
  { key: 5, label: "V" },
  { key: 6, label: "S" },
  { key: 0, label: "D" },
];

const categoryColors = {
  general: { bg: "#e2e8f0", text: "#0f172a", soft: "#f8fafc", border: "#cbd5e1" },
  trabajo: { bg: "#dbeafe", text: "#1e3a8a", soft: "#eff6ff", border: "#93c5fd" },
  estudios: { bg: "#dcfce7", text: "#166534", soft: "#f0fdf4", border: "#86efac" },
  hockey: { bg: "#fee2e2", text: "#991b1b", soft: "#fff1f2", border: "#fca5a5" },
  personal: { bg: "#fef3c7", text: "#92400e", soft: "#fffbeb", border: "#fcd34d" },
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function initialForm(date = getToday()) {
  return {
    titulo: "",
    descripcion: "",
    fecha: date,
    hora: "09:00",
    tipo: "tarea",
    categoria: "general",
    prioridad: "media",
    recurrencia: "none",
    diasSemana: [],
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { items: [], completions: {} };
  } catch {
    return { items: [], completions: {} };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDateES(dateStr, mode = "full") {
  const options =
    mode === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat("es-ES", options).format(new Date(dateStr + "T12:00:00"));
}

function recurrenceText(item) {
  if (item.recurrencia === "custom_weekdays") {
    const labels = weekDays.filter((d) => (item.diasSemana || []).includes(d.key)).map((d) => d.label).join("-");
    return labels ? `Días: ${labels}` : "Días concretos";
  }

  const map = {
    none: "Única",
    daily: "Diaria",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    weekdays: "Lunes a viernes",
  };
  return map[item.recurrencia] || "Única";
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(dateStr) {
  const start = startOfWeek(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function monthsBetween(start, end) {
  const a = new Date(start + "T12:00:00");
  const b = new Date(end + "T12:00:00");
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function occursOnDate(item, targetDate) {
  if (!item || !targetDate) return false;
  if (targetDate < item.fecha) return false;
  if (item.recurrencia === "none") return item.fecha === targetDate;

  const start = new Date(item.fecha + "T12:00:00");
  const target = new Date(targetDate + "T12:00:00");
  const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));

  if (item.recurrencia === "daily") return diffDays >= 0;
  if (item.recurrencia === "weekly") return diffDays >= 0 && diffDays % 7 === 0;
  if (item.recurrencia === "biweekly") return diffDays >= 0 && diffDays % 14 === 0;
  if (item.recurrencia === "monthly") return target.getDate() === start.getDate() && monthsBetween(item.fecha, targetDate) >= 0;
  if (item.recurrencia === "weekdays") {
    const day = target.getDay();
    return diffDays >= 0 && day >= 1 && day <= 5;
  }
  if (item.recurrencia === "custom_weekdays") {
    return diffDays >= 0 && (item.diasSemana || []).includes(target.getDay());
  }
  return false;
}

function getOccurrenceKey(itemId, dateStr) {
  return `${itemId}__${dateStr}`;
}

function getMonthGrid(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1, 12, 0, 0);
  const firstDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, i) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    return {
      date: cell.toISOString().slice(0, 10),
      currentMonth: cell.getMonth() === month,
      day: cell.getDate(),
    };
  });
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agenda-mixta-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function Badge({ children, soft = false, category = null }) {
  const color = category ? (categoryColors[category] || categoryColors.general) : null;
  const background = category ? color.bg : soft ? "#eef2ff" : "#e2e8f0";
  const textColor = category ? color.text : "#0f172a";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        background,
        color: textColor,
        border: "1px solid #cbd5e1",
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({ children, title, right }) {
  return (
    <div style={styles.card}>
      {(title || right) && (
        <div style={styles.cardHeader}>
          <h3 style={{ margin: 0, fontSize: 22 }}>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function EntryForm({ form, setForm, onSubmit, onCancel, isEditing }) {
  function toggleWeekday(dayKey) {
    const exists = form.diasSemana.includes(dayKey);
    setForm({
      ...form,
      diasSemana: exists ? form.diasSemana.filter((d) => d !== dayKey) : [...form.diasSemana, dayKey].sort(),
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <label style={styles.labelWrap}>
        <span style={styles.label}>Título</span>
        <input style={styles.input} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
      </label>

      <label style={styles.labelWrap}>
        <span style={styles.label}>Descripción</span>
        <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
      </label>

      <div style={styles.grid2}>
        <label style={styles.labelWrap}>
          <span style={styles.label}>Fecha de inicio</span>
          <input type="date" style={styles.input} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </label>
        <label style={styles.labelWrap}>
          <span style={styles.label}>Hora</span>
          <input type="time" style={styles.input} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
        </label>
      </div>

      <div style={styles.grid3}>
        <label style={styles.labelWrap}>
          <span style={styles.label}>Tipo</span>
          <select style={styles.input} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="tarea">Tarea</option>
            <option value="cita">Cita</option>
          </select>
        </label>
        <label style={styles.labelWrap}>
          <span style={styles.label}>Categoría</span>
          <select style={styles.input} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label style={styles.labelWrap}>
          <span style={styles.label}>Prioridad</span>
          <select style={styles.input} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
            {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <label style={styles.labelWrap}>
        <span style={styles.label}>Repetición</span>
        <select
          style={styles.input}
          value={form.recurrencia}
          onChange={(e) => setForm({ ...form, recurrencia: e.target.value, diasSemana: e.target.value === "custom_weekdays" ? form.diasSemana : [] })}
        >
          {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      {form.recurrencia === "custom_weekdays" && (
        <div style={styles.labelWrap}>
          <span style={styles.label}>Días concretos</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {weekDays.map((day) => (
              <button
                key={day.key}
                onClick={() => toggleWeekday(day.key)}
                type="button"
                style={{
                  ...styles.smallButton,
                  background: form.diasSemana.includes(day.key) ? "#0f172a" : "white",
                  color: form.diasSemana.includes(day.key) ? "white" : "#0f172a",
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={styles.primaryButton} onClick={onSubmit} type="button">
          {isEditing ? "Guardar cambios" : "Crear entrada"}
        </button>
        {isEditing && (
          <button style={styles.secondaryButton} onClick={onCancel} type="button">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, subtitle }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: 13, color: "#475569" }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

export default function AgendaMixtaReady() {
  const [db, setDb] = useState({ items: [], completions: {} });
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [viewMode, setViewMode] = useState("dia");
  const [filterState, setFilterState] = useState("pendientes");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm(getToday()));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setDb(loadData());
  }, []);

  useEffect(() => {
    saveData(db);
  }, [db]);

  useEffect(() => {
    if (!showForm) {
      setForm(initialForm(selectedDate));
      setEditingId(null);
    }
  }, [showForm, selectedDate]);

  function getItemsForDate(date) {
    return db.items
      .filter((item) => occursOnDate(item, date))
      .map((item) => ({ ...item, completed: !!db.completions[getOccurrenceKey(item.id, date)] }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }

  const baseDayItems = useMemo(() => getItemsForDate(selectedDate), [db, selectedDate]);

  const filteredDayItems = useMemo(() => {
    return baseDayItems.filter((item) => {
      if (filterState === "pendientes" && item.completed) return false;
      if (filterState === "hechas" && !item.completed) return false;
      if (categoryFilter !== "todas" && item.categoria !== categoryFilter) return false;
      if (typeFilter !== "todos" && item.tipo !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return [item.titulo, item.descripcion, item.categoria, item.tipo].join(" ").toLowerCase().includes(q);
      }
      return true;
    });
  }, [baseDayItems, filterState, categoryFilter, typeFilter, search]);

  const summary = useMemo(() => {
    const allToday = getItemsForDate(selectedDate);
    const completed = allToday.filter((item) => item.completed).length;
    const citas = allToday.filter((item) => item.tipo === "cita").length;
    const tareas = allToday.filter((item) => item.tipo === "tarea").length;
    return { total: allToday.length, completed, pending: allToday.length - completed, citas, tareas };
  }, [db, selectedDate]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => getMonthGrid(selectedDate), [selectedDate]);

  function saveEntry() {
    if (!form.titulo.trim()) return;
    if (form.recurrencia === "custom_weekdays" && form.diasSemana.length === 0) return;

    if (editingId) {
      setDb((prev) => ({ ...prev, items: prev.items.map((item) => (item.id === editingId ? { ...item, ...form } : item)) }));
    } else {
      setDb((prev) => ({
        ...prev,
        items: [{ id: crypto.randomUUID(), ...form, createdAt: new Date().toISOString() }, ...prev.items],
      }));
    }
    setShowForm(false);
  }

  function editItem(item) {
    setEditingId(item.id);
    setForm({
      titulo: item.titulo,
      descripcion: item.descripcion,
      fecha: item.fecha,
      hora: item.hora,
      tipo: item.tipo,
      categoria: item.categoria,
      prioridad: item.prioridad,
      recurrencia: item.recurrencia,
      diasSemana: item.diasSemana || [],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCompletion(itemId, dateStr = selectedDate) {
    const key = getOccurrenceKey(itemId, dateStr);
    setDb((prev) => ({
      ...prev,
      completions: { ...prev.completions, [key]: !prev.completions[key] },
    }));
  }

  function deleteItem(itemId) {
    setDb((prev) => {
      const nextCompletions = { ...prev.completions };
      Object.keys(nextCompletions).forEach((key) => {
        if (key.startsWith(itemId + "__")) delete nextCompletions[key];
      });
      return { items: prev.items.filter((item) => item.id !== itemId), completions: nextCompletions };
    });
  }

  function changeSelectedDate(days) {
    setSelectedDate(addDays(selectedDate, days));
  }

  function moveMonth(diff) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setMonth(d.getMonth() + diff);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  function seedExampleData() {
    const monday = startOfWeek(selectedDate);
    const items = [
      {
        id: crypto.randomUUID(),
        titulo: "Entrenamiento base",
        descripcion: "Pista principal - grupo escuela",
        fecha: monday,
        hora: "17:30",
        tipo: "cita",
        categoria: "hockey",
        prioridad: "alta",
        recurrencia: "weekly",
        diasSemana: [],
      },
      {
        id: crypto.randomUUID(),
        titulo: "Reunión de coordinación",
        descripcion: "Seguimiento con staff",
        fecha: monday,
        hora: "10:00",
        tipo: "cita",
        categoria: "trabajo",
        prioridad: "media",
        recurrencia: "biweekly",
        diasSemana: [],
      },
      {
        id: crypto.randomUUID(),
        titulo: "Publicación Instagram",
        descripcion: "Preparar copy y foto",
        fecha: selectedDate,
        hora: "20:00",
        tipo: "tarea",
        categoria: "hockey",
        prioridad: "media",
        recurrencia: "weekdays",
        diasSemana: [],
      },
      {
        id: crypto.randomUUID(),
        titulo: "Revisar contabilidad",
        descripcion: "Seguimiento semanal",
        fecha: monday,
        hora: "09:00",
        tipo: "tarea",
        categoria: "trabajo",
        prioridad: "alta",
        recurrencia: "custom_weekdays",
        diasSemana: [1, 3, 5],
      },
    ];
    setDb((prev) => ({ ...prev, items: [...items, ...prev.items] }));
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result);
        if (parsed.items && parsed.completions) setDb(parsed);
      } catch {
        alert("El archivo no es válido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.mainTitle}>Agenda mixta personal</h1>
        <p style={styles.subtitle}>Tareas, citas, recurrencias, vista diaria, semanal y mensual. Guardado automático en tu navegador.</p>

        <div style={styles.statsGrid}>
          <Stat title="Total hoy" value={summary.total} subtitle="Elementos programados" />
          <Stat title="Pendientes" value={summary.pending} subtitle="Todavía por hacer" />
          <Stat title="Completadas" value={summary.completed} subtitle="Marcadas para hoy" />
          <Stat title="Citas / Tareas" value={`${summary.citas} / ${summary.tareas}`} subtitle="Resumen del día" />
        </div>

        {showForm && (
          <SectionCard
            title={editingId ? "Editar entrada" : "Nueva entrada"}
            right={<button style={styles.secondaryButton} onClick={() => setShowForm(false)}>Cerrar</button>}
          >
            <EntryForm form={form} setForm={setForm} onSubmit={saveEntry} onCancel={() => setShowForm(false)} isEditing={!!editingId} />
          </SectionCard>
        )}

        <div style={styles.mainGrid}>
          <div style={{ display: "grid", gap: 16 }}>
            <SectionCard title="Control" right={<button style={styles.primaryButton} onClick={() => setShowForm(true)}>Nueva entrada</button>}>
              <div style={{ display: "grid", gap: 12 }}>
                <label style={styles.labelWrap}>
                  <span style={styles.label}>Buscar</span>
                  <input style={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, descripción, categoría..." />
                </label>

                <label style={styles.labelWrap}>
                  <span style={styles.label}>Vista</span>
                  <select style={styles.input} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                    <option value="dia">Día</option>
                    <option value="semana">Semana</option>
                    <option value="mes">Mes</option>
                  </select>
                </label>

                <div style={styles.grid2}>
                  <label style={styles.labelWrap}>
                    <span style={styles.label}>Estado</span>
                    <select style={styles.input} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
                      <option value="pendientes">Pendientes</option>
                      <option value="hechas">Hechas</option>
                      <option value="todas">Todas</option>
                    </select>
                  </label>
                  <label style={styles.labelWrap}>
                    <span style={styles.label}>Tipo</span>
                    <select style={styles.input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="tarea">Tareas</option>
                      <option value="cita">Citas</option>
                    </select>
                  </label>
                </div>

                <label style={styles.labelWrap}>
                  <span style={styles.label}>Categoría</span>
                  <select style={styles.input} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="todas">Todas</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </label>

                <div style={{ display: "grid", gap: 8 }}>
                  <button style={styles.secondaryButton} onClick={seedExampleData}>Cargar ejemplo</button>
                  <button style={styles.secondaryButton} onClick={() => downloadJson(db)}>Exportar copia JSON</button>
                  <button style={styles.secondaryButton} onClick={() => fileInputRef.current?.click()}>Importar copia JSON</button>
                  <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={importJson} />
                </div>

                <div style={styles.tipBox}>
                  Al marcar una tarea o cita como hecha, solo se completa en ese día concreto aunque sea recurrente.
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <SectionCard
              title={formatDateES(selectedDate)}
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={styles.secondaryButton} onClick={() => (viewMode === "mes" ? moveMonth(-1) : changeSelectedDate(viewMode === "semana" ? -7 : -1))}>◀</button>
                  <button style={styles.secondaryButton} onClick={() => setSelectedDate(getToday())}>Hoy</button>
                  <button style={styles.secondaryButton} onClick={() => (viewMode === "mes" ? moveMonth(1) : changeSelectedDate(viewMode === "semana" ? 7 : 1))}>▶</button>
                </div>
              }
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge>Mostrando: {viewMode}</Badge>
                <Badge soft>Pendientes: {summary.pending}</Badge>
                <Badge soft>Hechas: {summary.completed}</Badge>
              </div>

              {summary.pending > 0 && viewMode === "dia" && (
                <div style={styles.pendingAlert}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Tienes cosas pendientes hoy</div>
                  <div style={{ fontSize: 14 }}>
                    Te quedan <strong>{summary.pending}</strong> {summary.pending === 1 ? "elemento pendiente" : "elementos pendientes"} para completar en esta fecha.
                  </div>
                </div>
              )}

              {summary.pending === 0 && summary.total > 0 && viewMode === "dia" && (
                <div style={styles.doneAlert}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Todo al día</div>
                  <div style={{ fontSize: 14 }}>Has completado todos los elementos de esta fecha.</div>
                </div>
              )}

              {viewMode === "dia" && (
                <div style={{ display: "grid", gap: 12 }}>
                  {filteredDayItems.length === 0 && <div style={styles.emptyBox}>No hay elementos para este día con los filtros actuales.</div>}
                  {filteredDayItems.map((item) => {
                    const color = categoryColors[item.categoria] || categoryColors.general;
                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.itemRow,
                          opacity: item.completed ? 0.65 : 1,
                          background: color.soft,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        <input type="checkbox" checked={item.completed} onChange={() => toggleCompletion(item.id)} style={{ width: 18, height: 18, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 700, textDecoration: item.completed ? "line-through" : "none" }}>{item.titulo}</div>
                              {item.descripcion && <div style={{ color: "#64748b", textDecoration: item.completed ? "line-through" : "none" }}>{item.descripcion}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Badge>{item.tipo}</Badge>
                              <Badge category={item.categoria}>{item.categoria}</Badge>
                              <Badge soft>{item.prioridad}</Badge>
                            </div>
                          </div>
                          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
                            <span>Hora: {item.hora}</span>
                            <span>Repetición: {recurrenceText(item)}</span>
                            <span>Inicio: {formatDateES(item.fecha, "short")}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button style={styles.secondaryButton} onClick={() => editItem(item)}>Editar</button>
                          <button style={styles.dangerButton} onClick={() => deleteItem(item.id)}>Borrar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === "semana" && (
                <div style={styles.weekGrid}>
                  {weekDates.map((date) => {
                    const items = getItemsForDate(date);
                    return (
                      <div key={date} style={{ ...styles.weekCell, border: date === selectedDate ? "2px solid #94a3b8" : "1px solid #dbe2ea" }}>
                        <button style={styles.cellHeaderBtn} onClick={() => setSelectedDate(date)}>
                          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase" }}>
                            {new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(new Date(date + "T12:00:00"))}
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 800 }}>{new Date(date + "T12:00:00").getDate()}</div>
                        </button>
                        <div style={{ display: "grid", gap: 8 }}>
                          {items.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>Sin elementos</div>}
                          {items.slice(0, 6).map((item) => {
                            const color = categoryColors[item.categoria] || categoryColors.general;
                            return (
                              <div
                                key={`${item.id}-${date}`}
                                style={{
                                  ...styles.miniItem,
                                  background: color.bg,
                                  color: color.text,
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>{item.hora} · {item.titulo}</div>
                                <div style={{ color: color.text, opacity: 0.8, fontSize: 12 }}>{item.categoria}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === "mes" && (
                <div>
                  <div style={styles.monthHeader}>
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d}>{d}</div>)}
                  </div>
                  <div style={styles.monthGrid}>
                    {monthGrid.map((cell) => {
                      const items = getItemsForDate(cell.date);
                      return (
                        <button
                          key={cell.date}
                          onClick={() => {
                            setSelectedDate(cell.date);
                            setViewMode("dia");
                          }}
                          style={{
                            ...styles.monthCell,
                            background: cell.currentMonth ? "white" : "#f1f5f9",
                            border: cell.date === selectedDate ? "2px solid #94a3b8" : "1px solid #dbe2ea",
                            color: cell.currentMonth ? "#0f172a" : "#94a3b8",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700 }}>{cell.day}</span>
                            {items.length > 0 && <Badge>{items.length}</Badge>}
                          </div>
                          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                            {items.slice(0, 2).map((item) => {
                              const color = categoryColors[item.categoria] || categoryColors.general;
                              return (
                                <div
                                  key={`${cell.date}-${item.id}`}
                                  style={{
                                    ...styles.miniItem,
                                    background: color.bg,
                                    color: color.text,
                                  }}
                                >
                                  {item.hora} {item.titulo}
                                </div>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 16,
    color: "#0f172a",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  container: { maxWidth: 1300, margin: "0 auto", display: "grid", gap: 16 },
  mainTitle: { margin: 0, fontSize: 36, fontWeight: 900 },
  subtitle: { margin: 0, color: "#64748b" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  mainGrid: { display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 },
  card: {
    background: "white",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  labelWrap: { display: "grid", gap: 6 },
  label: { fontSize: 13, color: "#334155", fontWeight: 600 },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, width: "100%", boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  primaryButton: { background: "#0f172a", color: "white", border: 0, borderRadius: 14, padding: "12px 16px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { background: "white", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 16px", fontWeight: 700, cursor: "pointer" },
  dangerButton: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 14, padding: "12px 16px", fontWeight: 700, cursor: "pointer" },
  smallButton: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontWeight: 700 },
  tipBox: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 18, padding: 14, fontSize: 13 },
  pendingAlert: { background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 18, padding: 14, marginBottom: 14 },
  doneAlert: { background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 18, padding: 14, marginBottom: 14 },
  emptyBox: { border: "1px dashed #cbd5e1", borderRadius: 20, padding: 28, textAlign: "center", color: "#64748b" },
  itemRow: { display: "flex", gap: 14, alignItems: "flex-start", borderRadius: 20, padding: 16, flexWrap: "wrap" },
  weekGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 },
  weekCell: { borderRadius: 20, padding: 12, background: "white", minHeight: 180 },
  cellHeaderBtn: { width: "100%", textAlign: "left", background: "transparent", border: 0, padding: 0, marginBottom: 10, cursor: "pointer", color: "inherit" },
  miniItem: { borderRadius: 12, padding: "8px 10px", fontSize: 12, textAlign: "left" },
  monthHeader: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8, textAlign: "center", fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 },
  monthCell: { minHeight: 110, borderRadius: 16, padding: 10, textAlign: "left", cursor: "pointer" },
};
