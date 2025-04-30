import { GraphData } from "./types";

export function GraphDataToCSV(data: { [key: string]: GraphData[] }): string {
  const keys = Object.keys(data);

  const headers = [];
  for (const key of keys) {
    headers.push(`${key}_x`);
    headers.push(`${key}_y`);
  }

  const maxLen = Math.max(...keys.map((key) => data[key].length), 0);

  const rows: string[] = [];

  rows.push(headers.join(","));

  for (let i = 0; i < maxLen; i++) {
    const row = [];

    for (const key of keys) {
      const pt = data[key][i];
      if (pt) {
        row.push(pt.x);
        row.push(pt.y);
      } else {
        row.push("");
        row.push("");
      }
    }
    console.log(row);
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

export function saveFile(filename: string, text: string) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
