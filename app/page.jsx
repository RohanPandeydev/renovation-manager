"use client";
import { useEffect, useMemo, useState } from "react";
import seedData from "./data.json";

const KEY = "renovationWages";
const DATA_VERSION = seedData.version || 1;

// Deep-clone that works in every browser (avoids structuredClone, which
// older mobile / in-app browsers don't support). Our data is plain JSON.
const clone = (o) => JSON.parse(JSON.stringify(o));
const money = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1];
  return `${+d} ${mo}`;
};

// ---------------- seed ----------------
// Canonical data lives in ./data.json. `seed()` returns a fresh copy of it.
function seed() {
  return clone(seedData);
}

// Load saved data from the browser, but if data.json has a newer `version`
// (i.e. it was updated & redeployed), take the fresh file data instead.
function loadDb() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.workers && (s.version || 0) >= DATA_VERSION) {
      s.materials = s.materials || [];
      s.rooms = s.rooms || [];
      return s;
    }
  } catch (e) {}
  return seed();
}

export default function Page() {
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState("dash");
  const [attDate, setAttDate] = useState(todayISO());
  const [modal, setModal] = useState(null); // {kind, id}

  useEffect(() => { setDb(loadDb()); }, []);
  useEffect(() => {
    if (!db) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private/blocked storage — ignore */ }
  }, [db]);

  // Must run before any early return so hook order stays stable across renders.
  const payers = useMemo(() => {
    const set = new Set(["Me"]);
    if (db) {
      db.payments.forEach((p) => p.paidBy && set.add(p.paidBy));
      db.materials.forEach((m) => m.paidBy && set.add(m.paidBy));
    }
    return Array.from(set);
  }, [db]);

  if (!db) return <div className="wrap"><div className="empty">Loading…</div></div>;

  // ---------- derived helpers ----------
  const workerById = (id) => db.workers.find((w) => w.id === id);
  const roomById = (id) => db.rooms.find((r) => r.id === id);
  const earnedFor = (wid) => db.attendance.filter((a) => a.workerId === wid)
    .reduce((s, a) => s + (workerById(a.workerId)?.rate || 0) * (a.portion || 1), 0);
  const paidFor = (wid) => db.payments.filter((p) => p.workerId === wid).reduce((s, p) => s + (+p.amount || 0), 0);
  const daysFor = (wid) => db.attendance.filter((a) => a.workerId === wid).reduce((s, a) => s + (a.portion || 1), 0);
  const balanceFor = (wid) => earnedFor(wid) - paidFor(wid);
  const materialsTotal = () => db.materials.reduce((s, m) => s + (+m.amount || 0), 0);
  const materialsForRoom = (rid) => db.materials.filter((m) => m.roomId === rid).reduce((s, m) => s + (+m.amount || 0), 0);

  // ---------- mutations ----------
  const update = (fn) => setDb((d) => { const n = clone(d); fn(n); return n; });

  const toggleAtt = (wid, kind) => update((n) => {
    const i = n.attendance.findIndex((a) => a.date === attDate && a.workerId === wid);
    const want = kind === "half" ? 0.5 : 1;
    if (i >= 0 && n.attendance[i].portion === want) n.attendance.splice(i, 1);
    else if (i >= 0) n.attendance[i].portion = want;
    else n.attendance.push({ id: uid(), date: attDate, workerId: wid, portion: want });
  });

  const saveWorker = (data, id) => update((n) => {
    if (id) Object.assign(n.workers.find((w) => w.id === id), data);
    else n.workers.push({ id: uid(), ...data });
  });
  const delWorker = (id) => {
    if (!confirm("Delete this worker? Their attendance & payments will also be removed.")) return;
    update((n) => {
      n.workers = n.workers.filter((w) => w.id !== id);
      n.attendance = n.attendance.filter((a) => a.workerId !== id);
      n.payments = n.payments.filter((p) => p.workerId !== id);
    });
  };
  const savePay = (data, id) => update((n) => {
    if (id) Object.assign(n.payments.find((p) => p.id === id), data);
    else n.payments.push({ id: uid(), ...data });
  });
  const delPay = (id) => { if (confirm("Delete this payment?")) update((n) => { n.payments = n.payments.filter((p) => p.id !== id); }); };
  const saveMat = (data, id) => update((n) => {
    if (id) Object.assign(n.materials.find((m) => m.id === id), data);
    else n.materials.push({ id: uid(), ...data });
  });
  const delMat = (id) => { if (confirm("Delete this material entry?")) update((n) => { n.materials = n.materials.filter((m) => m.id !== id); }); };
  const saveRoom = (data, id) => update((n) => {
    if (id) Object.assign(n.rooms.find((r) => r.id === id), data);
    else n.rooms.push({ id: uid(), ...data });
  });
  const delRoom = (id) => {
    if (!confirm("Delete this room? Materials stay but become unassigned.")) return;
    update((n) => { n.rooms = n.rooms.filter((r) => r.id !== id); n.materials.forEach((m) => { if (m.roomId === id) m.roomId = ""; }); });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "renovation-backup.json"; a.click();
  };
  const importData = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const s = JSON.parse(r.result); if (!s.workers) throw 0; s.materials = s.materials || []; s.rooms = s.rooms || []; setDb(s); alert("Backup restored."); } catch { alert("Not a valid backup file."); } };
    r.readAsText(f);
  };
  const resetAll = () => { if (confirm("Reset all data back to the starting renovation data?")) { localStorage.removeItem(KEY); setDb(seed()); } };

  const openModal = (kind, id) => setModal({ kind, id });
  const closeModal = () => setModal(null);

  const TABS = [
    ["dash", "Dashboard"], ["att", "Attendance"], ["pay", "Payments"],
    ["material", "Materials"], ["rooms", "Rooms"], ["workers", "Workers"], ["history", "History"],
  ];

  return (
    <>
      <header className="appheader">
        <h1>🏠 Renovation Manager</h1>
        <div className="sub">Attendance · Wages · Advances · Materials · Room budgets</div>
      </header>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <div key={k} className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      <div className="wrap">
        {tab === "dash" && <Dashboard {...{ db, workerById, earnedFor, paidFor, daysFor, balanceFor, materialsTotal, openModal, setTab }} />}
        {tab === "att" && <Attendance {...{ db, attDate, setAttDate, toggleAtt, workerById }} />}
        {tab === "pay" && <Payments {...{ db, workerById, openModal, delPay }} />}
        {tab === "material" && <Materials {...{ db, roomById, materialsTotal, openModal, delMat }} />}
        {tab === "rooms" && <Rooms {...{ db, materialsForRoom, openModal, delRoom }} />}
        {tab === "workers" && <Workers {...{ db, openModal, delWorker, exportData, importData, resetAll }} />}
        {tab === "history" && <History {...{ db, workerById }} />}
      </div>

      {modal && (
        <div className="modal-bg" onClick={(e) => { if (e.target.classList.contains("modal-bg")) closeModal(); }}>
          <div className="modal">
            {modal.kind === "worker" && <WorkerForm initial={modal.id ? workerById(modal.id) : null} onSave={(d) => { saveWorker(d, modal.id); closeModal(); }} onCancel={closeModal} />}
            {modal.kind === "pay" && <PaymentForm workers={db.workers} payers={payers} balanceFor={balanceFor} initial={modal.id ? db.payments.find((p) => p.id === modal.id) : null} onSave={(d) => { savePay(d, modal.id); closeModal(); }} onCancel={closeModal} />}
            {modal.kind === "mat" && <MaterialForm rooms={db.rooms} payers={payers} initial={modal.id ? db.materials.find((m) => m.id === modal.id) : null} onSave={(d) => { saveMat(d, modal.id); closeModal(); }} onCancel={closeModal} />}
            {modal.kind === "room" && <RoomForm initial={modal.id ? roomById(modal.id) : null} onSave={(d) => { saveRoom(d, modal.id); closeModal(); }} onCancel={closeModal} />}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------- Dashboard ----------------
function Dashboard({ db, workerById, earnedFor, paidFor, daysFor, balanceFor, materialsTotal, openModal, setTab }) {
  const totalEarned = db.workers.reduce((s, w) => s + earnedFor(w.id), 0);
  const totalPaid = db.workers.reduce((s, w) => s + paidFor(w.id), 0);
  const pending = db.workers.reduce((s, w) => s + Math.max(0, balanceFor(w.id)), 0);
  const advance = db.workers.reduce((s, w) => s + Math.max(0, -balanceFor(w.id)), 0);
  const matTotal = materialsTotal();
  const grandSpent = totalPaid + matTotal;

  // who paid (settlement)
  const byPayer = {};
  db.payments.forEach((p) => { byPayer[p.paidBy || "Me"] = (byPayer[p.paidBy || "Me"] || 0) + (+p.amount || 0); });
  db.materials.forEach((m) => { byPayer[m.paidBy || "Me"] = (byPayer[m.paidBy || "Me"] || 0) + (+m.amount || 0); });
  const payerRows = Object.entries(byPayer).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="card" style={{ background: "linear-gradient(135deg,#1c2b24,#182430)" }}>
        <div className="k muted small">TOTAL SPENT SO FAR (wages paid + materials)</div>
        <div className="big" style={{ fontSize: 28 }}>{money(grandSpent)}</div>
        <div className="small muted">{money(totalPaid)} labour · {money(matTotal)} materials · {money(pending)} still to pay</div>
      </div>

      <div className="grid">
        <div className="stat"><div className="k">Total wages earned</div><div className="v">{money(totalEarned)}</div></div>
        <div className="stat"><div className="k">Wages paid</div><div className="v">{money(totalPaid)}</div></div>
        <div className="stat"><div className="k">Pending (you owe)</div><div className="v pos">{money(pending)}</div></div>
        <div className="stat"><div className="k">Advance given</div><div className="v neg">{money(advance)}</div></div>
        <div className="stat"><div className="k">Materials bought</div><div className="v">{money(matTotal)}</div></div>
        <div className="stat"><div className="k">Grand total cost</div><div className="v">{money(grandSpent + pending)}</div></div>
      </div>

      <div className="card">
        <h2>Per worker balance</h2>
        {!db.workers.length && <div className="empty">No workers yet.</div>}
        {db.workers.map((w) => {
          const bal = balanceFor(w.id), e = earnedFor(w.id), p = paidFor(w.id), d = daysFor(w.id);
          const cls = bal > 0 ? "pos" : bal < 0 ? "neg" : "zero";
          const lbl = bal > 0 ? "pending" : bal < 0 ? "advance" : "settled";
          return (
            <div className="worker-item" key={w.id}>
              <div className="flex" style={{ alignItems: "center" }}>
                <div className="avatar">{w.name[0] || "?"}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{w.name}</div>
                  <div className="small muted">{d} day{d === 1 ? "" : "s"} · {money(w.rate)}/day · earned {money(e)} · paid {money(p)}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={"big " + cls}>{money(Math.abs(bal))}</div>
                <div className={"small " + cls}>{lbl}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Who paid (settlement)</h2>
        <div className="small muted" style={{ marginBottom: 10 }}>Total money spent by each person on labour + materials — useful when more than one person is paying.</div>
        {payerRows.map(([name, amt]) => (
          <div className="row" key={name} style={{ padding: "6px 0" }}>
            <span>{name}</span><b>{money(amt)}</b>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn primary" onClick={() => openModal("pay")}>+ Pay a worker</button>
        <button className="btn" onClick={() => setTab("att")}>Mark attendance</button>
        <button className="btn" onClick={() => openModal("mat")}>+ Add material</button>
      </div>
    </>
  );
}

// ---------------- Attendance ----------------
function Attendance({ db, attDate, setAttDate, toggleAtt, workerById }) {
  const present = db.attendance.filter((a) => a.date === attDate);
  const dayTotal = present.reduce((s, a) => s + (workerById(a.workerId)?.rate || 0) * (a.portion || 1), 0);
  return (
    <div className="card">
      <h2>Attendance</h2>
      <div className="datepick">
        <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
        <button className="btn small" onClick={() => setAttDate(todayISO())}>Today</button>
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>Tap Full or ½ for each worker. Tap again to remove.</div>
      {!db.workers.length && <div className="empty">Add workers first (Workers tab).</div>}
      {db.workers.map((w) => {
        const rec = db.attendance.find((a) => a.date === attDate && a.workerId === w.id);
        const status = rec ? (rec.portion === 0.5 ? "half" : "full") : "none";
        const wage = status === "none" ? 0 : w.rate * (status === "half" ? 0.5 : 1);
        return (
          <div className="att-row" key={w.id}>
            <div className="avatar">{w.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{w.name}<span className="tag">{w.type}</span></div>
              <div className="small muted">{money(w.rate)}/day {status !== "none" ? "· today " + money(wage) : ""}</div>
            </div>
            <div className={"chip " + (status === "full" ? "on" : "")} onClick={() => toggleAtt(w.id, "full")}>Full</div>
            <div className={"chip half " + (status === "half" ? "on" : "")} onClick={() => toggleAtt(w.id, "half")}>½</div>
          </div>
        );
      })}
      <div className="divider" />
      <div className="row"><span className="muted">{present.length} present on {fmtDate(attDate)}</span><span className="big">{money(dayTotal)}</span></div>
    </div>
  );
}

// ---------------- Payments ----------------
function Payments({ db, workerById, openModal, delPay }) {
  const pays = [...db.payments].sort((a, b) => b.date.localeCompare(a.date));
  const grandTotal = pays.reduce((s, p) => s + (+p.amount || 0), 0);
  // group payments by date (newest first)
  const byDate = {};
  pays.forEach((p) => { (byDate[p.date] = byDate[p.date] || []).push(p); });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
  return (
    <>
      <div className="toolbar"><button className="btn primary" onClick={() => openModal("pay")}>+ Record payment / advance</button></div>
      <div className="card" style={{ background: "linear-gradient(135deg,#1c2530,#182430)" }}>
        <div className="k muted small">TOTAL PAID (all time)</div>
        <div className="big">{money(grandTotal)}</div>
        <div className="small muted">{pays.length} payment{pays.length === 1 ? "" : "s"} across {dates.length} day{dates.length === 1 ? "" : "s"}</div>
      </div>
      {!pays.length && <div className="card"><div className="empty">No payments recorded yet.</div></div>}
      {dates.map((date) => {
        const items = byDate[date];
        const dayTotal = items.reduce((s, p) => s + (+p.amount || 0), 0);
        return (
          <div className="card" key={date}>
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{fmtDate(date)}</h2>
              <span className="big" style={{ fontSize: 18 }}>{money(dayTotal)}</span>
            </div>
            {items.map((p) => {
              const w = workerById(p.workerId);
              return (
                <div className="log pay" key={p.id}>
                  <div className="row"><b>{w ? w.name : "?"}</b><b>{money(p.amount)}</b></div>
                  <div className="small muted">{p.paidBy ? "by " + p.paidBy : ""}{p.note ? (p.paidBy ? " · " : "") + p.note : ""}</div>
                  <div className="rowbtns">
                    <button className="btn small ghost" onClick={() => openModal("pay", p.id)}>Edit</button>
                    <button className="btn small warn" onClick={() => delPay(p.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ---------------- Materials ----------------
function Materials({ db, roomById, materialsTotal, openModal, delMat }) {
  const mats = [...db.materials].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="toolbar"><button className="btn primary" onClick={() => openModal("mat")}>+ Add material purchase</button></div>
      <div className="card" style={{ background: "linear-gradient(135deg,#2b241c,#182430)" }}>
        <div className="k muted small">TOTAL MATERIAL COST</div><div className="big">{money(materialsTotal())}</div>
        <div className="small muted">{db.materials.length} purchase{db.materials.length === 1 ? "" : "s"}</div>
      </div>
      <div className="card">
        <h2>All materials bought</h2>
        {!mats.length && <div className="empty">No materials added yet.</div>}
        {mats.map((m) => {
          const room = m.roomId ? roomById(m.roomId) : null;
          return (
            <div className="log mat" key={m.id}>
              <div className="row"><b>{m.item}</b><b>{money(m.amount)}</b></div>
              <div className="small muted">{fmtDate(m.date)}{m.qty ? " · " + m.qty + " " + (m.unit || "") : ""}{room ? " · " + room.name : ""}{m.paidBy ? " · by " + m.paidBy : ""}{m.vendor ? " · " + m.vendor : ""}</div>
              <div className="rowbtns">
                <button className="btn small ghost" onClick={() => openModal("mat", m.id)}>Edit</button>
                <button className="btn small warn" onClick={() => delMat(m.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Rooms ----------------
function Rooms({ db, materialsForRoom, openModal, delRoom }) {
  const totalBudget = db.rooms.reduce((s, r) => s + (+r.budget || 0), 0);
  const totalSpent = db.rooms.reduce((s, r) => s + materialsForRoom(r.id), 0);
  return (
    <>
      <div className="toolbar"><button className="btn primary" onClick={() => openModal("room")}>+ Add room</button></div>
      <div className="grid">
        <div className="stat"><div className="k">Total budget</div><div className="v">{money(totalBudget)}</div></div>
        <div className="stat"><div className="k">Spent on materials</div><div className="v">{money(totalSpent)}</div></div>
      </div>
      {!db.rooms.length && <div className="empty">No rooms yet. Add rooms to set a per-room material budget.</div>}
      {db.rooms.map((r) => {
        const spent = materialsForRoom(r.id);
        const budget = +r.budget || 0;
        const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
        const over = budget && spent > budget;
        return (
          <div className="card" key={r.id}>
            <div className="row"><b>{r.name}</b><span className="small muted">{money(spent)} / {budget ? money(budget) : "no budget"}</span></div>
            <div className="bar"><span style={{ width: pct + "%", background: over ? "var(--red)" : "var(--accent)" }} /></div>
            <div className="row" style={{ marginTop: 8 }}>
              <span className={"small " + (over ? "pos" : "muted")}>{budget ? (over ? money(spent - budget) + " over budget" : money(budget - spent) + " left") : "set a budget to track"}</span>
              <span className="rowbtns" style={{ margin: 0 }}>
                <button className="btn small ghost" onClick={() => openModal("room", r.id)}>Edit</button>
                <button className="btn small warn" onClick={() => delRoom(r.id)}>Delete</button>
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------------- Workers ----------------
function Workers({ db, openModal, delWorker, exportData, importData, resetAll }) {
  return (
    <>
      <div className="toolbar"><button className="btn primary" onClick={() => openModal("worker")}>+ Add worker</button></div>
      {!db.workers.length && <div className="empty">No workers yet.</div>}
      {db.workers.map((w) => (
        <div className="worker-item" key={w.id}>
          <div className="flex" style={{ alignItems: "center" }}>
            <div className="avatar">{w.name[0]}</div>
            <div><div style={{ fontWeight: 700 }}>{w.name}<span className="tag">{w.type}</span></div>
              <div className="small muted">{money(w.rate)} / day</div></div>
          </div>
          <div className="rowbtns" style={{ margin: 0 }}>
            <button className="btn small ghost" onClick={() => openModal("worker", w.id)}>Edit</button>
            <button className="btn small warn" onClick={() => delWorker(w.id)}>Delete</button>
          </div>
        </div>
      ))}
      <div className="card" style={{ marginTop: 12 }}>
        <h2>Backup</h2>
        <div className="small muted" style={{ marginBottom: 10 }}>Your data is saved in this browser. Export a backup to keep it safe or move it to another device.</div>
        <div className="flex">
          <button className="btn" onClick={exportData}>⬇ Export backup</button>
          <label className="btn" style={{ cursor: "pointer" }}>⬆ Import<input type="file" accept="application/json" style={{ display: "none" }} onChange={importData} /></label>
        </div>
        <div className="divider" />
        <button className="btn warn" onClick={resetAll}>Reset everything to start data</button>
      </div>
    </>
  );
}

// ---------------- History ----------------
function History({ db, workerById }) {
  const items = [];
  db.attendance.forEach((a) => { const w = workerById(a.workerId); items.push({ date: a.date, type: "work", text: `${w ? w.name : "?"} worked ${a.portion === 0.5 ? "½ day" : "full day"}`, amt: (w?.rate || 0) * (a.portion || 1) }); });
  db.payments.forEach((p) => { const w = workerById(p.workerId); items.push({ date: p.date, type: "pay", text: `Paid ${w ? w.name : "?"}${p.note ? " — " + p.note : ""}`, amt: p.amount }); });
  db.materials.forEach((m) => { items.push({ date: m.date, type: "mat", text: `Bought ${m.item}${m.qty ? " (" + m.qty + " " + (m.unit || "") + ")" : ""}${m.vendor ? " — " + m.vendor : ""}`, amt: m.amount }); });
  items.sort((a, b) => b.date.localeCompare(a.date));
  let lastDate = null;
  return (
    <div className="card">
      <h2>Full history</h2>
      {!items.length && <div className="empty">Nothing yet.</div>}
      {items.map((it, i) => {
        const header = it.date !== lastDate ? (lastDate = it.date, <div className="small muted" style={{ margin: "10px 0 6px", fontWeight: 700 }} key={"h" + i}>{fmtDate(it.date)}</div>) : null;
        const out = it.type === "pay" || it.type === "mat";
        return (
          <div key={i}>
            {header}
            <div className={"log " + it.type}>
              <div className="row"><span>{it.text}</span><b className={out ? "" : "muted"}>{out ? "−" : "+"}{money(it.amt)}</b></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Forms ----------------
function WorkerForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "Mistri");
  const [rate, setRate] = useState(initial?.rate ?? "");
  const submit = () => { if (!name.trim()) return alert("Enter a name"); onSave({ name: name.trim(), type, rate: +rate || 0 }); };
  return (
    <>
      <h3>{initial ? "Edit worker" : "Add worker"}</h3>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chattu Mistri" /></div>
      <div className="field"><label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {["Mistri", "Labour", "Carpenter", "Electrician", "Plumber", "Painter", "Other"].map((t) => <option key={t}>{t}</option>)}
        </select></div>
      <div className="field"><label>Daily wage (₹)</label><input type="number" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 700" /></div>
      <div className="rowbtns"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Save</button></div>
    </>
  );
}

function PaymentForm({ workers, payers, balanceFor, initial, onSave, onCancel }) {
  const [workerId, setWorkerId] = useState(initial?.workerId || workers[0]?.id || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [note, setNote] = useState(initial?.note || "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy || "Me");
  const submit = () => { if (!workerId) return alert("Pick a worker"); if (!(+amount > 0)) return alert("Enter an amount"); onSave({ workerId, amount: +amount, date, note: note.trim(), paidBy: paidBy.trim() || "Me" }); };
  return (
    <>
      <h3>{initial ? "Edit payment" : "Record payment / advance"}</h3>
      <div className="field"><label>Worker</label>
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} (bal {money(balanceFor(w.id))})</option>)}
        </select></div>
      <div className="field"><label>Amount (₹)</label><input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500" /></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Paid by</label><input list="payers" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Me" /><datalist id="payers">{payers.map((p) => <option key={p} value={p} />)}</datalist></div>
      <div className="field"><label>Note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. advance for tomorrow" /></div>
      <div className="rowbtns"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Save</button></div>
    </>
  );
}

function MaterialForm({ rooms, payers, initial, onSave, onCancel }) {
  const [item, setItem] = useState(initial?.item || "");
  const [qty, setQty] = useState(initial?.qty ?? "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [vendor, setVendor] = useState(initial?.vendor || "");
  const [roomId, setRoomId] = useState(initial?.roomId || "");
  const [paidBy, setPaidBy] = useState(initial?.paidBy || "Me");
  const submit = () => { if (!item.trim()) return alert("Enter item name"); if (!(+amount > 0)) return alert("Enter the cost"); onSave({ item: item.trim(), qty: +qty || 0, unit: unit.trim(), amount: +amount, date, vendor: vendor.trim(), roomId, paidBy: paidBy.trim() || "Me" }); };
  return (
    <>
      <h3>{initial ? "Edit material" : "Add material purchase"}</h3>
      <div className="field"><label>Item</label><input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Cement, Sand, Tiles, Paint" /></div>
      <div className="flex">
        <div className="field" style={{ flex: 1 }}><label>Quantity</label><input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 10" /></div>
        <div className="field" style={{ flex: 1 }}><label>Unit</label><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bag / kg / ft / pcs" /></div>
      </div>
      <div className="field"><label>Total cost (₹)</label><input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2000" /></div>
      <div className="field"><label>Room (optional)</label>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">— unassigned —</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Paid by</label><input list="payers" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Me" /><datalist id="payers">{payers.map((p) => <option key={p} value={p} />)}</datalist></div>
      <div className="field"><label>Vendor / shop (optional)</label><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Sharma Hardware" /></div>
      <div className="rowbtns"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Save</button></div>
    </>
  );
}

function RoomForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [budget, setBudget] = useState(initial?.budget ?? "");
  const submit = () => { if (!name.trim()) return alert("Enter a room name"); onSave({ name: name.trim(), budget: +budget || 0 }); };
  return (
    <>
      <h3>{initial ? "Edit room" : "Add room"}</h3>
      <div className="field"><label>Room name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen, Bathroom, Bedroom" /></div>
      <div className="field"><label>Material budget (₹)</label><input type="number" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 50000" /></div>
      <div className="rowbtns"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={submit}>Save</button></div>
    </>
  );
}
