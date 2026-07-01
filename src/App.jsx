import React, { useState, useEffect, useMemo } from "react";
import { Plus, User, TrendingUp, CalendarDays, Search, Trash2, X, Check, Wallet, ArrowLeft, Sparkles, Wheat } from "lucide-react";
import { getClientes, getMovs, addMov as addMovDb, delMov as delMovDb, subscribeChanges } from "./supabaseClient";

// ── Re Pan brand ──
const PLUM = "#B5277E";      // magenta gorro / borde inferior
const ROSE = "#C44D8E";      // rosa fondo del círculo
const ROSE_DK = "#9E2270";   // rosa oscuro
const GOLD = "#E8A33D";      // dorado del trigo
const CREAM = "#FDF6F9";     // fondo claro
const INK = "#2A1620";       // texto oscuro
const MUTED = "#9C7C8C";

const PAGOS = ["Efectivo", "Mercado Pago", "Transferencia", "Fiado"];

const CLIENTES_INICIALES = [
  "VIVIANA", "PATO", "SILVIO", "CARMEN", "SANDRA", "GILLE", "SAAVEDRA", "COCO",
  "SUIPACHA", "GABI", "M. PAZ", "JULIO", "SILVIO (2)", "G. SPANO", "DOMI", "ALICIA",
  "MIGUEL", "D. JAMO", "PELADO", "ANA", "MIRTHA", "JACIN", "CENTENARIO", "BERNALERA",
  "LUZURIAGA", "ALE", "S. CARLO", "S. LUIS", "GISELA", "MAS RICA", "JUANI", "FIAMBRERÍA",
  "CHINO", "CABALLITO", "CINI", "ROXANA", "LUJAN", "BETHOVEEN",
];
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => (n || 0).toLocaleString("es-AR");
const monthKey = (d) => d.slice(0, 7);
// clave de semana ISO (año-Wnn) para agrupar por semana
const weekKey = (dstr) => {
  const d = new Date(dstr + "T00:00:00");
  const t = new Date(d);
  t.setDate(t.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  const n = 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-S${String(n).padStart(2, "0")}`;
};
const fechaCorta = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

// ── Parser de lenguaje natural ──
function parseEntry(text, clientes) {
  const raw = text.trim();
  if (!raw) return null;
  const low = raw.toLowerCase();

  let pago = "Efectivo";
  if (/(fiado|debe|anota|despu[eé]s\s+paga)/.test(low)) pago = "Fiado";
  else if (/(mercado\s*pago|mercadopago|\bmp\b|m\.?p\.?)/.test(low)) pago = "Mercado Pago";
  else if (/(transfer|transferencia|cbu|alias)/.test(low)) pago = "Transferencia";
  else if (/(efectivo|cash|plata)/.test(low)) pago = "Efectivo";

  let kilos = null;
  const km = low.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|k\b)/);
  if (km) kilos = parseFloat(km[1].replace(",", "."));

  let monto = null;
  const mm = low.match(/\$?\s*(\d{3,}(?:[.,]\d{3})*)/g);
  if (mm) {
    const cand = mm.map((s) => parseInt(s.replace(/[$.\s]/g, ""), 10)).filter((n) => n >= 100);
    monto = cand.length ? Math.max(...cand) : null;
  }

  let cliente = "";
  const known = clientes.find((c) => low.includes(c.toLowerCase()));
  if (known) cliente = known;
  else {
    const head = raw.split(/[,\d]/)[0].trim();
    cliente = head.replace(/\b(pag[oó]|fiado|kilos?|kg)\b/gi, "").trim();
    cliente = cliente.split(" ").slice(0, 2).join(" ");
  }
  if (cliente) cliente = cliente.charAt(0).toUpperCase() + cliente.slice(1);

  return { cliente, kilos, pago, monto, fecha: today() };
}

export default function App() {
  const [clientes, setClientes] = useState([]);
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("inicio");
  const [activeCliente, setActiveCliente] = useState(null);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState("");
  const [preview, setPreview] = useState(null);
  const [periodo, setPeriodo] = useState("diario"); // diario | semanal | mensual

  // Carga clientes y movimientos desde Supabase.
  const loadAll = async () => {
    try {
      const [cs, ms] = await Promise.all([getClientes(), getMovs()]);
      setClientes(cs);
      setMovs(ms);
    } catch (e) {}
  };

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
    // Realtime: refresca solo cuando el bot u otro dispositivo cargan una venta.
    const unsub = subscribeChanges(loadAll);
    return unsub;
  }, []);

  const addMov = async (mov) => {
    try {
      await addMovDb(mov); // crea el cliente si es nuevo e inserta la venta
      await loadAll();
    } catch (e) {}
  };

  const delMov = async (id) => {
    try {
      await delMovDb(id);
      await loadAll();
    } catch (e) {}
  };

  const handleQuick = () => { const p = parseEntry(quick, clientes); if (p && p.cliente) setPreview(p); };
  const confirmPreview = async () => { await addMov(preview); setPreview(null); setQuick(""); };

  const thisMonth = monthKey(today());
  const monthMovs = useMemo(() => movs.filter((m) => monthKey(m.fecha) === thisMonth), [movs, thisMonth]);
  const totalCobrado = monthMovs.filter((m) => m.pago !== "Fiado").reduce((s, m) => s + (m.monto || 0), 0);
  const totalFiado = monthMovs.filter((m) => m.pago === "Fiado").reduce((s, m) => s + (m.monto || 0), 0);
  const totalKilos = monthMovs.reduce((s, m) => s + (m.kilos || 0), 0);

  const clienteMovs = (name) => movs.filter((m) => m.cliente === name);
  const clienteSaldo = (name) => clienteMovs(name).filter((m) => m.pago === "Fiado").reduce((s, m) => s + (m.monto || 0), 0);
  const filtered = clientes.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  const monthByCliente = useMemo(() => {
    const map = {};
    monthMovs.forEach((m) => {
      if (!map[m.cliente]) map[m.cliente] = { cobrado: 0, fiado: 0, kilos: 0, ops: 0 };
      map[m.cliente].ops++;
      map[m.cliente].kilos += m.kilos || 0;
      if (m.pago === "Fiado") map[m.cliente].fiado += m.monto || 0;
      else map[m.cliente].cobrado += m.monto || 0;
    });
    return Object.entries(map).sort((a, b) => (b[1].cobrado + b[1].fiado) - (a[1].cobrado + a[1].fiado));
  }, [monthMovs]);

  if (loading) return (
    <div style={{ background: CREAM, minHeight: "100vh", display: "grid", placeItems: "center", color: PLUM, fontFamily: "system-ui" }}>Cargando…</div>
  );

  return (
    <div style={{ background: CREAM, minHeight: "100vh", color: INK, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        .card { background:#fff; border:1px solid #F0DCE8; border-radius:16px; box-shadow:0 1px 3px rgba(181,39,126,.06); }
        .btn { cursor:pointer; border:none; font-weight:600; transition:.15s; }
        .btn:active { transform:scale(.97); }
        input, select { font-family:inherit; }
        .row:hover { background:#FDF2F8; }
        @media (max-width:560px){ .stats{ grid-template-columns:1fr 1fr !important; } }
      `}</style>

      {/* Header */}
      <header style={{ padding: "16px 20px", background: `linear-gradient(135deg, ${ROSE} 0%, ${ROSE_DK} 100%)`, display: "flex", alignItems: "center", gap: 12, boxShadow: `0 2px 10px rgba(158,34,112,.25)` }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", border: `3px solid ${GOLD}` }}>
          <Wheat size={20} color={PLUM} />
        </div>
        <div>
          <div style={{ fontWeight: 800, letterSpacing: .3, color: "#fff", fontSize: 18 }}>Re Pan <span style={{ fontWeight: 400, fontSize: 12, opacity: .85 }}>· Pan Premium</span></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)" }}>Registro diario · {new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Tab label="Inicio" active={view === "inicio"} onClick={() => setView("inicio")} />
          <Tab label="Clientes" active={view === "clientes" || view === "cliente"} onClick={() => setView("clientes")} />
          <Tab label="Cierre mes" active={view === "mes"} onClick={() => setView("mes")} />
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
        {view === "inicio" && (
          <>
            <div className="card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Sparkles size={16} color={GOLD} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Carga rápida</span>
                <span style={{ fontSize: 11, color: MUTED }}>escribí como hablás</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuick()}
                  placeholder='Ej: María, 2 kilos, pagó Mercado Pago 8500'
                  style={{ flex: 1, background: CREAM, border: `1px solid #E9C9DD`, borderRadius: 10, padding: "12px 14px", color: INK, fontSize: 15, outline: "none" }} />
                <button className="btn" onClick={handleQuick} style={{ background: PLUM, color: "#fff", borderRadius: 10, padding: "0 18px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={18} /> Cargar
                </button>
              </div>

              {preview && (
                <div style={{ marginTop: 14, background: CREAM, borderRadius: 12, padding: 14, border: `1px solid ${PLUM}55` }}>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Revisá antes de confirmar:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <Field label="Cliente" value={preview.cliente} onChange={(v) => setPreview({ ...preview, cliente: v })} />
                    <Field label="Kilos" value={preview.kilos ?? ""} type="number" onChange={(v) => setPreview({ ...preview, kilos: v ? parseFloat(v) : null })} w={70} />
                    <Field label="Monto $" value={preview.monto ?? ""} type="number" onChange={(v) => setPreview({ ...preview, monto: v ? parseInt(v) : null })} w={100} />
                    <SelectField label="Pago" value={preview.pago} onChange={(v) => setPreview({ ...preview, pago: v })} />
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button className="btn" onClick={() => setPreview(null)} style={{ background: "transparent", color: MUTED, padding: 8 }}><X size={18} /></button>
                      <button className="btn" onClick={confirmPreview} style={{ background: PLUM, color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", gap: 6, alignItems: "center" }}><Check size={16} /> Confirmar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              <Stat icon={<Wallet size={16} />} label="Cobrado (mes)" value={`$${fmt(totalCobrado)}`} hl />
              <Stat icon={<TrendingUp size={16} />} label="Fiado pendiente" value={`$${fmt(totalFiado)}`} />
              <Stat icon={<CalendarDays size={16} />} label="Operaciones" value={monthMovs.length} />
              <Stat icon={<Wheat size={16} />} label="Kilos vendidos" value={fmt(totalKilos)} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, margin: 0, color: PLUM }}>Clientes</h2>
              <div style={{ marginLeft: "auto", position: "relative" }}>
                <Search size={15} color={MUTED} style={{ position: "absolute", left: 10, top: 9 }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar"
                  style={{ background: "#fff", border: `1px solid #E9C9DD`, borderRadius: 8, padding: "7px 10px 7px 30px", color: INK, fontSize: 13, outline: "none", width: 160 }} />
              </div>
            </div>

            {clientes.length === 0 ? (
              <div className="card" style={{ padding: 30, textAlign: "center", color: MUTED }}>
                Todavía no hay clientes. Cargá tu primera venta arriba y se crean solos.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
                {filtered.map((c) => {
                  const saldo = clienteSaldo(c);
                  return (
                    <button key={c} className="btn card" onClick={() => { setActiveCliente(c); setView("cliente"); }} style={{ padding: 14, textAlign: "left", color: INK }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{c}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{clienteMovs(c).length} movimientos</div>
                      {saldo > 0 && <div style={{ fontSize: 12, color: PLUM, marginTop: 4, fontWeight: 600 }}>Debe ${fmt(saldo)}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "cliente" && activeCliente && (
          <>
            <button className="btn" onClick={() => setView("clientes")} style={{ background: "transparent", color: MUTED, display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: 0 }}>
              <ArrowLeft size={16} /> Volver a clientes
            </button>
            <div className="card" style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${ROSE}, ${PLUM})`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 22, border: `3px solid ${GOLD}` }}>
                {activeCliente[0]}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{activeCliente}</div>
                <div style={{ fontSize: 13, color: MUTED }}>{clienteMovs(activeCliente).length} movimientos en total</div>
              </div>
              {clienteSaldo(activeCliente) > 0 && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: MUTED }}>Saldo fiado</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: PLUM }}>${fmt(clienteSaldo(activeCliente))}</div>
                </div>
              )}
            </div>

            {/* selector de periodo */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "#fff", padding: 5, borderRadius: 12, border: "1px solid #F0DCE8", width: "fit-content" }}>
              {[["diario", "Diario"], ["semanal", "Semanal"], ["mensual", "Mensual"]].map(([k, lbl]) => (
                <button key={k} className="btn" onClick={() => setPeriodo(k)}
                  style={{ background: periodo === k ? PLUM : "transparent", color: periodo === k ? "#fff" : MUTED, borderRadius: 8, padding: "7px 16px", fontSize: 13 }}>{lbl}</button>
              ))}
            </div>

            <ClienteRegistro movimientos={clienteMovs(activeCliente)} periodo={periodo} onDel={delMov} />
          </>
        )}

        {view === "clientes" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, margin: 0, color: PLUM }}>Todos los clientes</h2>
              <span style={{ fontSize: 13, color: MUTED }}>{clientes.length} en total</span>
              <div style={{ marginLeft: "auto", position: "relative" }}>
                <Search size={15} color={MUTED} style={{ position: "absolute", left: 10, top: 9 }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar"
                  style={{ background: "#fff", border: `1px solid #E9C9DD`, borderRadius: 8, padding: "7px 10px 7px 30px", color: INK, fontSize: 13, outline: "none", width: 180 }} />
              </div>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {filtered.map((c, i) => {
                const saldo = clienteSaldo(c);
                const nMovs = clienteMovs(c).length;
                return (
                  <button key={c} className="btn row" onClick={() => { setActiveCliente(c); setPeriodo("diario"); setView("cliente"); }}
                    style={{ width: "100%", background: "transparent", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #F7E8F1" : "none", textAlign: "left", color: INK }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${ROSE}, ${PLUM})`, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{c[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{c}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{nMovs} movimiento{nMovs === 1 ? "" : "s"}</div>
                    </div>
                    {saldo > 0 && <div style={{ fontSize: 13, color: PLUM, fontWeight: 700 }}>Debe ${fmt(saldo)}</div>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view === "mes" && (
          <>
            <h2 style={{ fontSize: 20, marginTop: 0, color: PLUM }}>Cierre de {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</h2>
            <div className="stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              <Stat label="Total cobrado" value={`$${fmt(totalCobrado)}`} hl />
              <Stat label="Total fiado" value={`$${fmt(totalFiado)}`} />
              <Stat label="Operaciones" value={monthMovs.length} />
              <Stat label="Kilos" value={fmt(totalKilos)} />
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid #F0DCE8`, fontWeight: 700, fontSize: 14, color: PLUM }}>Por cliente</div>
              <div style={{ display: "flex", padding: "8px 16px", fontSize: 11, color: MUTED, borderBottom: `1px solid #F7E8F1` }}>
                <div style={{ flex: 1 }}>Cliente</div>
                <div style={{ width: 70, textAlign: "right" }}>Kg</div>
                <div style={{ width: 100, textAlign: "right" }}>Cobrado</div>
                <div style={{ width: 100, textAlign: "right" }}>Fiado</div>
              </div>
              {monthByCliente.length === 0 && <div style={{ padding: 20, color: MUTED, fontSize: 13 }}>Sin movimientos este mes.</div>}
              {monthByCliente.map(([name, d]) => (
                <div key={name} className="row" style={{ display: "flex", padding: "11px 16px", fontSize: 14, borderBottom: `1px solid #F7E8F1` }}>
                  <div style={{ flex: 1, fontWeight: 600 }}>{name}</div>
                  <div style={{ width: 70, textAlign: "right", color: MUTED }}>{fmt(d.kilos)}</div>
                  <div style={{ width: 100, textAlign: "right", fontWeight: 600 }}>${fmt(d.cobrado)}</div>
                  <div style={{ width: 100, textAlign: "right", color: d.fiado ? PLUM : MUTED }}>{d.fiado ? `$${fmt(d.fiado)}` : "—"}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ClienteRegistro({ movimientos, periodo, onDel }) {
  const grupos = useMemo(() => {
    const keyFn = periodo === "diario" ? (m) => m.fecha : periodo === "semanal" ? (m) => weekKey(m.fecha) : (m) => monthKey(m.fecha);
    const map = {};
    movimientos.forEach((m) => {
      const k = keyFn(m);
      if (!map[k]) map[k] = { movs: [], cobrado: 0, fiado: 0, kilos: 0 };
      map[k].movs.push(m);
      map[k].kilos += m.kilos || 0;
      if (m.pago === "Fiado") map[k].fiado += m.monto || 0;
      else map[k].cobrado += m.monto || 0;
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [movimientos, periodo]);

  const etiqueta = (k) => {
    if (periodo === "diario") return new Date(k + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    if (periodo === "mensual") return new Date(k + "-01T00:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const [y, s] = k.split("-S");
    return `Semana ${parseInt(s)} · ${y}`;
  };

  if (movimientos.length === 0)
    return <div className="card" style={{ padding: 24, color: MUTED, fontSize: 14, textAlign: "center" }}>Sin movimientos todavía.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {grupos.map(([k, g]) => (
        <div key={k} className="card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#FDF2F8", borderBottom: "1px solid #F0DCE8" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: PLUM, textTransform: "capitalize" }}>{etiqueta(k)}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}>{fmt(g.kilos)} kg</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>${fmt(g.cobrado)}</span>
            {g.fiado > 0 && <span style={{ fontSize: 12, color: PLUM, fontWeight: 600 }}>fiado ${fmt(g.fiado)}</span>}
          </div>
          {g.movs.map((m) => (
            <div key={m.id} className="row" style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #F7E8F1" }}>
              <div style={{ fontSize: 12, color: MUTED, width: 52 }}>{fechaCorta(m.fecha)}</div>
              <div style={{ flex: 1, fontSize: 14 }}>
                {m.kilos ? `${m.kilos} kg` : "—"}
                <span style={{ marginLeft: 10, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: m.pago === "Fiado" ? `${PLUM}1A` : "#F4E4EE", color: m.pago === "Fiado" ? PLUM : MUTED }}>{m.pago}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.monto ? `$${fmt(m.monto)}` : "—"}</div>
              <button className="btn" onClick={() => onDel(m.id)} style={{ background: "transparent", color: MUTED, padding: 4 }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button className="btn" onClick={onClick} style={{ background: active ? "rgba(255,255,255,.25)" : "transparent", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, opacity: active ? 1 : .75 }}>{label}</button>
  );
}

function Stat({ icon, label, value, hl }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, marginBottom: 6 }}>{icon}{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: hl ? PLUM : INK }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", w = 130 }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: w, background: "#fff", border: `1px solid #E9C9DD`, borderRadius: 7, padding: "6px 9px", color: INK, fontSize: 13, outline: "none" }} />
    </div>
  );
}

function SelectField({ label, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: "#fff", border: `1px solid #E9C9DD`, borderRadius: 7, padding: "6px 9px", color: INK, fontSize: 13, outline: "none" }}>
        {PAGOS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}
