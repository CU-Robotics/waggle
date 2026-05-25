import type { WaggleData, WaggleNonImageData, ImageData } from "./types";

export class BinaryReader {
  private view: DataView;
  private pos: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  readU32(): number {
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readI32(): number {
    const val = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readU8(): number {
    const val = this.view.getUint8(this.pos);
    this.pos += 1;
    return val;
  }

  readBytes(len: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.pos, len);
    this.pos += len;
    return new Uint8Array(bytes);
  }

  readString(len: number): string {
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
}

export function createBlobUrl(image: ImageData): string {
  const blob = new Blob([image.image_data], { type: "image/jpeg" });
  return URL.createObjectURL(blob);
}

export function parseEntry(reader: BinaryReader): WaggleData {
  const jsonLen = reader.readU32();
  const jsonStr = reader.readString(jsonLen);
  const meta: WaggleNonImageData = JSON.parse(jsonStr);

  const numImages = reader.readU32();
  const images: { [key: string]: ImageData } = {};

  for (let i = 0; i < numImages; i++) {
    const nameLen = reader.readU32();
    const name = reader.readString(nameLen);
    const scale = reader.readI32();
    const flip = reader.readU8() !== 0;
    const show_base = reader.readU8() !== 0;
    const dataLen = reader.readU32();
    const image_data = reader.readBytes(dataLen);
    const svgLen = reader.readU32();
    const svg_overlays: { [key: string]: string } =
      svgLen > 0
        ? JSON.parse(reader.readString(svgLen))
        : {};
    const image = {
      image_data,
      scale,
      flip,
      show_base,
      svg_overlays,
    };
    images[name] = image;
  }

  return {
    sent_timestamp: meta.sent_timestamp,
    images,
    svg_data: meta.svg_data ?? {},
    graph_data: meta.graph_data ?? {},
    string_data: meta.string_data ?? {},
    log_data: meta.log_data ?? {},
    configurable_vars: meta.configurable_vars ?? {
      configurable_ints: {},
      configurable_doubles: {},
    },
  };
}

export function parseBatch(buffer: ArrayBuffer): WaggleData[] {
  const reader = new BinaryReader(buffer);
  const numEntries = reader.readU32();
  const entries: WaggleData[] = [];
  for (let i = 0; i < numEntries; i++) {
    reader.readU32();
    entries.push(parseEntry(reader));
  }
  return entries;
}
