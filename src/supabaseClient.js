// ════════════════════════════════════════════════════════════
// Re Pan CRM — Cliente Supabase (app web)
// Las claves ya están cargadas. La "anon/publishable" es pública por diseño.
// ════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bmnumkywnhsffzsevujx.supabase.co";
const SUPABASE_KEY = "sb_publishable_iEQ_K14FNOvn407_FBpcYA_GtiR4oFZ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Devuelve la lista de nombres de clientes (ordenada).
export async function getClientes() {
  const { data, error } = await supabase
    .from("clientes")
    .select("nombre")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data.map((r) => r.nombre);
}

// Crea el cliente si no existe (no falla si ya está).
export async function ensureCliente(nombre) {
  if (!nombre) return;
  const { error } = await supabase
    .from("clientes")
    .upsert({ nombre }, { onConflict: "nombre", ignoreDuplicates: true });
  if (error) throw error;
}

// Devuelve todos los movimientos, el más nuevo primero.
export async function getMovs() {
  const { data, error } = await supabase
    .from("movimientos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    ...r,
    kilos: r.kilos == null ? null : Number(r.kilos),
    monto: r.monto == null ? null : Number(r.monto),
  }));
}

// Inserta una venta. Crea el cliente si es nuevo. Devuelve la fila creada.
export async function addMov(mov) {
  await ensureCliente(mov.cliente);
  const { data, error } = await supabase
    .from("movimientos")
    .insert({
      cliente: mov.cliente,
      kilos: mov.kilos,
      pago: mov.pago,
      monto: mov.monto,
      fecha: mov.fecha,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Borra un movimiento por id.
export async function delMov(id) {
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  if (error) throw error;
}

// Se suscribe a los cambios para refrescar en vivo. Devuelve función para cortar.
export function subscribeChanges(onChange) {
  const ch = supabase
    .channel("repan-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}
