import React, { useEffect, useRef, useCallback, useState } from "react";
import gsap from "gsap";
import "./App.css";

const TOTAL_W = 560;
const TOTAL_H = 315;
const RAIL_W = 14;
const GAP = 4;
const CENTER_W = TOTAL_W - 2 * RAIL_W - 2 * GAP;
const SVG_SCALE = CENTER_W / 400;
const SVG_H = Math.round(225 * SVG_SCALE);
const SVG_TOP = Math.round((TOTAL_H - SVG_H) / 2);

//gippity
const MOUTH: Record<string, string> = {
    rest: "M 138,160 C 160,168 200,168 222,160 C 223,158 223,156 222,154 C 200,162 160,162 138,154 C 137,156 137,158 138,160 Z",
    // "ah" — wide open
    ah:   "M 148,145 C 162,142 198,142 212,145 C 220,153 220,164 212,172 C 198,177 162,177 148,172 C 140,164 140,153 148,145 Z",
    // "ee" — wide thin grin
    ee:   "M 126,150 C 152,145 208,145 234,150 C 235,153 235,155 234,158 C 208,153 152,153 126,158 C 125,155 125,153 126,150 Z",
    // "oh" — medium oval
    oh:   "M 158,146 C 168,143 192,143 202,146 C 210,153 210,163 202,170 C 192,175 168,175 158,170 C 150,163 150,153 158,146 Z",
    // "oo" — small pursed circle
    oo:   "M 165,149 C 171,146 189,146 195,149 C 200,154 200,161 195,165 C 189,169 171,169 165,165 C 160,161 160,154 165,149 Z",
    // "mm" / "pp" / "bb" — pressed lips
    mm:   "M 138,152 C 158,149 202,149 222,152 C 223,153 223,154 222,155 C 202,153 158,153 138,155 C 137,154 137,153 138,152 Z",
    // "ff" / "vv" — slightly open with tension
    ff:   "M 132,152 C 155,149 205,149 228,152 C 229,154 229,156 228,158 C 205,156 155,156 132,158 C 131,156 131,154 132,152 Z",
    // "th" — slightly open flat
    th:   "M 135,151 C 157,147 203,147 225,151 C 226,153 226,155 225,157 C 203,155 157,155 135,157 C 134,155 134,153 135,151 Z",
    // "ss" / "zz" — narrow tense
    ss:   "M 136,151 C 157,147 203,147 224,151 C 225,153 225,155 224,156 C 203,154 157,154 136,156 C 135,155 135,153 136,151 Z",
};

function charToPhon(ch: string): string {
    const c = ch.toLowerCase();
    if (c === "a") return "ah";
    if (c === "e" || c === "i") return "ee";
    if (c === "o") return "oh";
    if (c === "u") return "oo";
    if ("mbp".includes(c)) return "mm";
    if ("fv".includes(c))  return "ff";
    if (c === "s" || c === "z") return "ss";
    if (c === "t" || c === "d" || c === "h") return "th";
    if (" \t\n".includes(c)) return "rest";
    return "mm";
}

function FaceButton({ x, w = 72, label, active, onClick }: {
    x: number; w?: number; label: string; active: boolean; onClick: () => void;
}) {
    return (
        <g style={{ cursor: "pointer" }} onClick={onClick}>
            <rect x={x} y="212" width={w} height="13" rx="6.5"
                  fill={active ? "#1a9090" : "#0e6060"}
                  stroke={active ? "#5fecd8" : "#1ecfcf"} strokeWidth="0.8" />
            <text x={x + w / 2} y="221.5" textAnchor="middle"
                  fontSize="6.5" fontFamily="monospace"
                  fill={active ? "#ffffff" : "#5fecd8"} letterSpacing="0.5">
                {label}
            </text>
        </g>
    );
}

type AnimName = "neutral" | "speak" | "surprised";

export default function App() {
    const svgRef        = useRef<SVGSVGElement>(null);
    const [activeAnim, setActiveAnim] = useState<AnimName>("neutral");
    const [speakText, setSpeakText]   = useState("");
    const idleKilledRef  = useRef(false);
    const speakTlRef     = useRef<gsap.core.Timeline | null>(null);

    const killIdle = useCallback(() => { idleKilledRef.current = true; }, []);

    const restoreNeutral = useCallback((instant = false) => {
        idleKilledRef.current = false;
        const d = instant ? 0 : 0.4;
        gsap.to(["#pupilLeft", "#pupilRight"], { attr: { rx: 12, ry: 18 }, duration: d, ease: "power2.out" });
        gsap.to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: d, ease: "power2.out" });
        gsap.to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: d, ease: "power2.out" });
        gsap.to("#mouth",     { attr: { d: MOUTH.rest },               duration: d, ease: "power2.out" });
        gsap.to("#faceGroup", { x: 0, y: 0, duration: d });
    }, []);

    const playSurprised = useCallback(() => {
        killIdle();
        gsap.timeline()
            .to(["#pupilLeft","#pupilRight"], { attr: { ry: 26, rx: 17 }, duration: 0.3, ease: "elastic.out(1,0.4)" })
            .to("#browLeft",  { attr: { d: "M100 26 Q120 12 140 26" }, duration: 0.35, ease: "power3.out" }, "<")
            .to("#browRight", { attr: { d: "M220 26 Q240 12 260 26" }, duration: 0.35, ease: "power3.out" }, "<")
            .to("#mouth",     { attr: { d: MOUTH.oh },                 duration: 0.35, ease: "power3.out" }, "<")
            .to("#faceGroup", { y: -6,  duration: 0.12, ease: "power2.out" }, "<")
            .to("#faceGroup", { y: 0,   duration: 0.4,  ease: "bounce.out" })
            .to({}, { duration: 1.2 })
            .to(["#pupilLeft","#pupilRight"], { attr: { ry: 18, rx: 12 }, duration: 0.6, ease: "power2.inOut" })
            .to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: 0.6, ease: "power2.out" }, "<")
            .to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: 0.6, ease: "power2.out" }, "<")
            .to("#mouth",     { attr: { d: MOUTH.rest },               duration: 0.6, ease: "power2.out" }, "<");
    }, [killIdle]);

    const playSpeak = useCallback((text: string) => {
        if (!text.trim()) return;
        killIdle();
        if (speakTlRef.current) speakTlRef.current.kill();

        const PER_CHAR = 0.08;
        const BLEND    = 0.08;

        const tl = gsap.timeline({
            onComplete: () => {
                gsap.to("#mouth", { attr: { d: MOUTH.rest }, duration: 0.25 });
                // relax brows
                gsap.to("#browLeft",  { attr: { d: "M100 46 Q120 31 140 46" }, duration: 0.4 });
                gsap.to("#browRight", { attr: { d: "M220 46 Q240 31 260 46" }, duration: 0.4 });
                idleKilledRef.current = false;
            },
        });
        speakTlRef.current = tl;

        tl.to("#browLeft",  { attr: { d: "M100 40 Q120 26 140 40" }, duration: 0.3 }, 0)
            .to("#browRight", { attr: { d: "M220 40 Q240 26 260 40" }, duration: 0.3 }, 0);

        let cursor = 0.05;
        for (const ch of text) {
            const shape = MOUTH[charToPhon(ch)];
            tl.to("#mouth", { attr: { d: shape }, duration: BLEND, ease: "power1.inOut" }, cursor);
            cursor += PER_CHAR;
            if (ch !== " ") {
                tl.to("#mouth", { attr: { d: MOUTH.rest }, duration: BLEND * 0.88, ease: "power1.in" }, cursor - BLEND * 0.45);
            }
        }
    }, [killIdle]);

    const handleNeutral = useCallback(() => {
        setActiveAnim("neutral");
        if (speakTlRef.current) speakTlRef.current.kill();
        restoreNeutral();
    }, [restoreNeutral]);

    const handleSpeak = useCallback(() => {
        setActiveAnim("speak");
        restoreNeutral(true);
        gsap.delayedCall(0.04, () => playSpeak(speakText));
    }, [restoreNeutral, playSpeak, speakText]);

    const handleSurprised = useCallback(() => {
        setActiveAnim("surprised");
        if (speakTlRef.current) speakTlRef.current.kill();
        restoreNeutral(true);
        gsap.delayedCall(0.04, playSurprised);
    }, [restoreNeutral, playSurprised]);

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

    const BTN_W = 72;
    const BTN_G = 6;
    const B_NEUTRAL  = 10;
    const B_SURPRISED = 400 - 10 - BTN_W;
    const B_SPEAK = B_SURPRISED - BTN_G - BTN_W;
    const INPUT_X = B_NEUTRAL + BTN_W + BTN_G;
    const INPUT_W = B_SPEAK - BTN_G - INPUT_X;

    const panelOfsX = RAIL_W + GAP;
    const toContainerX = (svgX: number) =>
        ((panelOfsX + svgX * SVG_SCALE) / TOTAL_W) * 100;
    const toContainerY = (svgY: number) =>
        ((SVG_TOP + svgY * SVG_SCALE) / TOTAL_H) * 100;
    const toContainerW = (svgW: number) => (svgW * SVG_SCALE / TOTAL_W) * 100;
    const toContainerH = (svgH: number) => (svgH * SVG_SCALE / TOTAL_H) * 100;

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", height: "100%", background: "#111", overflow: "hidden",
            margin: 0, padding: 0, boxSizing: "border-box", position: "fixed", inset: 0,
        }}>
            <div style={{
                position: "relative",
                aspectRatio: `${TOTAL_W} / ${TOTAL_H}`,
                width: "100%",
                maxWidth: `min(100vw, calc(100vh * ${TOTAL_W / TOTAL_H}))`,
                maxHeight: "100vh",
            }}>
                <div style={{
                    position: "absolute",
                    left:   `${toContainerX(INPUT_X)}%`,
                    top:    `${toContainerY(212)}%`,
                    width:  `${toContainerW(INPUT_W)}%`,
                    height: `${toContainerH(13)}%`,
                    display: "flex", alignItems: "center",
                    zIndex: 10,
                }}>
                    <input
                        type="text"
                        value={speakText}
                        onChange={e => setSpeakText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSpeak(); }}
                        placeholder="type to speak…"
                        style={{
                            width: "100%", height: "100%",
                            background: activeAnim === "speak" ? "#1a4a4a" : "#0a2a2a",
                            border: `1px solid ${activeAnim === "speak" ? "#5fecd8" : "#1ecfcf88"}`,
                            borderRadius: "3px",
                            color: "#5fecd8",
                            fontFamily: "monospace",
                            fontSize: "clamp(5px, 1vw, 10px)",
                            padding: "0 3px",
                            outline: "none",
                            letterSpacing: "0.03em",
                            boxSizing: "border-box",
                            caretColor: "#5fecd8",
                        }}
                    />
                </div>

                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ display: "block", width: "100%", height: "100%" }}
                >
                    <defs>
                        <clipPath id="screenClip">
                            <rect x="20" y="24" width="360" height="185" rx="18" />
                        </clipPath>
                        <pattern id="scanlines" x="20" y="24" width="4" height="4" patternUnits="userSpaceOnUse">
                            <rect width="4" height="2" fill="#883030" opacity="0.08" />
                            <rect width="4" height="1.6" fill="#000" opacity="0.14" />
                        </pattern>
                        <filter id="crtBulge" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
                            <feImage result="bulgeMap"
                                     xlinkHref="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjE4NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImciIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjcwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzgwODA4MCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzgwODA4MCIgc3RvcC1vcGFjaXR5PSIwIi8+PC9yYWRpYWxHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjM2MCIgaGVpZ2h0PSIxODUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4="
                                     x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none"
                            />
                            <feDisplacementMap in="SourceGraphic" in2="bulgeMap" scale="6" xChannelSelector="R" yChannelSelector="G" />
                        </filter>
                        <filter id="chromaFace" x="-5%" y="-5%" width="110%" height="105%" colorInterpolationFilters="sRGB">
                            <feColorMatrix type="matrix" in="SourceGraphic" result="red"   values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                            <feOffset in="red" dx="-1.5" dy="0" result="redShift" />
                            <feColorMatrix type="matrix" in="SourceGraphic" result="blue"  values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
                            <feOffset in="blue" dx="1.5" dy="0" result="blueShift" />
                            <feColorMatrix type="matrix" in="SourceGraphic" result="green" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                            <feBlend in="redShift" in2="green" mode="screen" result="rg" />
                            <feBlend in="rg" in2="blueShift" mode="screen" result="rgb" />
                            <feGaussianBlur in="rgb" stdDeviation="1.2" result="glow" />
                            <feBlend in="rgb" in2="glow" mode="screen" />
                        </filter>
                        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                            <stop offset="65%" stopColor="transparent" />
                            <stop offset="100%" stopColor="#010" stopOpacity="0.36" />
                        </radialGradient>
                        <radialGradient id="glare" cx="28%" cy="28%" r="55%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </radialGradient>
                        <linearGradient id="railGradL" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%"   stopColor="#166060" />
                            <stop offset="45%"  stopColor="#24d8e6" />
                            <stop offset="100%" stopColor="#22a3a4" />
                        </linearGradient>
                        <linearGradient id="railGradR" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%"   stopColor="#22a3a4" />
                            <stop offset="55%"  stopColor="#24d8e6" />
                            <stop offset="100%" stopColor="#166060" />
                        </linearGradient>
                        <linearGradient id="railEdgeShade" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%"   stopColor="#000" stopOpacity="0.22" />
                            <stop offset="25%"  stopColor="#000" stopOpacity="0" />
                            <stop offset="75%"  stopColor="#000" stopOpacity="0" />
                            <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
                        </linearGradient>
                        <pattern id="touchGrid" width="7" height="10" patternUnits="userSpaceOnUse">
                            <circle cx="4" cy="4" r="0.8" fill="#1ecfcf" opacity="0.22" />
                        </pattern>
                    </defs>

                    <g transform={`translate(${RAIL_W + GAP}, ${SVG_TOP}) scale(${SVG_SCALE})`}>
                        <rect x="0" y="0" width="400" height="225" rx="25" fill="#24d8e6" />
                        <rect x="3" y="3" width="394" height="219" rx="25" fill="#22a3a4" />
                        <rect x="10" y="10" width="380" height="205" rx="18" fill="#4d826e" />

                        <g id="screenGroup">
                            <rect x="20" y="24" width="360" height="185" rx="18" fill="#91e6d2" />
                            <g transform="translate(20,12)" clipPath="url(#screenClip)">
                                <g id="faceGroup" filter="url(#chromaFace)">

                                    <path id="browLeft"  d="M100 46 Q120 31 140 46" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
                                    <path id="browRight" d="M220 46 Q240 31 260 46" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />

                                    <ellipse id="pupilLeft"  cx="120" cy="96" rx="12" ry="18" fill="#222" />
                                    <ellipse id="pupilRight" cx="240" cy="96" rx="12" ry="18" fill="#222" />

                                    <path id="mouth" d={MOUTH.rest} fill="#222" />
                                </g>
                            </g>
                            <rect x="20" y="24" width="360" height="185" rx="18" fill="url(#scanlines)" style={{ pointerEvents: "none" }} />
                            <rect x="20" y="24" width="360" height="185" rx="18" fill="url(#vignette)"  style={{ pointerEvents: "none" }} />
                            <rect x="20" y="24" width="360" height="185" rx="18" fill="url(#glare)"     style={{ pointerEvents: "none" }} />
                        </g>

                        <rect x="10" y="214" width="380" height="11" rx="5" fill="#1a9090" />
                        {[0,1,2,3,4].map(i => <circle key={`sl1-${i}`} cx={36 + i * 8} cy={217} r="1.4" fill="#156868" />)}
                        {[0,1,2,3,4].map(i => <circle key={`sl2-${i}`} cx={36 + i * 8} cy={221} r="1.4" fill="#156868" />)}
                        <circle cx="200" cy="219" r="3"   fill="#00ff88" opacity="0.85" />
                        <circle cx="200" cy="219" r="5.5" fill="#00ff88" opacity="0.15" />
                        {[0,1,2,3,4].map(i => <circle key={`sr1-${i}`} cx={315 + i * 8} cy={217} r="1.4" fill="#156868" />)}
                        {[0,1,2,3,4].map(i => <circle key={`sr2-${i}`} cx={315 + i * 8} cy={221} r="1.4" fill="#156868" />)}

                        <FaceButton x={B_NEUTRAL}   w={BTN_W} label="NEUTRAL"   active={activeAnim === "neutral"}   onClick={handleNeutral}   />
                        <FaceButton x={B_SPEAK}     w={BTN_W} label="▶ SPEAK"   active={activeAnim === "speak"}     onClick={handleSpeak}     />
                        <FaceButton x={B_SURPRISED} w={BTN_W} label="SURPRISED" active={activeAnim === "surprised"} onClick={handleSurprised} />

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