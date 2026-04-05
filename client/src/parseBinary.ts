import type { WaggleData, WaggleNonImageData, ImageData } from "./types";

export class BinaryReader {
    private view: DataView;
    private pos: number;

    constructor(buffer: ArrayBuffer, offset: number = 0) {
        this.view = new DataView(buffer);
        this.pos = offset;
    }

    get position(): number {
        return this.pos;
    }

    get byteLength(): number {
        return this.view.byteLength;
    }

    remaining(): number {
        return this.view.byteLength - this.pos;
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
        if (this.pos + len > this.view.byteLength) {
            throw new Error(`[parseBinary] readBytes overflow: pos=${this.pos}, len=${len}, bufLen=${this.view.byteLength}`);
        }
        const bytes = new Uint8Array(this.view.buffer, this.pos, len);
        this.pos += len;
        return bytes;
    }

    skip(len: number): void {
        this.pos += len;
    }

    readString(len: number): string {
        const bytes = this.readBytes(len);
        return new TextDecoder().decode(bytes);
    }
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
        const dataLen = reader.readU32();
        const image_data = reader.readBytes(dataLen).slice();
        images[name] = {
            image_data,
            scale,
            flip,
        };
    }

    return {
        sent_timestamp: meta.sent_timestamp,
        images,
        svg_data: meta.svg_data ?? {},
        graph_data: meta.graph_data ?? {},
        string_data: meta.string_data ?? {},
        log_data: meta.log_data ?? {},
    };
}

export function parseEntryMetadataOnly(reader: BinaryReader): WaggleData {
    const jsonLen = reader.readU32();
    const jsonStr = reader.readString(jsonLen);
    const meta: WaggleNonImageData = JSON.parse(jsonStr);

    // Skip over all image data without allocating
    const numImages = reader.readU32();
    for (let i = 0; i < numImages; i++) {
        const nameLen = reader.readU32();
        reader.skip(nameLen);  // name
        reader.skip(4);        // scale (i32)
        reader.skip(1);        // flip (u8)
        const dataLen = reader.readU32();
        reader.skip(dataLen);  // image bytes
    }

    return {
        sent_timestamp: meta.sent_timestamp,
        images: {},
        svg_data: meta.svg_data ?? {},
        graph_data: meta.graph_data ?? {},
        string_data: meta.string_data ?? {},
        log_data: meta.log_data ?? {},
    };
}

export function createBlobUrl(img: ImageData): string {
    const blob = new Blob([img.image_data], { type: "image/jpeg" });
    return URL.createObjectURL(blob);
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
