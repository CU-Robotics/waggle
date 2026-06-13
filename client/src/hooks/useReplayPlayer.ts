import { useCallback, useEffect, useRef, useState } from "react";
import { WaggleData } from "../types";
import { BinaryReader, createBlobUrl, parseEntry } from "../parseBinary";

const HEADER_SCAN_MAX_BYTES = 64;
const RECORD_LEN_BYTES = 4;
const PARSE_YIELD_BATCH = 250;
const PLAYBACK_TICK_MS = 16;
const MS_PER_SECOND = 1000;
// Timestamps above this magnitude are treated as milliseconds; below, as seconds.
const MS_TIMESTAMP_THRESHOLD = 1e11;

// Schemas the replay player can read. The binary layout is unchanged across
// these versions — newer schemas only add optional fields to the JSON metadata,
// which parseEntry tolerates via `?? defaults`. SCHEMA 5 wrote the full
// configurable_vars snapshot every frame; SCHEMA 6 writes a per-frame delta —
// both fold forward correctly under "apply each entry as an update".
const SUPPORTED_SCHEMAS = [4, 5, 6];

export interface ReplayState {
  frames: WaggleData[];
  frameIndex: number;
  isPlaying: boolean;
  speed: number;
  fileName: string;
}

export interface ReplayLoadingState {
  fileName: string;
  stage: "reading" | "parsing";
  progress: number;
  framesLoaded: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function readFileWithProgress(
  file: File,
  onProgress: (progress: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onProgress(1);
        resolve(reader.result);
        return;
      }
      reject(new Error("Replay file could not be read as an ArrayBuffer."));
    };
    reader.readAsArrayBuffer(file);
  });
}

function attachImageBlobUrls(frame: WaggleData) {
  for (const image of Object.values(frame.images)) {
    image.blob_url = createBlobUrl(image);
  }
}

function revokeReplayImageUrls(frames: WaggleData[] | null) {
  if (!frames) return;

  for (const frame of frames) {
    for (const image of Object.values(frame.images)) {
      if (image.blob_url) {
        URL.revokeObjectURL(image.blob_url);
        image.blob_url = undefined;
      }
    }
  }
}

async function parseReplayFile(
  buffer: ArrayBuffer,
  onProgress: (progress: number, framesLoaded: number) => void,
): Promise<WaggleData[]> {
  const bytes = new Uint8Array(buffer);
  let headerEnd = 0;
  for (let i = 0; i < Math.min(bytes.length, HEADER_SCAN_MAX_BYTES); i++) {
    if (bytes[i] === 0x0a) {
      headerEnd = i + 1;
      break;
    }
  }
  const header = new TextDecoder().decode(bytes.slice(0, headerEnd));
  const match = header.match(/^SCHEMA (\d+)\n$/);
  const version = match ? Number(match[1]) : NaN;
  if (!SUPPORTED_SCHEMAS.includes(version)) {
    alert(
      "Unsupported replay header: " +
        JSON.stringify(header) +
        "\nSupported schemas: " +
        SUPPORTED_SCHEMAS.join(", "),
    );
  }

  const frames: WaggleData[] = [];
  const view = new DataView(buffer);
  let pos = headerEnd;
  let recordsSinceYield = 0;

  // Each frame on disk carries only the configurable_vars *updates* (delta) since
  // the previous frame; fold them forward so frame.configurable_vars holds the
  // full state at that point in time. Older replays that wrote the full snapshot
  // every frame also fold correctly — re-applying the same keys is a no-op.
  let runningInts: { [k: string]: number } = {};
  let runningDoubles: { [k: string]: number } = {};
  let runningStrings: { [k: string]: string } = {};
  let runningVars = {
    configurable_ints: runningInts,
    configurable_doubles: runningDoubles,
    configurable_strings: runningStrings,
  };

  while (pos + RECORD_LEN_BYTES <= buffer.byteLength) {
    const recordLen = view.getUint32(pos, true);
    pos += RECORD_LEN_BYTES;
    if (pos + recordLen > buffer.byteLength) break;

    const recordBuffer = buffer.slice(pos, pos + recordLen);
    const reader = new BinaryReader(recordBuffer);
    try {
      const frame = parseEntry(reader);
      attachImageBlobUrls(frame);

      const updates = frame.configurable_vars;
      const intKeys = Object.keys(updates.configurable_ints);
      const doubleKeys = Object.keys(updates.configurable_doubles);
      const stringKeys = Object.keys(updates.configurable_strings);
      if (intKeys.length > 0 || doubleKeys.length > 0 || stringKeys.length > 0) {
        runningInts = { ...runningInts, ...updates.configurable_ints };
        runningDoubles = { ...runningDoubles, ...updates.configurable_doubles };
        runningStrings = { ...runningStrings, ...updates.configurable_strings };
        runningVars = {
          configurable_ints: runningInts,
          configurable_doubles: runningDoubles,
          configurable_strings: runningStrings,
        };
      }
      frame.configurable_vars = runningVars;

      frames.push(frame);
    } catch {
      break;
    }
    pos += recordLen;

    recordsSinceYield++;
    if (recordsSinceYield >= PARSE_YIELD_BATCH) {
      recordsSinceYield = 0;
      onProgress(pos / buffer.byteLength, frames.length);
      await nextFrame();
    }
  }

  onProgress(1, frames.length);
  return frames;
}

export function useReplayPlayer() {
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [currentFrame, setCurrentFrame] = useState<WaggleData | null>(null);
  const [loadingReplay, setLoadingReplay] = useState<ReplayLoadingState | null>(
    null,
  );
  const loadIdRef = useRef(0);

  const playRef = useRef({
    isPlaying: false,
    speed: 1,
    idx: 0,
    frames: null as WaggleData[] | null,
  });

  const syncState = useCallback(
    (idx: number, frames: WaggleData[], playing: boolean) => {
      setReplay((prev) =>
        prev ? { ...prev, frameIndex: idx, isPlaying: playing } : null,
      );
      setCurrentFrame(frames[idx]);
    },
    [],
  );

  const loadFile = useCallback((file: File) => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    playRef.current.isPlaying = false;
    revokeReplayImageUrls(playRef.current.frames);
    playRef.current.frames = null;
    setReplay(null);
    setCurrentFrame(null);
    setLoadingReplay({
      fileName: file.name,
      stage: "reading",
      progress: 0,
      framesLoaded: 0,
    });

    readFileWithProgress(file, (progress) => {
      if (loadIdRef.current !== loadId) return;
      setLoadingReplay({
        fileName: file.name,
        stage: "reading",
        progress,
        framesLoaded: 0,
      });
    })
      .then(async (buffer) => {
        if (loadIdRef.current !== loadId) return;
        setLoadingReplay({
          fileName: file.name,
          stage: "parsing",
          progress: 0,
          framesLoaded: 0,
        });
        await nextFrame();

        const frames = await parseReplayFile(
          buffer,
          (progress, framesLoaded) => {
            if (loadIdRef.current !== loadId) return;
            setLoadingReplay({
              fileName: file.name,
              stage: "parsing",
              progress,
              framesLoaded,
            });
          },
        );

        if (loadIdRef.current !== loadId) {
          revokeReplayImageUrls(frames);
          return;
        }
        if (frames.length === 0) {
          revokeReplayImageUrls(frames);
          return;
        }
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
      })
      .catch((error: unknown) => {
        if (loadIdRef.current !== loadId) return;
        console.error("Failed to load replay", error);
        alert("Failed to load replay file.");
      })
      .finally(() => {
        if (loadIdRef.current === loadId) {
          setLoadingReplay(null);
        }
      });
  }, []);

  const close = useCallback(() => {
    loadIdRef.current += 1;
    playRef.current.isPlaying = false;
    revokeReplayImageUrls(playRef.current.frames);
    playRef.current.frames = null;
    setReplay(null);
    setCurrentFrame(null);
    setLoadingReplay(null);
  }, []);

  useEffect(() => {
    return () => {
      revokeReplayImageUrls(playRef.current.frames);
      playRef.current.frames = null;
    };
  }, []);

  const setFrameIndex = useCallback(
    (index: number) => {
      const { frames } = playRef.current;
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
    setReplay((prev) => (prev ? { ...prev, isPlaying: p.isPlaying } : null));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    playRef.current.speed = speed;
    setReplay((prev) => (prev ? { ...prev, speed } : null));
  }, []);

  const stepForward = useCallback(() => {
    const { frames, idx } = playRef.current;
    if (!frames) return;
    const next = Math.min(idx + 1, frames.length - 1);
    playRef.current.idx = next;
    syncState(next, frames, false);
    playRef.current.isPlaying = false;
  }, [syncState]);

  const stepBackward = useCallback(() => {
    const { frames, idx } = playRef.current;
    if (!frames) return;
    const prev = Math.max(idx - 1, 0);
    playRef.current.idx = prev;
    syncState(prev, frames, false);
    playRef.current.isPlaying = false;
  }, [syncState]);

  useEffect(() => {
    const p = playRef.current;
    if (!p.isPlaying || !p.frames) return;

    const { frames } = p;
    const t0 = frames[0].sent_timestamp;

    const msPerUnit = t0 > MS_TIMESTAMP_THRESHOLD ? 1 : MS_PER_SECOND;

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
    }, PLAYBACK_TICK_MS);

    return () => clearInterval(interval);
  }, [replay?.isPlaying, syncState]);

  return {
    replay,
    currentFrame,
    loadingReplay,
    loadFile,
    close,
    setFrameIndex,
    togglePlay,
    setSpeed,
    stepForward,
    stepBackward,
  };
}
