import { useState, useEffect } from "react";
import { ConfigurableVarData } from "../types";

interface ConfigurableVarsEditorProps {
  endpoint?: string;
}

function ConfigurableVarsEditor({
  endpoint = "http://localhost:3000/configurable-vars",
}: ConfigurableVarsEditorProps) {
  const [currentDoubles, setCurrentDoubles] = useState<ConfigurableVarData["configurable_double"]>({});
  const [currentInts, setCurrentInts] = useState<ConfigurableVarData["configurable_int"]>({});

  // Edited values stored as strings for input compatibility, parsed on submit
  const [editedDoubles, setEditedDoubles] = useState<{ [key: string]: string }>({});
  const [editedInts, setEditedInts] = useState<{ [key: string]: string }>({});

  const [status, setStatus] = useState<{ message: string; type: "idle" | "success" | "error" }>({
    message: "",
    type: "idle",
  });
  const [loading, setLoading] = useState(true);

  const fetchVars = async () => {
    setLoading(true);
    setStatus({ message: "", type: "idle" });
    try {
      const res = await fetch(endpoint);
      const data: ConfigurableVarData = await res.json();

      setCurrentDoubles(data.configurable_double ?? {});
      setCurrentInts(data.configurable_int ?? {});

      setEditedDoubles(
        Object.fromEntries(Object.entries(data.configurable_double ?? {}).map(([k, v]) => [k, String(v)]))
      );
      setEditedInts(
        Object.fromEntries(Object.entries(data.configurable_int ?? {}).map(([k, v]) => [k, String(v)]))
      );
    } catch {
      setStatus({ message: "Could not reach server — showing mock data.", type: "error" });
      const mockDoubles: ConfigurableVarData["configurable_double"] = {
        max_speed: 120.0,
        timeout_ms: 5000.0,
      };
      const mockInts: ConfigurableVarData["configurable_int"] = {
        retry_count: 3,
        log_level: 1,
      };
      setCurrentDoubles(mockDoubles);
      setCurrentInts(mockInts);
      setEditedDoubles(Object.fromEntries(Object.entries(mockDoubles).map(([k, v]) => [k, String(v)])));
      setEditedInts(Object.fromEntries(Object.entries(mockInts).map(([k, v]) => [k, String(v)])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVars();
  }, []);

  const handleEditDouble = (key: string, value: string) => {
    setEditedDoubles((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditInt = (key: string, value: string) => {
    setEditedInts((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const changedDoubles: ConfigurableVarData["configurable_double"] = {};
    for (const key of Object.keys(editedDoubles)) {
      const parsed = parseFloat(editedDoubles[key]);
      if (!isNaN(parsed) && parsed !== currentDoubles[key]) {
        changedDoubles[key] = parsed;
      }
    }

    const changedInts: ConfigurableVarData["configurable_int"] = {};
    for (const key of Object.keys(editedInts)) {
      const parsed = parseInt(editedInts[key]);
      if (!isNaN(parsed) && parsed !== currentInts[key]) {
        changedInts[key] = parsed;
      }
    }

    const totalChanged = Object.keys(changedDoubles).length + Object.keys(changedInts).length;
    if (totalChanged === 0) {
      setStatus({ message: "No changes to submit.", type: "idle" });
      return;
    }

    const payload: ConfigurableVarData = {
      configurable_double: changedDoubles,
      configurable_int: changedInts,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCurrentDoubles((prev) => ({ ...prev, ...changedDoubles }));
        setCurrentInts((prev) => ({ ...prev, ...changedInts }));
        setStatus({ message: `${totalChanged} variable(s) saved.`, type: "success" });
      } else {
        setStatus({ message: "Server returned an error.", type: "error" });
      }
    } catch {
      setStatus({ message: "Could not reach server.", type: "error" });
    }
  };

  const isDoubleEdited = (key: string) =>
    parseFloat(editedDoubles[key]) !== currentDoubles[key];
  const isIntEdited = (key: string) =>
    parseInt(editedInts[key]) !== currentInts[key];

  const hasChanges =
    Object.keys(editedDoubles).some(isDoubleEdited) ||
    Object.keys(editedInts).some(isIntEdited);

  const renderRow = (
    key: string,
    value: string,
    edited: boolean,
    onChange: (k: string, v: string) => void,
    inputType: "float" | "int"
  ) => (
    <div key={key} className="flex items-center gap-3 py-2">
      <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400 min-w-[140px] break-all">
        {key}
      </span>
      <input
        type="number"
        step={inputType === "float" ? "any" : "1"}
        value={value}
        onChange={(e) => onChange(key, e.target.value)}
        className="flex-1 rounded border px-2 py-1 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:bg-neutral-800"
      />
      <span
        className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
          edited
            ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700"
            : "bg-neutral-100 text-neutral-400 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700"
        }`}
      >
        {edited ? "edited" : "saved"}
      </span>
    </div>
  );

  const hasDoubles = Object.keys(editedDoubles).length > 0;
  const hasInts = Object.keys(editedInts).length > 0;

  return (
    <div className="rounded-lg border p-4 w-full max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Configurable Variables</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Edit and submit configuration values
          </p>
        </div>
        <button
          onClick={fetchVars}
          className="text-sm rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400 py-4 text-center">Loading variables...</p>
      ) : !hasDoubles && !hasInts ? (
        <p className="text-sm text-neutral-400 py-4 text-center">No variables found.</p>
      ) : (
        <div className="flex flex-col">
          {hasDoubles && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mt-2 mb-1">
                Doubles
              </p>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {Object.keys(editedDoubles).map((key) =>
                  renderRow(key, editedDoubles[key], isDoubleEdited(key), handleEditDouble, "float")
                )}
              </div>
            </>
          )}
          {hasInts && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mt-4 mb-1">
                Integers
              </p>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {Object.keys(editedInts).map((key) =>
                  renderRow(key, editedInts[key], isIntEdited(key), handleEditInt, "int")
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <span
          className={`text-sm ${
            status.type === "success"
              ? "text-green-600 dark:text-green-400"
              : status.type === "error"
              ? "text-red-500"
              : "text-neutral-400"
          }`}
        >
          {status.message}
        </span>
        {!loading && (
          <button
            onClick={handleSubmit}
            disabled={!hasChanges}
            className="text-sm rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit changes
          </button>
        )}
      </div>
    </div>
  );
}

export default ConfigurableVarsEditor;