/**
 * Builds an AVI file with MJPEG codec from raw JPEG frames.
 * Each frame's JPEG data is stored as-is — no re-encoding or quality loss.
 */
export function buildAviMjpeg(width: number, height: number, fps: number, frames: Uint8Array[]): Blob {
    const totalFrames = frames.length;
    const paddedSizes = frames.map(f => f.byteLength + (f.byteLength % 2));
    const moviDataSize = paddedSizes.reduce((sum, s) => sum + 8 + s, 0);
    const maxFrameSize = Math.max(...frames.map(f => f.byteLength));

    const avihSize = 56;
    const strhSize = 56;
    const strfSize = 40;
    const strlSize = 4 + (8 + strhSize) + (8 + strfSize);
    const hdrlSize = 4 + (8 + avihSize) + (8 + strlSize);
    const moviSize = 4 + moviDataSize;
    const idx1Size = totalFrames * 16;
    const riffSize = 4 + (8 + hdrlSize) + (8 + moviSize) + (8 + idx1Size);

    // Header: RIFF + hdrl
    const headerLen = 12 + 8 + hdrlSize; // RIFF(12) + LIST+hdrlSize+hdrl content
    const header = new ArrayBuffer(headerLen);
    const h = new DataView(header);
    let p = 0;

    const wStr = (s: string) => { for (let i = 0; i < s.length; i++) h.setUint8(p + i, s.charCodeAt(i)); p += s.length; };
    const wU32 = (v: number) => { h.setUint32(p, v, true); p += 4; };
    const wU16 = (v: number) => { h.setUint16(p, v, true); p += 2; };
    const wI16 = (v: number) => { h.setInt16(p, v, true); p += 2; };

    // RIFF
    wStr("RIFF"); wU32(riffSize); wStr("AVI ");

    // hdrl LIST
    wStr("LIST"); wU32(hdrlSize); wStr("hdrl");

    // avih
    wStr("avih"); wU32(avihSize);
    wU32(Math.round(1_000_000 / fps)); // dwMicroSecPerFrame
    wU32(maxFrameSize * fps);          // dwMaxBytesPerSec
    wU32(0);                           // dwPaddingGranularity
    wU32(0x10);                        // dwFlags = AVIF_HASINDEX
    wU32(totalFrames);
    wU32(0);                           // dwInitialFrames
    wU32(1);                           // dwStreams
    wU32(maxFrameSize);                // dwSuggestedBufferSize
    wU32(width); wU32(height);
    wU32(0); wU32(0); wU32(0); wU32(0); // reserved

    // strl LIST
    wStr("LIST"); wU32(strlSize); wStr("strl");

    // strh
    wStr("strh"); wU32(strhSize);
    wStr("vids");                      // fccType
    wStr("MJPG");                      // fccHandler
    wU32(0);                           // dwFlags
    wU16(0); wU16(0);                  // wPriority, wLanguage
    wU32(0);                           // dwInitialFrames
    wU32(1);                           // dwScale
    wU32(fps);                         // dwRate
    wU32(0);                           // dwStart
    wU32(totalFrames);                 // dwLength
    wU32(maxFrameSize);                // dwSuggestedBufferSize
    wU32(0xFFFFFFFF);                  // dwQuality = -1
    wU32(0);                           // dwSampleSize
    wI16(0); wI16(0);                  // rcFrame left, top
    wI16(width); wI16(height);         // rcFrame right, bottom

    // strf (BITMAPINFOHEADER)
    wStr("strf"); wU32(strfSize);
    wU32(40);                          // biSize
    wU32(width);
    wU32(height);
    wU16(1);                           // biPlanes
    wU16(24);                          // biBitCount
    wStr("MJPG");                      // biCompression
    wU32(width * height * 3);          // biSizeImage
    wU32(0); wU32(0);                  // biXPelsPerMeter, biYPelsPerMeter
    wU32(0); wU32(0);                  // biClrUsed, biClrImportant

    // movi LIST header
    const moviHeader = new ArrayBuffer(12);
    const mh = new DataView(moviHeader);
    setFourCC(mh, 0, "LIST");
    mh.setUint32(4, moviSize, true);
    setFourCC(mh, 8, "movi");

    // Assemble blob parts: header, movi header, frame chunks, idx1
    const parts: BlobPart[] = [header, moviHeader];
    const padByte = new Uint8Array([0]);

    for (let i = 0; i < totalFrames; i++) {
        const chunkHeader = new ArrayBuffer(8);
        const ch = new DataView(chunkHeader);
        setFourCC(ch, 0, "00dc");
        ch.setUint32(4, frames[i].byteLength, true);
        parts.push(chunkHeader);
        parts.push(frames[i]);
        if (frames[i].byteLength % 2 !== 0) {
            parts.push(padByte);
        }
    }

    // idx1
    const idx1Header = new ArrayBuffer(8);
    const idxh = new DataView(idx1Header);
    setFourCC(idxh, 0, "idx1");
    idxh.setUint32(4, idx1Size, true);
    parts.push(idx1Header);

    let moviOffset = 4; // first chunk starts 4 bytes after 'movi' fourcc
    for (let i = 0; i < totalFrames; i++) {
        const entry = new ArrayBuffer(16);
        const e = new DataView(entry);
        setFourCC(e, 0, "00dc");
        e.setUint32(4, 0x10, true);                  // AVIIF_KEYFRAME
        e.setUint32(8, moviOffset, true);
        e.setUint32(12, frames[i].byteLength, true);
        parts.push(entry);
        moviOffset += 8 + paddedSizes[i];
    }

    return new Blob(parts, {type: "video/avi"});
}

function setFourCC(view: DataView, offset: number, s: string) {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
