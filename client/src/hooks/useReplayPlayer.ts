import {useCallback, useEffect, useRef, useState} from "react";
import {WaggleData} from "../types";
import {BinaryReader, parseEntry} from "../parseBinary";

export interface ReplayState {
    frames: WaggleData[];
    frameIndex: number;
    isPlaying: boolean;
    speed: number;
    fileName: string;
}

function parseReplayFile(buffer: ArrayBuffer): WaggleData[] {
    const bytes = new Uint8Array(buffer);
    let headerEnd = 0;
    for (let i = 0; i < Math.min(bytes.length, 64); i++) {
        if (bytes[i] === 0x0a) {
            headerEnd = i + 1;
            break;
        }
    }
    const header = new TextDecoder().decode(bytes.slice(0, headerEnd));
    const expectedHeader = 'SCHEMA 3\n';
    if (header != expectedHeader) {
        alert("Found Header: " + header + "\nExpected Header: " + expectedHeader)
    }

    const frames: WaggleData[] = [];
    const view = new DataView(buffer);
    let pos = headerEnd;

    while (pos + 4 <= buffer.byteLength) {
        const recordLen = view.getUint32(pos, true);
        pos += 4;
        if (pos + recordLen > buffer.byteLength) break;

        const recordBuffer = buffer.slice(pos, pos + recordLen);
        const reader = new BinaryReader(recordBuffer);
        try {
            frames.push(parseEntry(reader));
        } catch {
            break;
        }
        pos += recordLen;
    }

    return frames;
}

export function useReplayPlayer() {
    const [replay, setReplay] = useState<ReplayState | null>(null);
    const [currentFrame, setCurrentFrame] = useState<WaggleData | null>(null);

    const playRef = useRef({
        isPlaying: false,
        speed: 1,
        idx: 0,
        frames: null as WaggleData[] | null,
    });

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

    const loadFile = useCallback((file: File) => {
        file.arrayBuffer().then((buffer) => {
            const frames = parseReplayFile(buffer);
            if (frames.length === 0) return;
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
        });
    }, []);

    const close = useCallback(() => {
        playRef.current.isPlaying = false;
        playRef.current.frames = null;
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
        close,
        setFrameIndex,
        togglePlay,
        setSpeed,
        stepForward,
        stepBackward,
    };
}
