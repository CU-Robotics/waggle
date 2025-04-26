import { GraphData } from "./types";

export function GraphDataToCSV(data: { [key: string]: GraphData[] }): string {
  const headers = Object.keys(data);

  const maxLen = Math.max(...headers.map((key) => data[key].length), 0);

  const rows: string[] = [];

  rows.push(headers.join(","));

  for (let i = 0; i < maxLen; i++) {
    const row = headers.map((key) => {
      const pt = data[key][i];
      return pt ? `"(${pt.x},${pt.y})"` : "";
    });
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
