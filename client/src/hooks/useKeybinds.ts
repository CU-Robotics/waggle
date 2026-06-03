import { useEffect, useRef } from "react";

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

interface UseKeybindsOptions {
    enabled?: boolean;
    ignoreWhenTyping?: boolean; // skip if focus is in input/textarea
}

export function useKeybinds(
    keyMap: KeyMap,
    { enabled = true, ignoreWhenTyping = true }: UseKeybindsOptions = {}
) {
    const keyMapRef = useRef(keyMap);
    keyMapRef.current = keyMap;

    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            if (ignoreWhenTyping) {
                const tag = (e.target as HTMLElement).tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) {
                    return;
                }
            }

            const parts: string[] = [];
            if (e.ctrlKey || e.metaKey) parts.push("ctrl");
            if (e.shiftKey) parts.push("shift");
            if (e.altKey) parts.push("alt");
            parts.push(e.key.toLowerCase());

            const combo = parts.join("+");
            if (keyMapRef.current[combo]) {
                e.preventDefault();
                keyMapRef.current[combo](e);
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [enabled, ignoreWhenTyping]);
}