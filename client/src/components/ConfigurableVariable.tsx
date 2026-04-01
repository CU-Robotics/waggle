import { useState, useEffect } from "react";
 
interface VarMap {
  [key: string]: string;
}
 
interface ConfigurableVarsEditorProps {
  endpoint?: string;
}
 
function ConfigurableVarsEditor({
  endpoint = "http://localhost:3000/configurable-vars",
}: ConfigurableVarsEditorProps) {
  const [currentVars, setCurrentVars] = useState<VarMap>({});
  const [editedVars, setEditedVars] = useState<VarMap>({});
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
      const data: VarMap = await res.json();
      setCurrentVars(data);
      setEditedVars(data);
    } catch {
      setStatus({ message: "Could not reach server — showing mock data.", type: "error" });
      const mock: VarMap = {
        max_speed: "120",
        retry_count: "3",
        timeout_ms: "5000",
        debug_mode: "false",
        log_level: "info",
      };
      setCurrentVars(mock);
      setEditedVars(mock);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchVars();
  }, []);
 
  const handleEdit = (key: string, value: string) => {
    setEditedVars((prev) => ({ ...prev, [key]: value }));
  };
 
  const handleSubmit = async () => {
    const changed: VarMap = {};
    for (const key of Object.keys(editedVars)) {
      if (editedVars[key] !== currentVars[key]) {
        changed[key] = editedVars[key];
      }
    }
 
    if (Object.keys(changed).length === 0) {
      setStatus({ message: "No changes to submit.", type: "idle" });
      return;
    }
 
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
 
      if (res.ok) {
        setCurrentVars({ ...editedVars });
        setStatus({
          message: `${Object.keys(changed).length} variable(s) saved.`,
          type: "success",
        });
      } else {
        setStatus({ message: "Server returned an error.", type: "error" });
      }
    } catch {
      setStatus({ message: "Could not reach server.", type: "error" });
    }
  };
 
  const isEdited = (key: string) => editedVars[key] !== currentVars[key];
  const hasChanges = Object.keys(editedVars).some((k) => isEdited(k));
 
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
      ) : Object.keys(currentVars).length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">No variables found.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-700">
          {Object.keys(editedVars).map((key) => (
            <div key={key} className="flex items-center gap-3 py-2">
              <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400 min-w-[140px] break-all">
                {key}
              </span>
              <input
                type="text"
                value={editedVars[key]}
                onChange={(e) => handleEdit(key, e.target.value)}
                className="flex-1 rounded border px-2 py-1 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
              <span
                className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                  isEdited(key)
                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700"
                    : "bg-neutral-100 text-neutral-400 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700"
                }`}
              >
                {isEdited(key) ? "edited" : "saved"}
              </span>
            </div>
          ))}
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