import React, { useEffect, useRef, useCallback, useState } from "react";
import gsap from "gsap";
import "./App.css";

const TOTAL_W = 560;
const TOTAL_H = 315;
const GAP = 4;
const CENTER_W = TOTAL_W - 2 * GAP;
const SVG_SCALE = CENTER_W / 400;
const SVG_H = Math.round(225 * SVG_SCALE);
const SVG_TOP = Math.round((TOTAL_H - SVG_H) / 2);

interface MouthParams {
    x0: number;
    x1: number;
    cy: number;
    upperBow: number;
    lowerDrop: number;
    cornerLift: number;
}

const MOUTH: Record<string, MouthParams> = {
    rest:  { x0: 138, x1: 222, cy: 156, upperBow: -8.2,  lowerDrop: 12,   cornerLift: 9  },
    ah:    { x0: 142, x1: 218, cy: 157, upperBow: -12, lowerDrop: 24,  cornerLift: 0  },
    ee:    { x0: 120, x1: 240, cy: 157, upperBow: -6,  lowerDrop: 6,   cornerLift: 4  },
    oh:    { x0: 158, x1: 202, cy: 157, upperBow: -16, lowerDrop: 22,  cornerLift: 0  },
    oo:    { x0: 166, x1: 194, cy: 157, upperBow: -10, lowerDrop: 14,  cornerLift: 0  },
    ww:    { x0: 170, x1: 190, cy: 157, upperBow: -8,  lowerDrop: 12,  cornerLift: 0  },
    mm:    { x0: 140, x1: 220, cy: 157, upperBow: -2,  lowerDrop: 2,   cornerLift: 3  },
    ff:    { x0: 140, x1: 220, cy: 157, upperBow: -2,  lowerDrop: 10,  cornerLift: 1  },
    th:    { x0: 140, x1: 220, cy: 157, upperBow: -4,  lowerDrop: 8,   cornerLift: 0  },
    ss:    { x0: 136, x1: 224, cy: 157, upperBow: -3,  lowerDrop: 5,   cornerLift: 1  },
    ch:    { x0: 160, x1: 200, cy: 157, upperBow: -12, lowerDrop: 18,  cornerLift: 0  },
    ll:    { x0: 128, x1: 232, cy: 157, upperBow: -8,  lowerDrop: 12,  cornerLift: 2  },
};

function mouthPath(p: MouthParams): string {
    const { x0, x1, cy, upperBow, lowerDrop, cornerLift } = p;
    const mx = (x0 + x1) / 2;
    const cy0 = cy - cornerLift;
    const ux = mx;
    const uy = cy + upperBow;
    const ly = cy + lowerDrop;

    return [
        `M ${x0},${cy0}`,
        `C ${x0 + (mx - x0) * 0.4},${cy0} ${ux - 10},${uy} ${ux},${uy}`,
        `C ${ux + 10},${uy} ${x1 - (x1 - mx) * 0.4},${cy0} ${x1},${cy0}`,
        `C ${x1 - (x1 - mx) * 0.3},${cy0 + lowerDrop * 0.5} ${ux + 12},${ly} ${ux},${ly}`,
        `C ${ux - 12},${ly} ${x0 + (mx - x0) * 0.3},${cy0 + lowerDrop * 0.5} ${x0},${cy0}`,
        "Z",
    ].join(" ");
}

function charToPhon(ch: string): string {
    const c = ch.toLowerCase();
    if (c === "a")                         return "ah";
    if (c === "e" || c === "i")            return "ee";
    if (c === "o")                         return "oh";
    if (c === "u")                         return "oo";
    if ("mbp".includes(c))                 return "mm";
    if ("fv".includes(c))                  return "ff";
    if (c === "t" || c === "d")            return "th";
    if (c === "s" || c === "z")            return "ss";
    if (c === "c" || c === "j" || c === "q") return "ch";
    if (c === "l" || c === "r")            return "ll";
    if (c === "w" || c === "y")            return "ww";
    if ("kgxh".includes(c))               return "ah";
    if (c === "n")                         return "mm";
    if (" \t\n".includes(c))              return "rest";
    return "mm";
}

interface BotMessage {
    type: "speak" | "emotion" | "beep" | "state" | "processing";
    text?: string;
    emotion?: string;
    state?: string;
    timestamp?: number;
}

type AnimName = "neutral" | "speak" | "surprised" | "processing";

export default function App() {
    const svgRef         = useRef<SVGSVGElement>(null);
    const [activeAnim, setActiveAnim] = useState<AnimName>("neutral");
    const [speakText, setSpeakText]   = useState("");
    const [connected, setConnected]   = useState(false);
    const [botState, setBotState]     = useState("idle");
    const [spokenCount, setSpokenCount] = useState(0);
    const [speakingDone, setSpeakingDone] = useState(true);
    const idleKilledRef  = useRef(false);
    const speakTlRef     = useRef<gsap.core.Timeline | null>(null);
    const processingTlRef = useRef<gsap.core.Timeline | null>(null);
    const matrixIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [matrixCharsL, setMatrixCharsL] = useState<{char: string; y: number; opacity: number}[]>([]);
    const [matrixCharsR, setMatrixCharsR] = useState<{char: string; y: number; opacity: number}[]>([]);
    const mouthParamsRef = useRef<MouthParams>({ ...MOUTH.rest });
    const wsRef                = useRef<WebSocket | null>(null);
    const handleBotMessageRef  = useRef<(data: BotMessage) => void>(() => {});

    const tweenMouth = useCallback((target: MouthParams, duration: number, ease = "power1.inOut") => {
        const el = document.getElementById("mouth");
        if (!el) return;
        gsap.to(mouthParamsRef.current, {
            ...target,
            duration,
            ease,
            onUpdate() {
                el.setAttribute("d", mouthPath(mouthParamsRef.current));
            },
        });
    }, []);

    const killIdle = useCallback(() => { idleKilledRef.current = true; }, []);

    const restoreNeutral = useCallback((instant = false) => {
        idleKilledRef.current = false;
        const d = instant ? 0 : 0.4;
        gsap.to(["#pupilLeft", "#pupilRight"], { attr: { rx: 12, ry: 18 }, duration: d, ease: "power2.out" });
        gsap.to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: d, ease: "power2.out" });
        gsap.to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: d, ease: "power2.out" });
        tweenMouth(MOUTH.rest, instant ? 0 : 0.4, "power2.out");
        gsap.to("#faceGroup", { x: 0, y: 0, duration: d });
    }, [tweenMouth]);

    const playSurprised = useCallback(() => {
        killIdle();
        gsap.timeline()
            .call(() => tweenMouth(MOUTH.oh, 0.24, "power3.out"))
            .to(["#pupilLeft","#pupilRight"], { attr: { ry: 12, rx: 18 }, duration: 0.3, ease: "elastic.out(1,0.4)" }, 0)
            .to("#browLeft",  { attr: { d: "M100 36 Q120 22 140 36" }, duration: 0.35, ease: "power3.out" }, 0)
            .to("#browRight", { attr: { d: "M220 36 Q240 22 260 36" }, duration: 0.35, ease: "power3.out" }, 0)
            .to("#faceGroup", { y: -6,  duration: 0.12, ease: "power2.out" }, 0)
            .to("#faceGroup", { y: 0,   duration: 0.4,  ease: "bounce.out" })
            .to({}, { duration: 0.88 })
            .to(["#pupilLeft","#pupilRight"], { attr: { ry: 18, rx: 12 }, duration: 0.6, ease: "power2.inOut" })
            .to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: 0.6, ease: "power2.out" }, "<")
            .to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: 0.6, ease: "power2.out" }, "<")
            .call(() => tweenMouth(MOUTH.rest, 0.6, "power2.out"));
    }, [killIdle, tweenMouth]);

    const playSpeak = useCallback((text: string) => {
        if (!text.trim()) return;
        killIdle();
        if (speakTlRef.current) speakTlRef.current.kill();
        setSpokenCount(0);
        setSpeakingDone(false);

        const PER_CHAR  = 0.11;
        const BLEND     = 0.08;

        // Duration multiplier per character type
        const charDur = (ch: string): number => {
            if (/[.!?]/.test(ch))    return 3.2;  // sentence-end pause
            if (/[,;:]/.test(ch))    return 1.8;  // mid-sentence pause
            if (/[-–—]/.test(ch))    return 1.4;  // dash pause
            if (/\s/.test(ch))       return 0.7;  // word gap (shorter than consonant)
            return 1.0;
        };

        const tl = gsap.timeline({
            onComplete: () => {
                tweenMouth(MOUTH.rest, 0.25);
                gsap.to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: 0.4 });
                gsap.to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: 0.4 });
                idleKilledRef.current = false;
                setSpeakingDone(true);
            },
        });
        speakTlRef.current = tl;

        tl.to("#browLeft",  { attr: { d: "M100 40 Q120 26 140 40" }, duration: 0.3 }, 0)
            .to("#browRight", { attr: { d: "M220 40 Q240 26 260 40" }, duration: 0.3 }, 0);

        let cursor = 0.05;
        let charIdx = 0;
        for (const ch of text) {
            const params = MOUTH[charToPhon(ch)];
            const capturedIdx = charIdx;
            tl.call(() => {
                tweenMouth(params, BLEND, "power1.inOut");
                setSpokenCount(capturedIdx + 1);
            }, [], cursor);
            const step = PER_CHAR * charDur(ch);
            cursor += step;
            if (!/\s/.test(ch)) {
                tl.call(() => tweenMouth(MOUTH.rest, BLEND * 0.88, "power1.in"), [], cursor - BLEND * 0.45);
            }
            charIdx++;
        }
    }, [killIdle, tweenMouth]);

    // ---- Manual controls ----
    const stopProcessing = useCallback(() => {
        if (processingTlRef.current) { processingTlRef.current.kill(); processingTlRef.current = null; }
        if (matrixIntervalRef.current) { clearInterval(matrixIntervalRef.current); matrixIntervalRef.current = null; }
        setMatrixCharsL([]);
        setMatrixCharsR([]);
    }, []);

    const handleNeutral = useCallback(() => {
        setActiveAnim("neutral");
        if (speakTlRef.current) speakTlRef.current.kill();
        stopProcessing();
        restoreNeutral();
    }, [restoreNeutral, stopProcessing]);

    const handleSurprised = useCallback(() => {
        setActiveAnim("surprised");
        if (speakTlRef.current) speakTlRef.current.kill();
        stopProcessing();
        restoreNeutral(true);
        gsap.delayedCall(0.04, playSurprised);
    }, [restoreNeutral, playSurprised, stopProcessing]);

    // ---- Speak handlers (manual + WebSocket) ----
    const handleSpeakWithText = useCallback((text: string) => {
        if (!text.trim()) return;
        setActiveAnim("speak");
        killIdle();
        stopProcessing();
        restoreNeutral(true);
        setSpeakText(text);
        gsap.delayedCall(0.04, () => playSpeak(text));
    }, [restoreNeutral, playSpeak, killIdle, stopProcessing]);

    const playProcessing = useCallback(() => {
        killIdle();
        stopProcessing();

        gsap.to("#browLeft",  { attr: { d: "M100 41 Q120 30 140 44" }, duration: 0.4, ease: "power2.out" });
        gsap.to("#browRight", { attr: { d: "M220 44 Q240 33 260 43" }, duration: 0.4, ease: "power2.out" });
        gsap.to("#pupilLeft",  { attr: { ry: 13, rx: 11 }, duration: 0.35, ease: "power2.out" });
        gsap.to("#pupilRight", { attr: { ry: 15, rx: 11 }, duration: 0.35, ease: "power2.out" });
        tweenMouth(MOUTH.rest, 0.55);

        gsap.to(["#pupilLeft", "#pupilRight"], {
            attr: { ry: 15, rx: 12 },
            duration: 0.42,
            ease: "power2.inOut",
        });

        const MATRIX_CHARS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789";
        const makeStream = () => ({
            char: MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
            y: Math.random() * 32,
            opacity: Math.random() * 0.7 + 0.3,
        });
        const updateMatrix = () => {
            setMatrixCharsL(Array.from({ length: 5 }, makeStream));
            setMatrixCharsR(Array.from({ length: 5 }, makeStream));
        };
        updateMatrix();
        matrixIntervalRef.current = setInterval(updateMatrix, 120);
    }, [killIdle, stopProcessing, tweenMouth]);

    const handleProcessingToggle = useCallback(() => {
        if (activeAnim === "processing") {
            handleNeutral();
        } else {
            setActiveAnim("processing");
            if (speakTlRef.current) speakTlRef.current.kill();
            restoreNeutral(true);
            gsap.delayedCall(0.04, playProcessing);
        }
    }, [activeAnim, handleNeutral, restoreNeutral, playProcessing]);

    const handleStateChange = useCallback((state: string) => {
        stopProcessing();
        switch (state) {
            case "listening":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 18, rx: 12 },
                    duration: 0.3,
                });
                break;
            case "recording":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 20, rx: 13 },
                    duration: 0.2,
                });
                break;
            case "processing":
                setActiveAnim("processing");
                playProcessing();
                break;
            case "sleeping":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 1 },
                    duration: 0.6,
                });
                break;
        }
    }, [stopProcessing, playProcessing]);

    const handleTextChange = useCallback((raw: string) => {
        // Detect ~state command anywhere in input
        const tildeMatch = raw.match(/~(\w+)/);
        if (tildeMatch) {
            const cmd = tildeMatch[1].toLowerCase();
            const STATE_MAP: Record<string, () => void> = {
                neutral:    handleNeutral,
                surprised:  handleSurprised,
                processing: handleProcessingToggle,
                speak:      () => { /* needs text — ignore bare ~speak */ },
                listening:  () => handleStateChange("listening"),
                recording:  () => handleStateChange("recording"),
                sleeping:   () => handleStateChange("sleeping"),
            };
            if (STATE_MAP[cmd]) {
                STATE_MAP[cmd]();
                setSpeakText("");
                setSpokenCount(0);
                setSpeakingDone(true);
                return;
            }
        }
        setSpeakText(raw);
        setSpokenCount(0);
        setSpeakingDone(true);
    }, [handleNeutral, handleSurprised, handleProcessingToggle, handleStateChange]);

    const handleSpeak = useCallback(() => {
        handleSpeakWithText(speakText);
    }, [handleSpeakWithText, speakText]);

    // ---- WebSocket: emotion & state animation handlers ----
    const playBeepAnimation = useCallback(() => {
        killIdle();
        gsap.timeline()
            .to("#screenGroup", { opacity: 0.6, duration: 0.05 })
            .to("#screenGroup", { opacity: 1,   duration: 0.05 })
            .to("#pupilLeft",  { attr: { ry: 26 }, duration: 0.1 })
            .to("#pupilRight", { attr: { ry: 26 }, duration: 0.1 }, "<")
            .to("#pupilLeft",  { attr: { ry: 18 }, duration: 0.15 })
            .to("#pupilRight", { attr: { ry: 18 }, duration: 0.15 }, "<")
            .to({}, { duration: 0.1 })
            .then(() => { idleKilledRef.current = false; });
    }, [killIdle]);

    const handleEmotion = useCallback((emotion: string) => {
        switch (emotion) {
            case "surprised":
                playSurprised();
                break;

            case "sleepy":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 2 },
                    duration: 0.8,
                    ease: "power2.inOut",
                });
                break;

            case "confused":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 10, rx: 8 },
                    duration: 0.3,
                });
                break;

            case "happy":
                gsap.to(["#pupilLeft", "#pupilRight"], {
                    attr: { ry: 22, rx: 14 },
                    duration: 0.3,
                });
                tweenMouth(MOUTH.ah, 0.3);
                break;

            case "processing":
                setActiveAnim("processing");
                playProcessing();
                break;

            case "idle":
            default:
                restoreNeutral();
                break;
        }
    }, [playSurprised, restoreNeutral, tweenMouth, playProcessing]);

    const handleBotMessage = useCallback((data: BotMessage) => {
        switch (data.type as string) {
            case "speak":
                if (data.text) {
                    if (data.text.startsWith("~")) {
                        handleTextChange(data.text);
                    } else {
                        handleSpeakWithText(data.text);
                    }
                }
                break;
            case "beep":
                playBeepAnimation();
                break;
            case "emotion":
                if (data.emotion) handleEmotion(data.emotion);
                break;
            case "state":
                if (data.state) {
                    setBotState(data.state);
                    handleStateChange(data.state);
                }
                break;
            case "processing":
                handleEmotion("processing");
                break;
        }
    }, [handleSpeakWithText, playBeepAnimation, handleEmotion, handleStateChange, handleTextChange]);

    useEffect(() => { handleBotMessageRef.current = handleBotMessage; }, [handleBotMessage]);

    useEffect(() => {
        const connectWebSocket = () => {
            const wsUrl = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:9000";
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("connected to BB");
                setConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data: BotMessage = JSON.parse(event.data);
                    handleBotMessageRef.current(data);
                } catch (e) {
                    console.error("Invalid message from bot:", e);
                }
            };

            ws.onclose = () => {
                console.log("Disconnected, reconnecting...");
                setConnected(false);
                setTimeout(connectWebSocket, 2000);
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
        };

        connectWebSocket();
        return () => { wsRef.current?.close(); };
    }, []); // create socket once

    useEffect(() => {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";
        if (!svgRef.current) return;

        const blink = () => {
            gsap.delayedCall(Math.random() * 4 + 2, () => {
                if (idleKilledRef.current) { blink(); return; }
                gsap.timeline({ onComplete: blink })
                    .to(["#pupilLeft","#pupilRight"], { attr: { ry: 1 },  duration: 0.06, ease: "power2.in" })
                    .to({}, { duration: Math.random() * 0.08 })
                    .to(["#pupilLeft","#pupilRight"], { attr: { ry: 18 }, duration: 0.1,  ease: "power2.out" });
            });
        };
        blink();

        const look = () => {
            gsap.delayedCall(Math.random() * 3 + 1.5, () => {
                if (idleKilledRef.current) { look(); return; }
                const dx = (Math.random() - 0.5) * 16;
                const dy = (Math.random() - 0.5) * 6;
                gsap.timeline({ onComplete: look })
                    .to("#pupilLeft",  { attr: { cx: 120 + dx, cy: 96 + dy }, duration: 0.18, ease: "power2.inOut" })
                    .to("#pupilRight", { attr: { cx: 240 + dx, cy: 96 + dy }, duration: 0.18, ease: "power2.inOut" }, "<")
                    .to({}, { duration: Math.random() * 1.2 + 0.4 })
                    .to("#pupilLeft",  { attr: { cx: 120, cy: 96 }, duration: 0.22, ease: "power2.inOut" })
                    .to("#pupilRight", { attr: { cx: 240, cy: 96 }, duration: 0.22, ease: "power2.inOut" }, "<");
            });
        };
        look();

        gsap.fromTo("#scanlines",
            { attr: { patternTransform: "translate(0,0)" } },
            { attr: { patternTransform: "translate(0,4)" }, duration: 0.25, repeat: -1, ease: "none" }
        );

        const flicker = () => {
            const tl = gsap.timeline({ onComplete: () => gsap.delayedCall(Math.random() * 3 + 1.5, flicker) });
            for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
                tl.to("#screenGroup", { opacity: Math.random() * 0.25 + 0.7, duration: 0.02 })
                    .to("#screenGroup", { opacity: 1, duration: 0.02 });
            }
        };
        gsap.delayedCall(2, flicker);

        const twitch = () => {
            gsap.to("#faceGroup", {
                x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 2, duration: 0.07,
                onComplete: () => gsap.to("#faceGroup", {
                    x: 0, y: 0, duration: 0.09,
                    onComplete: () => gsap.delayedCall(Math.random() * 5 + 3, twitch),
                }),
            });
        };
        gsap.delayedCall(3, twitch);
    }, []);

    // ---- Layout constants ----
    const INPUT_X     = 50;
    const INPUT_W     = 300;

    const panelOfsX   = GAP;
    const toContainerX = (svgX: number) => ((panelOfsX + svgX * SVG_SCALE) / TOTAL_W) * 100;
    const toContainerY = (svgY: number) => ((SVG_TOP + svgY * SVG_SCALE) / TOTAL_H) * 100;
    const toContainerW = (svgW: number) => (svgW * SVG_SCALE / TOTAL_W) * 100;
    const toContainerH = (svgH: number) => (svgH * SVG_SCALE / TOTAL_H) * 100;

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", height: "100%", background: "#111", overflow: "hidden",
            margin: 0, padding: 0, boxSizing: "border-box", position: "fixed", inset: 0,
        }}>
            <div style={{
                position: "absolute",
                top: "5px",
                right: "10px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                zIndex: 20,
            }}>
                <div style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: connected ? "#4ade80" : "#ef4444",
                    boxShadow: connected ? "0 0 4px #4ade80" : "0 0 2px #ef4444",
                }} />
                <span style={{
                    color: connected ? "#4ade80" : "#ef4444",
                    fontSize: "10px",
                    fontFamily: "monospace",
                }}>
                    {connected ? "LIVE" : "OFFLINE"}
                </span>
                {botState && (
                    <span style={{
                        color: "#5fecd8",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        marginLeft: "10px",
                    }}>
                        {botState.toUpperCase()}
                    </span>
                )}
            </div>

            <div style={{
                position: "relative",
                aspectRatio: `${TOTAL_W} / ${TOTAL_H}`,
                width: "100%",
                maxWidth: `min(100vw, calc(100vh * ${TOTAL_W / TOTAL_H}))`,
                maxHeight: "100vh",
            }}>
                {/* ---- Text input overlay ---- */}
                <div style={{
                    position: "absolute",
                    left:   `${toContainerX(INPUT_X)}%`,
                    top:    `${toContainerY(212)}%`,
                    width:  `${toContainerW(INPUT_W)}%`,
                    height: `${toContainerH(13)}%`,
                    display: "flex", alignItems: "center",
                    zIndex: 10,
                }}>
                    {/* Corner bracket decorations */}
                    <div style={{
                        position: "absolute", inset: 0,
                        pointerEvents: "none",
                    }}>
                        {/* TL */}
                        <div style={{ position:"absolute", top:0, left:0, width:6, height:6,
                            borderTop: "1.5px solid #5fecd8", borderLeft: "1.5px solid #5fecd8", opacity: 0.9 }} />
                        {/* TR */}
                        <div style={{ position:"absolute", top:0, right:0, width:6, height:6,
                            borderTop: "1.5px solid #5fecd8", borderRight: "1.5px solid #5fecd8", opacity: 0.9 }} />
                        {/* BL */}
                        <div style={{ position:"absolute", bottom:0, left:0, width:6, height:6,
                            borderBottom: "1.5px solid #5fecd8", borderLeft: "1.5px solid #5fecd8", opacity: 0.9 }} />
                        {/* BR */}
                        <div style={{ position:"absolute", bottom:0, right:0, width:6, height:6,
                            borderBottom: "1.5px solid #5fecd8", borderRight: "1.5px solid #5fecd8", opacity: 0.9 }} />
                    </div>
                    {/* Animated character display */}
                    <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center",
                        padding: "0 10px",
                        pointerEvents: "none",
                        overflow: "hidden",
                        background: activeAnim === "speak"
                            ? "linear-gradient(90deg,#0d3030 0%,#102828 50%,#0d3030 100%)"
                            : "linear-gradient(90deg,#061818 0%,#0a2020 50%,#061818 100%)",
                        borderTop:    `1px solid ${activeAnim === "speak" ? "#5fecd8cc" : "#1ecfcf55"}`,
                        borderBottom: `1px solid ${activeAnim === "speak" ? "#5fecd8cc" : "#1ecfcf55"}`,
                        borderRadius: "2px",
                        boxShadow: activeAnim === "speak"
                            ? "inset 0 0 8px #0a3a3a, 0 0 6px #1ecfcf33"
                            : "inset 0 0 6px #000",
                        zIndex: 2,
                    }}>
                        {speakText.length === 0 ? (
                            <span style={{
                                color: "#1ecfcf44",
                                fontFamily: "'Courier New', Courier, monospace",
                                fontSize: "clamp(5px, 1vw, 10px)",
                                letterSpacing: "0.12em",
                            }}>...</span>
                        ) : (
                            speakText.split("").map((ch, i) => {
                                const spoken = i < spokenCount;
                                const active = !speakingDone && i === spokenCount - 1;
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            display: "inline-block",
                                            fontFamily: "'Courier New', Courier, monospace",
                                            fontSize: "clamp(5px, 1vw, 10px)",
                                            letterSpacing: "0.12em",
                                            whiteSpace: "pre",
                                            color: spoken
                                                ? active ? "#ffffff" : "#5fecd8"
                                                : "#2a6a60",
                                            textShadow: spoken
                                                ? active
                                                    ? "0 0 8px #ffffff, 0 0 16px #5fecd8, 0 0 24px #1ecfcf"
                                                    : "0 0 5px #5fecd8, 0 0 10px #1ecfcf66"
                                                : "none",
                                            transform: active ? "scaleY(1.5) scaleX(1.15)" : spoken ? "scale(1)" : "scale(0.92)",
                                            transformOrigin: "center bottom",
                                            transition: spoken
                                                ? "transform 0.08s cubic-bezier(0.34,1.56,0.64,1), color 0.12s ease, text-shadow 0.12s ease"
                                                : "none",
                                        }}
                                    >{ch}</span>
                                );
                            })
                        )}
                    </div>
                    <input
                        type="text"
                        value={speakText}
                        onChange={e => handleTextChange(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSpeak(); }}
                        style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            background: "transparent",
                            border: "none",
                            color: "transparent",
                            caretColor: "#5fecd8",
                            fontFamily: "'Courier New', Courier, monospace",
                            fontSize: "clamp(5px, 1vw, 10px)",
                            letterSpacing: "0.12em",
                            padding: "0 10px",
                            outline: "none",
                            boxSizing: "border-box",
                            zIndex: 3,
                        }}
                    />
                </div>

                {/* ---- SVG face ---- */}
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ display: "block", width: "100%", height: "100%" }}
                >
                    <defs>
                        <clipPath id="screenClip">
                            <rect x="20" y="24" width="360" height="185" rx="18"/>
                        </clipPath>
                        <pattern id="scanlines" x="20" y="24" width="4" height="4" patternUnits="userSpaceOnUse">
                            <rect width="4" height="2" fill="#883030" opacity="0.08"/>
                            <rect width="4" height="1.6" fill="#000" opacity="0.14"/>
                        </pattern>
                        <filter id="crtBulge" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                            <feImage result="bulgeMap"
                                     xlinkHref="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjE4NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImciIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjcwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzgwODA4MCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzgwODA4MCIgc3RvcC1vcGFjaXR5PSIwIi8+PC9yYWRpYWxHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjM2MCIgaGVpZ2h0PSIxODUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
                                     x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none"
                            />
                            <feDisplacementMap in="SourceGraphic" in2="bulgeMap" scale="6" xChannelSelector="R"
                                               yChannelSelector="G"/>
                        </filter>
                        <filter id="chromaFace" x="-5%" y="-5%" width="110%" height="105%"
                                colorInterpolationFilters="sRGB">
                            <feColorMatrix type="matrix" in="SourceGraphic" result="red"
                                           values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
                            <feOffset in="red" dx="-1.5" dy="0" result="redShift"/>
                            <feColorMatrix type="matrix" in="SourceGraphic" result="blue"
                                           values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
                            <feOffset in="blue" dx="1.5" dy="0" result="blueShift"/>
                            <feColorMatrix type="matrix" in="SourceGraphic" result="green"
                                           values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
                            <feBlend in="redShift" in2="green" mode="screen" result="rg"/>
                            <feBlend in="rg" in2="blueShift" mode="screen" result="rgb"/>
                            <feGaussianBlur in="rgb" stdDeviation="1.2" result="glow"/>
                            <feBlend in="rgb" in2="glow" mode="screen"/>
                        </filter>
                        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                            <stop offset="65%" stopColor="transparent"/>
                            <stop offset="100%" stopColor="#010" stopOpacity="0.36"/>
                        </radialGradient>
                        <radialGradient id="glare" cx="28%" cy="28%" r="55%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22"/>
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                        </radialGradient>
                        <linearGradient id="railGradL" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#166060"/>
                            <stop offset="45%" stopColor="#24d8e6"/>
                            <stop offset="100%" stopColor="#22a3a4"/>
                        </linearGradient>
                        <linearGradient id="railGradR" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#22a3a4"/>
                            <stop offset="55%" stopColor="#24d8e6"/>
                            <stop offset="100%" stopColor="#166060"/>
                        </linearGradient>
                        <linearGradient id="railEdgeShade" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#000" stopOpacity="0.22"/>
                            <stop offset="25%" stopColor="#000" stopOpacity="0"/>
                            <stop offset="75%" stopColor="#000" stopOpacity="0"/>
                            <stop offset="100%" stopColor="#000" stopOpacity="0.22"/>
                        </linearGradient>
                        <pattern id="touchGrid" width="7" height="10" patternUnits="userSpaceOnUse">
                            <circle cx="4" cy="4" r="0.8" fill="#1ecfcf" opacity="0.22"/>
                        </pattern>

                        {/* ---- VHS screen filter ---- */}
                        <filter id="vhsFilter" x="0%" y="0%" width="100%" height="100%"
                                colorInterpolationFilters="sRGB">
                            {/* Slight luma noise via turbulence */}
                            <feTurbulence type="fractalNoise" baseFrequency="0.65 0.003" numOctaves="1" seed="2"
                                          result="noise"/>
                            <feColorMatrix in="noise" type="saturate" values="0" result="greyNoise"/>
                            <feComponentTransfer in="greyNoise" result="dimNoise">
                                <feFuncA type="linear" slope="0.07"/>
                            </feComponentTransfer>
                            <feComposite in="SourceGraphic" in2="dimNoise" operator="arithmetic" k1="0" k2="1" k3="0.18"
                                         k4="0" result="noisy"/>
                            {/* Horizontal tracking wobble via displacement */}
                            <feTurbulence type="turbulence" baseFrequency="0.0 0.08" numOctaves="1" seed="8"
                                          result="trackNoise"/>
                            <feDisplacementMap in="noisy" in2="trackNoise" scale="3.5" xChannelSelector="R"
                                               yChannelSelector="G" result="displaced"/>
                            {/* Chroma channel bleed — red left, blue right */}
                            <feColorMatrix type="matrix" in="displaced" result="redCh"
                                           values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
                            <feOffset in="redCh" dx="-2.5" dy="0" result="redBleed"/>
                            <feColorMatrix type="matrix" in="displaced" result="blueCh"
                                           values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
                            <feOffset in="blueCh" dx="2.5" dy="0" result="blueBleed"/>
                            <feColorMatrix type="matrix" in="displaced" result="greenCh"
                                           values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
                            <feBlend in="redBleed" in2="greenCh" mode="screen" result="rg"/>
                            <feBlend in="rg" in2="blueBleed" mode="screen" result="rgb"/>
                            {/* Soft glow */}
                            <feGaussianBlur in="rgb" stdDeviation="0.9" result="glow"/>
                            <feBlend in="rgb" in2="glow" mode="screen" result="glowing"/>
                            {/* Slight desaturation for tape-worn look */}
                            <feColorMatrix in="glowing" type="saturate" values="0.72"/>
                        </filter>
                        <linearGradient id="agedTealMetal" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#1c4a3f"/>
                            <stop offset="20%" stopColor="#1a6f6a"/>
                            <stop offset="40%" stopColor="#14cfd4"/>
                            <stop offset="60%" stopColor="#0f4a4a"/>
                            <stop offset="80%" stopColor="#0e2f2a"/>
                            <stop offset="100%" stopColor="#0a1f1b"/>
                        </linearGradient>
                        <linearGradient id="agedTeal2" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#1c4a3f"/>
                            <stop offset="40%" stopColor="#14cfd4"/>
                            <stop offset="80%" stopColor="#0e2f2a"/>
                            <stop offset="100%" stopColor="#0a1f1b"/>
                        </linearGradient>
                        <linearGradient id="agedMetal" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#1b1f22"/>
                            <stop offset="18%" stopColor="#2a2f34"/>
                            <stop offset="35%" stopColor="#15191d"/>
                            <stop offset="55%" stopColor="#3a4046"/>
                            <stop offset="75%" stopColor="#121518"/>
                            <stop offset="100%" stopColor="#0e1013"/>
                        </linearGradient>
                        <filter id="metalGrain">
                            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
                            <feColorMatrix type="saturate" values="0"/>
                            <feComponentTransfer>
                                <feFuncA type="table" tableValues="0 0.03"/>
                            </feComponentTransfer>
                        </filter>
                    </defs>

                    <g transform={`translate(${GAP}, ${SVG_TOP}) scale(${SVG_SCALE})`}>
                        <rect
                            x="0"
                            y="0"
                            width="400"
                            height="225"
                            rx="25"
                            fill="url(#agedMetal)"
                            stroke="#0c0f12"
                            strokeWidth="2"
                        />
                        <rect
                            x="2"
                            y="2"
                            width="396"
                            height="221"
                            rx="23"
                            fill="url(#agedTeal2)"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="1"
                        />
                        <rect
                            x="6"
                            y="6"
                            width="388"
                            height="213"
                            rx="22"
                            fill="url(#agedTealMetal)"
                            stroke="rgba(255,255,255,0.125)"
                            strokeWidth="1"
                        />
                        <rect
                            x="0"
                            y="0"
                            width="400"
                            height="225"
                            rx="25"
                            filter="url(#metalGrain)"
                            opacity="0.35"
                        />
                        <g opacity="0.08" stroke="#000">
                            <line x1="40" y1="30" x2="120" y2="28"/>
                            <line x1="200" y1="60" x2="340" y2="55"/>
                            <line x1="80" y1="160" x2="260" y2="170"/>
                        </g>

                        <g id="screenGroup" filter="url(#vhsFilter)">
                            <rect x="20" y="24" width="360" height="185" rx="18" fill="#2d5a4f"/>
                            <g transform="translate(20,12)" clipPath="url(#screenClip)">
                                <g id="faceGroup">
                                    <path id="browLeft" d="M100 46 Q120 31 140 46" stroke="#0a1a16" strokeWidth="4"
                                          fill="none" strokeLinecap="round"/>
                                    <path id="browRight" d="M220 46 Q240 31 260 46" stroke="#0a1a16" strokeWidth="4"
                                          fill="none" strokeLinecap="round"/>
                                    <ellipse id="pupilLeft" cx="120" cy="96" rx="12" ry="18" fill="#0a1a16"/>
                                    <ellipse id="pupilRight" cx="240" cy="96" rx="12" ry="18" fill="#0a1a16"/>
                                    <path id="mouth" d={mouthPath(MOUTH.rest)} fill="#0a1a16"/>
                                </g>
                                {activeAnim === "processing" && (
                                    <g style={{pointerEvents: "none"}}>
                                        <defs>
                                            <clipPath id="eyeClipL">
                                                <ellipse cx="120" cy="96" rx="12" ry="18"/>
                                            </clipPath>
                                            <clipPath id="eyeClipR">
                                                <ellipse cx="240" cy="96" rx="12" ry="18"/>
                                            </clipPath>
                                        </defs>
                                        <g clipPath="url(#eyeClipL)">
                                            {matrixCharsL.map((c, i) => (
                                                <text key={i}
                                                      x={113 + (i % 3) * 5}
                                                      y={82 + c.y}
                                                      fill="#00ff88"
                                                      opacity={c.opacity}
                                                      fontSize="7"
                                                      fontFamily="monospace"
                                                >{c.char}</text>
                                            ))}
                                        </g>
                                        <g clipPath="url(#eyeClipR)">
                                            {matrixCharsR.map((c, i) => (
                                                <text key={i}
                                                      x={233 + (i % 3) * 5}
                                                      y={82 + c.y}
                                                      fill="#00ff88"
                                                      opacity={c.opacity}
                                                      fontSize="7"
                                                      fontFamily="monospace"
                                                >{c.char}</text>
                                            ))}
                                        </g>
                                    </g>
                                )}
                            </g>
                            <rect x="20" y="24" width="360" height="185" rx="20" fill="url(#scanlines)"
                                  style={{pointerEvents: "none"}}/>
                            <rect x="20" y="24" width="360" height="185" rx="20" fill="url(#vignette)"
                                  style={{pointerEvents: "none"}}/>
                            <rect x="20" y="24" width="360" height="185" rx="20" fill="url(#glare)"
                                  style={{pointerEvents: "none"}}/>
                        </g>

                        <rect x={INPUT_X} y="212" width={INPUT_W} height="13" rx="3"
                              fill={activeAnim === "speak" ? "#1a4a4a" : "#0a2a2a"}
                              stroke={activeAnim === "speak" ? "#5fecd8" : "#1ecfcf88"} strokeWidth="0.7"
                        />
                    </g>
                </svg>
            </div>
        </div>
    );
}