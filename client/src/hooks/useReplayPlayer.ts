import {useCallback, useEffect, useRef, useState} from "react";
import {ImageData, WaggleData} from "../types";
import {BinaryReader, parseEntry, parseEntryMetadataOnly} from "../parseBinary";

interface FrameRecord {
    /** byte offset of the record payload in the file (after the 4-byte length prefix) */
    fileOffset: number;
    /** byte length of the record payload */
    recordLen: number;
}

export interface ReplayState {
    frames: WaggleData[];
    frameIndex: number;
    isPlaying: boolean;
    speed: number;
    fileName: string;
}

interface ParseResult {
    frames: WaggleData[];
    frameRecords: FrameRecord[];
}

async function parseReplayFileStreaming(file: File, onProgress?: (progress: number) => void): Promise<ParseResult> {
    const fileSize = file.size;
    console.log(`[replay] streaming parse (metadata-only): ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

    const frames: WaggleData[] = [];
    const frameRecords: FrameRecord[] = [];
    let leftover = new Uint8Array(0);
    let totalBytesRead = 0;
    /** Tracks absolute file position at the start of the current merged buffer */
    let filePositionAtMergeStart = 0;
    let headerParsed = false;
    let headerEnd = 0;
    let errorCount = 0;

    const stream = file.stream() as ReadableStream<Uint8Array>;
    const reader = stream.getReader();

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        totalBytesRead += value.byteLength;
        filePositionAtMergeStart = totalBytesRead - value.byteLength - leftover.length;

        // Merge leftover with new chunk
        const merged = new Uint8Array(leftover.length + value.byteLength);
        merged.set(leftover, 0);
        merged.set(value, leftover.length);

        let pos = 0;

        // Parse header from the first chunk
        if (!headerParsed) {
            for (let i = 0; i < Math.min(merged.length, 64); i++) {
                if (merged[i] === 0x0a) {
                    headerEnd = i + 1;
                    break;
                }
            }
            if (headerEnd === 0) {
                leftover = merged;
                continue;
            }
            const header = new TextDecoder().decode(merged.slice(0, headerEnd));
            const expectedHeader = 'SCHEMA 3\n';
            if (header !== expectedHeader) {
                console.error(`[replay] header mismatch: got "${header}", expected "${expectedHeader}"`);
                alert("Found Header: " + header + "\nExpected Header: " + expectedHeader);
            }
            console.log(`[replay] header OK`);
            headerParsed = true;
            pos = headerEnd;
        }

        // Parse as many complete records as possible from the merged buffer
        const view = new DataView(merged.buffer, merged.byteOffset, merged.byteLength);
        while (pos + 4 <= merged.length) {
            const recordLen = view.getUint32(pos, true);
            if (pos + 4 + recordLen > merged.length) {
                break;
            }

            const recordFileOffset = filePositionAtMergeStart + pos + 4;
            pos += 4;

            const recordReader = new BinaryReader(merged.buffer, merged.byteOffset + pos);
            try {
                frames.push(parseEntryMetadataOnly(recordReader));
                frameRecords.push({fileOffset: recordFileOffset, recordLen});
            } catch (e) {
                errorCount++;
                console.error(`[replay] parse error at frame ${frames.length}:`, e);
                if (errorCount > 10) {
                    console.error(`[replay] too many errors, aborting`);
                    reader.cancel();
                    return {frames, frameRecords};
                }
            }
            pos += recordLen;

            if (frames.length % 10000 === 0) {
                console.log(`[replay] indexed ${frames.length} frames (${((totalBytesRead / fileSize) * 100).toFixed(1)}% read)`);
            }
        }

        leftover = merged.slice(pos);
        if (onProgress) {
            onProgress(totalBytesRead / fileSize);
            // Yield to the browser so React can repaint the progress bar
            await new Promise(r => setTimeout(r, 0));
        }
    }

    onProgress?.(1);
    if (leftover.length > 0) {
        console.warn(`[replay] ${leftover.length} trailing bytes not parsed`);
    }

    console.log(`[replay] done: ${frames.length} frames indexed, ${errorCount} errors`);
    return {frames, frameRecords};
}

async function loadImagesForFrame(file: File, record: FrameRecord): Promise<{ [key: string]: ImageData }> {
    const blob = file.slice(record.fileOffset, record.fileOffset + record.recordLen);
    const buffer = await blob.arrayBuffer();
    const reader = new BinaryReader(buffer);
    const frame = parseEntry(reader);
    return frame.images;
}

export function useReplayPlayer() {
    const [replay, setReplay] = useState<ReplayState | null>(null);
    const [currentFrame, setCurrentFrame] = useState<WaggleData | null>(null);
    /** Loading progress from 0 to 1, or null when not loading */
    const [loadingProgress, setLoadingProgress] = useState<number | null>(null);

    const playRef = useRef({
        isPlaying: false,
        speed: 1,
        idx: 0,
        frames: null as WaggleData[] | null,
    });

    const fileRef = useRef<File | null>(null);
    const frameRecordsRef = useRef<FrameRecord[]>([]);

    const syncState = useCallback(
        (idx: number, frames: WaggleData[], playing: boolean) => {
            setReplay((prev) =>
                prev
                    ? {...prev, frameIndex: idx, isPlaying: playing}
                    : null,
            );
            setCurrentFrame(frames[idx]);
        },
        [],
    );

    const getImagesForFrame = useCallback(async (frameIdx: number): Promise<{ [key: string]: ImageData }> => {
        const file = fileRef.current;
        const records = frameRecordsRef.current;
        if (!file || frameIdx < 0 || frameIdx >= records.length) return {};
        return loadImagesForFrame(file, records[frameIdx]);
    }, []);

    const loadFile = useCallback((file: File) => {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        console.log(`[replay] loading file: ${file.name} (${sizeMB} MB)`);
        const startTime = performance.now();
        setLoadingProgress(0);

        parseReplayFileStreaming(file, setLoadingProgress).then(({frames, frameRecords}) => {
            setLoadingProgress(null);
            const elapsed = performance.now() - startTime;
            console.log(`[replay] indexed in ${(elapsed / 1000).toFixed(1)}s`);

            if (frames.length === 0) {
                console.warn(`[replay] no frames parsed from file`);
                return;
            }
            console.log(`[replay] loaded ${frames.length} frames, setting up player`);
            fileRef.current = file;
            frameRecordsRef.current = frameRecords;
            playRef.current = {
                isPlaying: false,
                speed: 1,
                idx: 0,
                frames,
            };
            setReplay({
                frames,
                frameIndex: 0,
                isPlaying: false,
                speed: 1,
                fileName: file.name,
            });
            setCurrentFrame(frames[0]);
        }).catch((err) => {
            setLoadingProgress(null);
            console.error(`[replay] failed to parse file (${sizeMB} MB):`, err);
            alert(`Failed to load replay file (${sizeMB} MB). Error: ${err.message}`);
        });
    }, []);

    const close = useCallback(() => {
        playRef.current.isPlaying = false;
        playRef.current.frames = null;
        fileRef.current = null;
        frameRecordsRef.current = [];
        setReplay(null);
        setCurrentFrame(null);
    }, []);

    const setFrameIndex = useCallback(
        (index: number) => {
            const {frames} = playRef.current;
            if (!frames) return;
            const clamped = Math.max(0, Math.min(index, frames.length - 1));
            playRef.current.idx = clamped;
            syncState(clamped, frames, playRef.current.isPlaying);
        },
        [syncState],
    );

    const togglePlay = useCallback(() => {
        const p = playRef.current;
        if (!p.frames) return;
        p.isPlaying = !p.isPlaying;
        setReplay((prev) =>
            prev ? {...prev, isPlaying: p.isPlaying} : null,
        );
    }, []);

    const setSpeed = useCallback((speed: number) => {
        playRef.current.speed = speed;
        setReplay((prev) => (prev ? {...prev, speed} : null));
    }, []);

    const stepForward = useCallback(() => {
        const {frames, idx} = playRef.current;
        if (!frames) return;
        const next = Math.min(idx + 1, frames.length - 1);
        playRef.current.idx = next;
        syncState(next, frames, false);
        playRef.current.isPlaying = false;
    }, [syncState]);

    const stepBackward = useCallback(() => {
        const {frames, idx} = playRef.current;
        if (!frames) return;
        const prev = Math.max(idx - 1, 0);
        playRef.current.idx = prev;
        syncState(prev, frames, false);
        playRef.current.isPlaying = false;
    }, [syncState]);

    useEffect(() => {
        const p = playRef.current;
        if (!p.isPlaying || !p.frames) return;

        const {frames} = p;
        const t0 = frames[0].sent_timestamp;

        const msPerUnit = t0 > 1e11 ? 1 : 1000;

        let elapsed = (frames[p.idx].sent_timestamp - t0) * msPerUnit;
        let lastTime = performance.now();

        const interval = setInterval(() => {
            if (!p.isPlaying) {
                clearInterval(interval);
                return;
            }

            const now = performance.now();
            elapsed += (now - lastTime) * p.speed;
            lastTime = now;

            let advanced = false;
            while (p.idx < frames.length - 1) {
                const nextMs = (frames[p.idx + 1].sent_timestamp - t0) * msPerUnit;
                if (nextMs > elapsed) break;
                p.idx++;
                advanced = true;
            }

            if (advanced) {
                syncState(p.idx, frames, true);
            }

            if (p.idx >= frames.length - 1) {
                p.isPlaying = false;
                syncState(p.idx, frames, false);
                clearInterval(interval);
            }
        }, 16);

        return () => clearInterval(interval);
    }, [replay?.isPlaying, syncState]);

    return {
        replay,
        currentFrame,
        loadFile,
        loadingProgress,
        close,
        setFrameIndex,
        togglePlay,
        setSpeed,
        stepForward,
        stepBackward,
        getImagesForFrame,
    };
}
