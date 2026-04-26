import { useState, useCallback } from "react";

interface ConfigurableVarsEditorProps {
  configurableDoubleData: { [key: string]: number };
  configurableIntData: { [key: string]: number };
  sendMessage: (msg: object) => void;
}

type VarType = "double" | "int";

interface PendingChange {
  type: VarType;
  key: string;
  value: number;
}

export function ConfigurableVarsEditor({
  configurableDoubleData,
  configurableIntData,
  sendMessage,
}: ConfigurableVarsEditorProps) {
  const [edits, setEdits] = useState<{ [key: string]: number }>({});
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());

  const compositeKey = (type: VarType, key: string) => `${type}::${key}`;

  const getEditedValue = (type: VarType, key: string): number => {
    const ck = compositeKey(type, key);
    return ck in edits
      ? edits[ck]
      : type === "double"
        ? configurableDoubleData[key]
        : configurableIntData[key];
  };

  const isDirty = (type: VarType, key: string): boolean => {
    const ck = compositeKey(type, key);
    if (!(ck in edits)) return false;
    const original =
      type === "double" ? configurableDoubleData[key] : configurableIntData[key];
    return edits[ck] !== original;
  };

  const wasSent = (type: VarType, key: string) =>
    sentKeys.has(compositeKey(type, key));

  const allDirty: PendingChange[] = [
    ...Object.keys(configurableDoubleData)
      .filter((k) => isDirty("double", k))
      .map((k) => ({ type: "double" as VarType, key: k, value: edits[compositeKey("double", k)] })),
    ...Object.keys(configurableIntData)
      .filter((k) => isDirty("int", k))
      .map((k) => ({ type: "int" as VarType, key: k, value: edits[compositeKey("int", k)] })),
  ];

  const handleChange = useCallback(
    (type: VarType, key: string, raw: string) => {
      const value = type === "double" ? parseFloat(raw) : parseInt(raw, 10);
      if (isNaN(value)) return;
      setEdits((prev) => ({ ...prev, [compositeKey(type, key)]: value }));
      setSentKeys((prev) => {
        const next = new Set(prev);
        next.delete(compositeKey(type, key));
        return next;
      });
    },
    []
  );

  const dispatchChange = useCallback(
    (change: PendingChange) => {
      sendMessage({
        kind: "set_configurable_var",
        type: change.type,
        key: change.key,
        value: change.value,
      });
      setSentKeys((prev) => new Set(prev).add(compositeKey(change.type, change.key)));
    },
    [sendMessage]
  );

  const sendOne = (type: VarType, key: string) =>
    dispatchChange({ type, key, value: getEditedValue(type, key) });

  const sendAll = () => allDirty.forEach(dispatchChange);

  const resetAll = () => {
    setEdits({});
    setSentKeys(new Set());
  };

  const renderRow = (type: VarType, key: string) => {
    const dirty = isDirty(type, key);
    const sent = wasSent(type, key);
    const value = getEditedValue(type, key);

    let statusText = "saved";
    let statusColor = "var(--color-text-tertiary)";
    if (dirty) { statusText = "edited"; statusColor = "var(--color-text-warning)"; }
    if (sent)  { statusText = "sent";   statusColor = "var(--color-text-success)"; }

    return (
      <div key={key} style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.2fr) minmax(0,2fr) 64px 56px",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: "var(--border-radius-md)",
        border: "0.5px solid var(--color-border-tertiary)",
        background: "var(--color-background-primary)",
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={key}>
          {key}
        </span>
        <input
          type="number"
          step={type === "double" ? "any" : "1"}
          value={value}
          onChange={(e) => handleChange(type, key, e.target.value)}
          style={{
            width: "100%", fontSize: 13, padding: "4px 8px", boxSizing: "border-box",
            height: 30, background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)", color: "var(--color-text-primary)",
          }}
        />
        <span style={{ fontSize: 12, color: statusColor, textAlign: "right" }}>
          {statusText}
        </span>
        <button
          disabled={!dirty}
          onClick={() => sendOne(type, key)}
          style={{
            height: 30, padding: "0 10px", fontSize: 12, cursor: dirty ? "pointer" : "default",
            borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)",
            background: "transparent", color: "var(--color-text-primary)", opacity: dirty ? 1 : 0.35,
          }}
        >
          Send
        </button>
      </div>
    );
  };

  const sectionLabel = (label: string) => (
    <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
      color: "var(--color-text-tertiary)", margin: "0 0 8px" }}>
      {label}
    </p>
  );

  return (
    <div style={{ padding: "1rem 0", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Configurable variables</p>
        {allDirty.length > 0 && (
          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: "var(--border-radius-md)",
            background: "var(--color-background-secondary)", color: "var(--color-text-secondary)",
            border: "0.5px solid var(--color-border-tertiary)" }}>
            {allDirty.length} unsent
          </span>
        )}
      </div>

      {Object.keys(configurableDoubleData).length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          {sectionLabel("Float (double)")}
          {Object.keys(configurableDoubleData).map((k) => renderRow("double", k))}
        </div>
      )}

      {Object.keys(configurableIntData).length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          {sectionLabel("Integer")}
          {Object.keys(configurableIntData).map((k) => renderRow("int", k))}
        </div>
      )}

      {Object.keys(configurableDoubleData).length === 0 && Object.keys(configurableIntData).length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center",
          padding: 12, border: "0.5px dashed var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-md)" }}>
          No configurable variables received yet
        </p>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "1rem",
        paddingTop: "1rem", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        <button disabled={allDirty.length === 0} onClick={resetAll}
          style={{ height: 30, padding: "0 10px", fontSize: 12, cursor: "pointer",
            borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)",
            background: "transparent", opacity: allDirty.length === 0 ? 0.35 : 1 }}>
          Reset all
        </button>
        <button disabled={allDirty.length === 0} onClick={sendAll}
          style={{ height: 30, padding: "0 12px", fontSize: 12, cursor: "pointer",
            borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-primary)",
            background: "var(--color-background-primary)", opacity: allDirty.length === 0 ? 0.35 : 1 }}>
          Send all changes
        </button>
      </div>
    </div>
  );
}
export default ConfigurableVarsEditor;