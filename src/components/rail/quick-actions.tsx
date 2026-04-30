"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  Clock,
  CheckSquare,
  Ticket as TicketIcon,
  Users,
  FolderKanban,
  ChevronDown,
  Check,
  Command,
} from "lucide-react";

type ActionKey = "temps" | "tache" | "ticket" | "deal" | "projet" | null;

export function QuickActions({
  projects = [],
  clients = [],
  onShortcuts,
}: {
  projects?: { code: string; nom: string; id?: number }[];
  clients?: { id: number; nom: string }[];
  onShortcuts?: () => void;
}) {
  const [openKey, setOpenKey] = useState<ActionKey>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const close = () => setOpenKey(null);
  const confirm = (msg: string) => {
    close();
    setToast(msg);
  };

  const actions = [
    { key: "temps" as const, label: "Saisir du temps", Icon: Clock },
    { key: "tache" as const, label: "Nouvelle tâche", Icon: CheckSquare },
    { key: "ticket" as const, label: "Nouveau ticket", Icon: TicketIcon },
    { key: "deal" as const, label: "Nouveau deal", Icon: Users },
    { key: "projet" as const, label: "Nouveau projet", Icon: FolderKanban },
  ];

  return (
    <div className="relative mb-5">
      <div className="flex gap-2 flex-wrap items-stretch">
        {actions.map((a) => {
          const isOpen = openKey === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setOpenKey(isOpen ? null : a.key)}
              className="inline-flex items-center gap-2 text-[13px] font-medium rounded-lg transition-colors"
              style={{
                padding: "10px 14px",
                background: isOpen ? "var(--rail-dark)" : "var(--rail-panel)",
                color: isOpen ? "#fafaf7" : "var(--rail-ink)",
                border: `1px solid ${isOpen ? "var(--rail-dark)" : "var(--rail-hair)"}`,
              }}
              onMouseEnter={(e) => {
                if (!isOpen) e.currentTarget.style.background = "var(--rail-hair3)";
              }}
              onMouseLeave={(e) => {
                if (!isOpen) e.currentTarget.style.background = "var(--rail-panel)";
              }}
            >
              <a.Icon size={14} strokeWidth={1.5} />
              {a.label}
              <ChevronDown size={11} className="opacity-50 ml-0.5" />
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={onShortcuts}
          className="inline-flex items-center gap-2 text-[12.5px] rounded-lg"
          style={{
            padding: "10px 14px",
            color: "var(--rail-muted)",
            border: "1px dashed var(--rail-hair)",
          }}
        >
          <Command size={12} />
          Raccourcis · ⌘K
        </button>
      </div>

      {openKey === "temps" && (
        <Popover onClose={close} title="Saisir du temps" sub="Le temps se compte en pas de 0,25h (15 min).">
          <QuickTempsForm
            projects={projects}
            onSubmit={(p, h) => confirm(`+ ${h}h saisies sur ${p}`)}
          />
        </Popover>
      )}
      {openKey === "tache" && (
        <Popover onClose={close} title="Nouvelle tâche">
          <QuickTaskForm projects={projects} onSubmit={(t) => confirm(`Tâche créée : « ${t} »`)} />
        </Popover>
      )}
      {openKey === "ticket" && (
        <Popover onClose={close} title="Nouveau ticket" sub="Support client ou interne">
          <QuickTicketForm clients={clients} onSubmit={(ref) => confirm(`Ticket créé : ${ref}`)} />
        </Popover>
      )}
      {openKey === "deal" && (
        <Popover onClose={close} title="Nouveau deal — CRM">
          <QuickDealForm onSubmit={(name, amt) => confirm(`Deal créé : ${name} · ${amt} k€`)} />
        </Popover>
      )}
      {openKey === "projet" && (
        <Popover onClose={close} title="Nouveau projet">
          <QuickProjetForm onSubmit={(name) => confirm(`Projet créé : ${name}`)} />
        </Popover>
      )}

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 text-[13px] text-[#fafaf7]"
          style={{
            bottom: 24,
            background: "var(--rail-dark)",
            padding: "10px 16px",
            borderRadius: 7,
            boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
          }}
        >
          <Check size={13} className="text-[#8ab88f]" />
          {toast}
        </div>
      )}
    </div>
  );
}

function Popover({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div
        className="absolute left-0 z-45 overflow-hidden"
        style={{
          top: "100%",
          marginTop: 8,
          background: "#fff",
          border: "1px solid var(--rail-hair)",
          borderRadius: 8,
          boxShadow: "0 12px 36px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
          width: 400,
          zIndex: 45,
        }}
      >
        <div
          className="px-4 pt-3.5 pb-2.5"
          style={{ borderBottom: "1px solid var(--rail-hair2)" }}
        >
          <div className="text-[13px] font-semibold">{title}</div>
          {sub && (
            <div className="text-[11.5px] mt-0.5" style={{ color: "var(--rail-muted)" }}>
              {sub}
            </div>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-[11px] mb-1.5" style={{ color: "var(--rail-muted)" }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--rail-hair)",
  borderRadius: 5,
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  background: "#fff",
  color: "var(--rail-ink)",
};

function PrimaryBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[12.5px] font-medium rounded-md"
      style={{
        padding: "7px 14px",
        background: disabled ? "var(--rail-hair)" : "var(--b-accent)",
        color: disabled ? "var(--rail-muted)" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SegButton({
  value,
  active,
  onClick,
  children,
}: {
  value: string;
  active: boolean;
  onClick: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className="flex-1 text-[11px] rounded capitalize"
      style={{
        padding: "7px 0",
        border: `1px solid ${active ? "var(--b-accent)" : "var(--rail-hair)"}`,
        background: active ? "var(--rail-hair3)" : "#fff",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--rail-ink)" : "var(--rail-ink2)",
      }}
    >
      {children}
    </button>
  );
}

function QuickTempsForm({
  projects,
  onSubmit,
}: {
  projects: { code: string; nom: string }[];
  onSubmit: (p: string, h: string) => void;
}) {
  const [projet, setProjet] = useState(projects[0]?.code ?? "");
  const [heures, setHeures] = useState("2");
  const [desc, setDesc] = useState("");
  const projetLabel = projects.find((p) => p.code === projet)?.nom ?? projet;
  return (
    <div>
      <Field label="Projet">
        <select value={projet} onChange={(e) => setProjet(e.target.value)} style={fieldStyle}>
          {projects.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} — {p.nom}
            </option>
          ))}
          <option value="CNQ">CNQ — Interne Cinq</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Heures">
          <div className="flex gap-1">
            {["0.5", "1", "2", "4", "8"].map((h) => (
              <button
                key={h}
                onClick={() => setHeures(h)}
                className="flex-1 text-[12px] rounded"
                style={{
                  padding: "7px 0",
                  fontFamily: "var(--font-mono)",
                  border: `1px solid ${heures === h ? "var(--b-accent)" : "var(--rail-hair)"}`,
                  background: heures === h ? "var(--rail-hair3)" : "#fff",
                  fontWeight: heures === h ? 600 : 400,
                  color: heures === h ? "var(--rail-ink)" : "var(--rail-ink2)",
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        </Field>
        <Field label="Jour">
          <select defaultValue="today" style={fieldStyle}>
            <option value="today">Aujourd&apos;hui</option>
            <option>Hier</option>
            <option>Avant-hier</option>
          </select>
        </Field>
      </div>
      <Field label="Description (optionnel)">
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Ex. Revue maquettes V2"
          style={fieldStyle}
        />
      </Field>
      <div className="flex justify-between items-center mt-3.5">
        <span className="text-[11px]" style={{ color: "var(--rail-muted)" }}>
          Total après saisie : +{heures}h
        </span>
        <PrimaryBtn onClick={() => onSubmit(projetLabel, heures)}>Enregistrer</PrimaryBtn>
      </div>
    </div>
  );
}

function QuickTaskForm({
  projects,
  onSubmit,
}: {
  projects: { code: string; nom: string }[];
  onSubmit: (t: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("moyenne");
  return (
    <div>
      <Field label="Titre de la tâche">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. Préparer le kickoff Tolva"
          style={fieldStyle}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Projet">
          <select style={fieldStyle}>
            <option>Aucun</option>
            {projects.map((p) => (
              <option key={p.code}>
                {p.code} — {p.nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigné à">
          <select style={fieldStyle}>
            <option>Moi</option>
          </select>
        </Field>
        <Field label="Priorité">
          <div className="flex gap-1">
            {["basse", "moyenne", "haute"].map((p) => (
              <SegButton key={p} value={p} active={prio === p} onClick={setPrio}>
                {p}
              </SegButton>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Échéance">
        <div className="flex gap-1">
          {["Aujourd'hui", "Demain", "Cette sem.", "Sem. pro.", "Plus tard"].map((d) => (
            <button
              key={d}
              className="flex-1 text-[11.5px] rounded"
              style={{
                padding: "6px 4px",
                border: "1px solid var(--rail-hair)",
                background: "#fff",
                color: "var(--rail-ink2)",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex justify-end mt-3.5 gap-2">
        <PrimaryBtn disabled={!title} onClick={() => onSubmit(title || "Nouvelle tâche")}>
          Créer la tâche
        </PrimaryBtn>
      </div>
    </div>
  );
}

function QuickTicketForm({
  clients,
  onSubmit,
}: {
  clients: { id: number; nom: string }[];
  onSubmit: (ref: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("moyenne");
  const nextRef = `T-${343 + Math.floor(Math.random() * 10)}`;
  return (
    <div>
      <div className="grid grid-cols-[auto_1fr] gap-2.5 mb-3 items-center">
        <span
          className="text-[11.5px] rounded"
          style={{
            fontFamily: "var(--font-mono)",
            padding: "4px 8px",
            background: "var(--rail-hair2)",
            color: "var(--rail-ink2)",
          }}
        >
          {nextRef}
        </span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du ticket…"
          style={fieldStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Client">
          <select style={fieldStyle}>
            {clients.length === 0 ? (
              <option>Interne</option>
            ) : (
              clients.map((c) => <option key={c.id}>{c.nom}</option>)
            )}
          </select>
        </Field>
        <Field label="Priorité">
          <div className="flex gap-1">
            {["basse", "moyenne", "haute"].map((p) => (
              <SegButton key={p} value={p} active={prio === p} onClick={setPrio}>
                {p}
              </SegButton>
            ))}
          </div>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          rows={3}
          placeholder="Décrire le bug, l'étape de reproduction, le comportement attendu…"
          style={{ ...fieldStyle, resize: "vertical", fontFamily: "var(--font-sans)" }}
        />
      </Field>
      <div className="flex justify-between items-center mt-1">
        <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--rail-muted)" }}>
          <input type="checkbox" defaultChecked /> Notifier le client
        </label>
        <PrimaryBtn disabled={!title} onClick={() => onSubmit(nextRef)}>
          Créer le ticket
        </PrimaryBtn>
      </div>
    </div>
  );
}

function QuickDealForm({ onSubmit }: { onSubmit: (name: string, amt: string) => void }) {
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  return (
    <div>
      <Field label="Nom du deal">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Refonte site — Maison X"
          style={fieldStyle}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Client">
          <input placeholder="Nouveau ou existant" style={fieldStyle} />
        </Field>
        <Field label="Montant (k€)">
          <input
            type="number"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="45"
            style={fieldStyle}
          />
        </Field>
        <Field label="Étape">
          <select defaultValue="Prospect" style={fieldStyle}>
            <option>Prospect</option>
            <option>Qualifié</option>
            <option>Proposition</option>
            <option>Négociation</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end mt-1">
        <PrimaryBtn disabled={!name} onClick={() => onSubmit(name || "Nouveau deal", amt || "0")}>
          Créer le deal
        </PrimaryBtn>
      </div>
    </div>
  );
}

function QuickProjetForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div>
      <Field label="Nom du projet">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Refonte Maison X"
          style={fieldStyle}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Client">
          <input placeholder="Nouveau ou existant" style={fieldStyle} />
        </Field>
        <Field label="Deal source">
          <select style={fieldStyle}>
            <option>Aucun</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Démarrage">
          <input type="date" style={fieldStyle} />
        </Field>
        <Field label="Échéance">
          <input type="date" style={fieldStyle} />
        </Field>
      </div>
      <div className="flex justify-end mt-1">
        <PrimaryBtn disabled={!name} onClick={() => onSubmit(name || "Nouveau projet")}>
          Créer le projet
        </PrimaryBtn>
      </div>
    </div>
  );
}
