import { useState, useCallback } from "react";

interface ConfigurableVarsEditorProps {
  configurableDoubleData: { [key: string]: number };
  configurableIntData: { [key: string]: number };
  configurableStringData: { [key: string]: string };
}

type VarType = "double" | "int" | "string";

interface PendingChange {
  type: VarType;
  key: string;
  value: number | string;
}

async function postInt(name: string, value: number): Promise<boolean> {
  try {
    const res = await fetch("/configurable-int", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, default: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postDouble(name: string, value: number): Promise<boolean> {
  try {
    const res = await fetch("/configurable-double", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, default: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postString(name: string, value: string): Promise<boolean> {
  try {
    const res = await fetch("/configurable-string", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, default: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function ConfigurableVarsEditor({
  configurableDoubleData,
  configurableIntData,
  configurableStringData,
}: ConfigurableVarsEditorProps) {
  const [edits, setEdits] = useState<{ [key: string]: number | string }>({});
  const [statuses, setStatuses] = useState<{ [key: string]: "saved" | "edited" | "sending" | "sent" | "error" }>({});

  const compositeKey = (type: VarType, key: string) => `${type}::${key}`;

  const getEditedValue = (type: VarType, key: string): number | string => {
    const ck = compositeKey(type, key);
    return ck in edits
      ? edits[ck]
      : type === "double"
        ? configurableDoubleData[key]
        : type === "int"
          ? configurableIntData[key]
          : configurableStringData[key];
  };

  const isDirty = (type: VarType, key: string): boolean => {
    const ck = compositeKey(type, key);
    if (!(ck in edits)) return false;
    const original =
      type === "double" ? configurableDoubleData[key] : type === "int" ? configurableIntData[key] : configurableStringData[key];
    return edits[ck] !== original;
  };

  const allDirty: PendingChange[] = [
    ...Object.keys(configurableDoubleData)
      .filter((k) => isDirty("double", k))
      .map((k) => ({ type: "double" as VarType, key: k, value: edits[compositeKey("double", k)] as number })),
    ...Object.keys(configurableIntData)
      .filter((k) => isDirty("int", k))
      .map((k) => ({ type: "int" as VarType, key: k, value: edits[compositeKey("int", k)] as number })),
    ...Object.keys(configurableStringData)
      .filter((k) => isDirty("string", k))
      .map((k) => ({ type: "string" as VarType, key: k, value: edits[compositeKey("string", k)] as string })),
  ];

  const handleChange = useCallback((type: VarType, key: string, raw: string) => {
    let value: number | string;
    if (type === "double") {
      value = parseFloat(raw);
      if (isNaN(value)) return;
    } else if (type === "int") {
      value = parseInt(raw, 10);
      if (isNaN(value)) return;
    } else {
      value = raw;
    }
    const ck = compositeKey(type, key);
    setEdits((prev) => ({ ...prev, [ck]: value }));
    setStatuses((prev) => ({ ...prev, [ck]: "edited" }));
  }, []);

  const sendOne = useCallback(async (type: VarType, key: string) => {
    const ck = compositeKey(type, key);
    const value = edits[ck];
    setStatuses((prev) => ({ ...prev, [ck]: "sending" }));
    let ok: boolean;
    if (type === "double") {
      ok = await postDouble(key, value as number);
    } else if (type === "int") {
      ok = await postInt(key, value as number);
    } else {
      ok = await postString(key, value as string);
    }
    setStatuses((prev) => ({ ...prev, [ck]: ok ? "sent" : "error" }));
  }, [edits]);

  const sendAll = useCallback(async () => {
    await Promise.all(allDirty.map(({ type, key }) => sendOne(type, key)));
  }, [allDirty, sendOne]);

  const resetAll = useCallback(() => {
    setEdits({});
    setStatuses({});
  }, []);

  const statusColor: Record<string, string> = {
    saved: "text-neutral-400",
    edited: "text-yellow-500",
    sending: "text-blue-400",
    sent: "text-green-500",
    error: "text-red-500",
  };

  const renderRow = (type: VarType, key: string) => {
    const ck = compositeKey(type, key);
    const dirty = isDirty(type, key);
    const status = statuses[ck] ?? "saved";
    const value = getEditedValue(type, key);

    const isString = type === "string";
    const inputProps = isString
      ? { type: "text" }
      : { type: "number", step: type === "double" ? "any" : "1" };

    return (
      <div key={key} className="grid items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-700 mb-1.5"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,2fr) 64px 56px" }}>
        <span className="truncate text-sm" title={key}>{key}</span>
        <input
          {...inputProps}
          value={value}
          onChange={(e) => handleChange(type, key, e.target.value)}
          className="h-8 w-full rounded border border-neutral-200 bg-neutral-50 px-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        />
        <span className={`text-right text-xs ${statusColor[status]}`}>{status}</span>
        <button
          disabled={!dirty || status === "sending"}
          onClick={() => sendOne(type, key)}
          className="h-8 rounded border border-neutral-200 px-2 text-xs disabled:opacity-35 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-600"
        >
          {status === "sending" ? "..." : "Send"}
        </button>
      </div>
    );
  };

  const hasDoubles = Object.keys(configurableDoubleData).length > 0;
  const hasInts = Object.keys(configurableIntData).length > 0;
  const hasStrings = Object.keys(configurableStringData).length > 0;

  return (
    <div className="w-full p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configurable Variables</h2>
        {allDirty.length > 0 && (
          <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-1 text-xs text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700">
            {allDirty.length} unsent
          </span>
        )}
      </div>

      {!hasDoubles && !hasInts && !hasStrings && (
        <p className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
          No configurable variables received yet
        </p>
      )}

      {hasDoubles && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Float (double)</p>
          {Object.keys(configurableDoubleData).map((k) => renderRow("double", k))}
        </div>
      )}

      {hasInts && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Integer</p>
          {Object.keys(configurableIntData).map((k) => renderRow("int", k))}
        </div>
      )}

      {hasStrings && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">String</p>
          {Object.keys(configurableStringData).map((k) => renderRow("string", k))}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-600">
        <button
          disabled={allDirty.length === 0}
          onClick={resetAll}
          className="h-8 rounded border border-neutral-200 px-3 text-sm disabled:opacity-35 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-700"
        >
          Reset all
        </button>
        <button
          disabled={allDirty.length === 0}
          onClick={sendAll}
          className="h-8 rounded border border-neutral-300 px-3 text-sm disabled:opacity-35 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-700"
        >
          Send all changes
        </button>
      </div>
    </div>
  );
}