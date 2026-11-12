const { useState, useEffect, useMemo } = React;

/* ---------- Constantes ---------- */
const CATEGORIES = {
  "Salário":     { color: "#0f766e", type: "in" },
  "Renda extra": { color: "#2a9d8f", type: "in" },
  "Alimentação": { color: "#e76f51", type: "out" },
  "Moradia":     { color: "#3d5a80", type: "out" },
  "Transporte":  { color: "#e9b44c", type: "out" },
  "Lazer":       { color: "#9b5de5", type: "out" },
  "Saúde":       { color: "#be3455", type: "out" },
  "Educação":    { color: "#4895ef", type: "out" },
  "Outros":      { color: "#8d99ae", type: "out" },
};
const catsOf = (type) => Object.keys(CATEGORIES).filter((c) => CATEGORIES[c].type === type);
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d.split("-").reverse().join("/");
const monthLabel = (m) => {
  const [y, mo] = m.split("-");
  return new Date(y, mo - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
};
const sum = (list, type) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; }
    catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Formulário ---------- */
function TxForm({ editing, onSave, onCancel }) {
  const blank = { desc: "", amount: "", type: "out", category: "Alimentação", date: today() };
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    setF(editing ? { ...editing, amount: String(editing.amount) } : blank);
    setError("");
  }, [editing]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setType = (type) => setF((p) => ({ ...p, type, category: catsOf(type)[0] }));

  const submit = (e) => {
    e.preventDefault();
    const amount = parseFloat(String(f.amount).replace(",", "."));
    if (!f.desc.trim()) return setError("Informe uma descrição.");
    if (!(amount > 0)) return setError("O valor deve ser maior que zero.");
    onSave({ ...f, desc: f.desc.trim(), amount, id: editing ? editing.id : crypto.randomUUID() });
    if (!editing) setF(blank);
    setError("");
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{editing ? "Editar lançamento" : "Novo lançamento"}</h2>
      <div className="seg" role="group" aria-label="Tipo">
        <button type="button" className={"out-b" + (f.type === "out" ? " on" : "")} onClick={() => setType("out")}>Despesa</button>
        <button type="button" className={"in-b" + (f.type === "in" ? " on" : "")} onClick={() => setType("in")}>Receita</button>
      </div>
      <label>Descrição
        <input value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Ex.: Mercado" />
      </label>
      <label>Valor (R$)
        <input inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" />
      </label>
      <label>Categoria
        <select value={f.category} onChange={(e) => set("category", e.target.value)}>
          {catsOf(f.type).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Data
        <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
      </label>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn primary">{editing ? "Salvar alterações" : "Adicionar"}</button>
      {editing && <button type="button" className="btn" onClick={onCancel}>Cancelar edição</button>}
    </form>
  );
}

/* ---------- Gráficos ---------- */
function Donut({ list }) {
  const byCat = {};
  list.filter((t) => t.type === "out").forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  return (
    <div className="card">
      <h2>Despesas por categoria</h2>
      {!total ? <p className="empty">Sem despesas neste filtro.</p> : (
        <div className="donut-wrap">
          <svg className="donut" viewBox="0 0 36 36" role="img" aria-label="Gráfico de despesas por categoria">
            {entries.map(([cat, v]) => {
              const pct = (v / total) * 100;
              const el = <circle key={cat} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="5"
                stroke={CATEGORIES[cat].color} strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acc} />;
              acc += pct;
              return el;
            })}
          </svg>
          <ul className="legend">
            {entries.map(([cat, v]) => (
              <li key={cat}><span className="dot" style={{ background: CATEGORIES[cat].color }} />{cat}: {brl(v)} ({Math.round((v / total) * 100)}%)</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MonthBars({ all }) {
  const months = [...new Set(all.map((t) => t.date.slice(0, 7)))].sort().slice(-6);
  const data = months.map((m) => {
    const l = all.filter((t) => t.date.startsWith(m));
    return { m, inc: sum(l, "in"), out: sum(l, "out") };
  });
  const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.out]));
  return (
    <div className="card">
      <h2>Receitas x despesas por mês</h2>
      {!data.length ? <p className="empty">Adicione lançamentos para ver o histórico.</p> : (
        <div className="bars">
          {data.map((d) => (
            <div className="bar-col" key={d.m} title={`${brl(d.inc)} entradas / ${brl(d.out)} saídas`}>
              <div className="bar-pair">
                <i style={{ height: (d.inc / max) * 100 + "%", background: "var(--in)" }} />
                <i style={{ height: (d.out / max) * 100 + "%", background: "var(--out)" }} />
              </div>
              <small>{monthLabel(d.m)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Limites por categoria ---------- */
function Limits({ list, limits, setLimits }) {
  return (
    <div className="card">
      <h2>Limites de gasto</h2>
      {catsOf("out").map((cat) => {
        const spent = list.filter((t) => t.type === "out" && t.category === cat).reduce((s, t) => s + t.amount, 0);
        const limit = limits[cat] || 0;
        const pct = limit ? (spent / limit) * 100 : 0;
        const cls = pct > 100 ? "over" : pct >= 80 ? "warn" : "";
        return (
          <div className="limit" key={cat}>
            <div className="row">
              <span><span className="dot" style={{ background: CATEGORIES[cat].color }} />{cat}</span>
              <input aria-label={`Limite de ${cat}`} inputMode="decimal" placeholder="Limite"
                value={limit || ""} onChange={(e) => setLimits({ ...limits, [cat]: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
            </div>
            {limit > 0 && (
              <>
                <div className="track"><div className={cls} style={{ width: Math.min(pct, 100) + "%" }} /></div>
                <span className={"note" + (cls === "over" ? " out" : "")}>
                  {brl(spent)} de {brl(limit)}{pct > 100 ? " — limite estourado" : pct >= 80 ? " — perto do limite" : ""}
                </span>
              </>
            )}
          </div>
        );
      })}
      <p className="note">Os limites consideram o mês selecionado no filtro.</p>
    </div>
  );
}

/* ---------- App ---------- */
function App() {
  const [txs, setTxs] = useStored("caixa:txs", []);
  const [limits, setLimits] = useStored("caixa:limits", {});
  const [theme, setTheme] = useStored("caixa:theme", "light");
  const [editing, setEditing] = useState(null);
  const [fMonth, setFMonth] = useState(today().slice(0, 7));
  const [fType, setFType] = useState("all");
  const [fCat, setFCat] = useState("all");

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const months = useMemo(
    () => [...new Set([today().slice(0, 7), ...txs.map((t) => t.date.slice(0, 7))])].sort().reverse(),
    [txs]
  );
  const byMonth = useMemo(() => txs.filter((t) => fMonth === "all" || t.date.startsWith(fMonth)), [txs, fMonth]);
  const filtered = useMemo(
    () => byMonth.filter((t) => (fType === "all" || t.type === fType) && (fCat === "all" || t.category === fCat))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [byMonth, fType, fCat]
  );

  const income = sum(filtered, "in"), expense = sum(filtered, "out"), balance = income - expense;

  const save = (tx) => {
    setTxs((p) => (p.some((t) => t.id === tx.id) ? p.map((t) => (t.id === tx.id ? tx : t)) : [tx, ...p]));
    setEditing(null);
  };
  const remove = (id) => { if (confirm("Excluir este lançamento?")) setTxs((p) => p.filter((t) => t.id !== id)); };

  const exportJSON = () => download("caixa-backup.json", JSON.stringify({ txs, limits }, null, 2), "application/json");
  const exportCSV = () => {
    const rows = [["data", "tipo", "categoria", "descricao", "valor"],
      ...filtered.map((t) => [t.date, t.type === "in" ? "receita" : "despesa", t.category, `"${t.desc.replace(/"/g, '""')}"`, t.amount.toFixed(2)])];
    download("caixa-lancamentos.csv", rows.map((r) => r.join(",")).join("\n"), "text/csv");
  };
  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data.txs)) throw new Error();
        setTxs(data.txs); setLimits(data.limits || {});
      } catch { alert("Arquivo inválido. Use um backup exportado pelo próprio app."); }
    });
    e.target.value = "";
  };

  return (
    <div className="wrap">
      <header>
        <h1>Caixa</h1>
        <div className="tools">
          <button className="btn" onClick={exportCSV}>Exportar CSV</button>
          <button className="btn" onClick={exportJSON}>Backup JSON</button>
          <label className="btn" style={{ cursor: "pointer", color: "inherit" }}>
            Importar backup
            <input type="file" accept="application/json" onChange={importJSON} hidden />
          </label>
          <button className="btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Modo escuro" : "Modo claro"}
          </button>
        </div>
      </header>

      <section className="summary" aria-label="Resumo">
        <div className="card"><div className="label">Saldo</div><div className={"num " + (balance < 0 ? "out" : "")}>{brl(balance)}</div></div>
        <div className="card"><div className="label">Entradas</div><div className="num in">{brl(income)}</div></div>
        <div className="card"><div className="label">Saídas</div><div className="num out">{brl(expense)}</div></div>
      </section>

      <div className="grid">
        <div className="stack">
          <TxForm editing={editing} onSave={save} onCancel={() => setEditing(null)} />
          <Limits list={byMonth} limits={limits} setLimits={setLimits} />
        </div>

        <div className="stack">
          <div className="charts">
            <Donut list={filtered} />
            <MonthBars all={txs} />
          </div>

          <div className="card">
            <h2>Lançamentos</h2>
            <div className="filters">
              <select aria-label="Mês" value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
                <option value="all">Todos os meses</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <select aria-label="Tipo" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="all">Receitas e despesas</option>
                <option value="in">Só receitas</option>
                <option value="out">Só despesas</option>
              </select>
              <select aria-label="Categoria" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                <option value="all">Todas as categorias</option>
                {Object.keys(CATEGORIES).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {!filtered.length ? (
              <p className="empty">Nenhum lançamento aqui. Adicione o primeiro no formulário.</p>
            ) : (
              <ul className="tx">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <span className="dot" style={{ background: CATEGORIES[t.category].color }} />
                    <div className="info"><strong>{t.desc}</strong><span>{t.category} · {fmtDate(t.date)}</span></div>
                    <span className={"val num " + t.type}>{t.type === "in" ? "+" : "−"} {brl(t.amount)}</span>
                    <button className="btn small" onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                    <button className="btn small" onClick={() => remove(t.id)}>Excluir</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
