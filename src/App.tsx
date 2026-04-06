import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import "./App.css";

function App() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const blink = () => {
            const delay = Math.random() * 4 + 2;
            gsap.delayedCall(delay, () => {
                const tl = gsap.timeline({ onComplete: blink });

                tl.to(["#pupilLeft", "#pupilRight", "#reflLeft", "#reflRight"], {
                    attr: { ry: 1 }, duration: 0.06, ease: "power2.in"
                })
                    .to({}, { duration: Math.random() * 0.1 })
                    .to(["#pupilLeft", "#pupilRight"], {
                        attr: { ry: 18 }, duration: 0.1, ease: "power2.out"
                    })
                    .to(["#reflLeft", "#reflRight"], {
                        attr: { ry: 6 }, duration: 0.1, ease: "power2.out"
                    }, "<");
            });
        };
        blink();

        const look = () => {
            const delay = Math.random() * 3 + 1.5;
            gsap.delayedCall(delay, () => {
                const dx = (Math.random() - 0.5) * 16;
                const dy = (Math.random() - 0.5) * 6;

                const tl = gsap.timeline({ onComplete: look });
                tl.to(["#pupilLeft", "#reflLeft"], {
                    attr: { cx: 140 + dx, cy: 120 + dy },
                    duration: 0.18,
                    ease: "power2.inOut"
                })
                    .to(["#pupilRight", "#reflRight"], {
                        attr: { cx: 260 + dx, cy: 120 + dy },
                        duration: 0.18,
                        ease: "power2.inOut"
                    }, "<")
                    .to({}, { duration: Math.random() * 1.2 + 0.4 })
                    .to(["#pupilLeft", "#reflLeft"], {
                        attr: { cx: 140, cy: 120 },
                        duration: 0.22,
                        ease: "power2.inOut"
                    })
                    .to(["#pupilRight", "#reflRight"], {
                        attr: { cx: 260, cy: 120 },
                        duration: 0.22,
                        ease: "power2.inOut"
                    }, "<");
            });
        };
        look();

        gsap.to("#scanlines", {
            attr: { patternTransform: "translate(0, 20)" },
            duration: 0.35,
            repeat: -1,
            ease: "none",
        });

        const flicker = () => {
            const tl = gsap.timeline({
                onComplete: () => gsap.delayedCall(Math.random() * 3 + 1.5, flicker),
            });
            const count = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < count; i++) {
                tl.to("#screenGroup", { opacity: Math.random() * 0.25 + 0.7, duration: 0.04 })
                    .to("#screenGroup", { opacity: 1, duration: 0.04 });
            }
        };
        gsap.delayedCall(2, flicker);

        const twitch = () => {
            gsap.to("#faceGroup", {
                x: (Math.random() - 0.5) * 3,
                y: (Math.random() - 0.5) * 2,
                duration: 0.07,
                onComplete: () => {
                    gsap.to("#faceGroup", {
                        x: 0, y: 0, duration: 0.09,
                        onComplete: () => gsap.delayedCall(Math.random() * 5 + 3, twitch)
                    });
                },
            });
        };
        gsap.delayedCall(3, twitch);

    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "20px",
            background: "#111",
        }}>
            <svg
                ref={svgRef}
                width="400"
                height="300"
                viewBox="0 0 400 300"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <clipPath id="screenClip">
                        <rect x="20" y="24" width="360" height="260" rx="18" />
                    </clipPath>

                    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
                        <rect width="4" height="2" fill="#000" opacity="0.28" />
                    </pattern>

                    // --- abberation --- //
                    <filter id="chromaFace" x="-5%" y="-5%" width="110%" height="105%" colorInterpolationFilters="sRGB">
                        <feColorMatrix type="matrix" in="SourceGraphic" result="red"
                                       values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                        <feOffset in="red" dx="-1.5" dy="0" result="redShift" />
                        <feColorMatrix type="matrix" in="SourceGraphic" result="blue"
                                       values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
                        <feOffset in="blue" dx="1.5" dy="0" result="blueShift" />
                        <feColorMatrix type="matrix" in="SourceGraphic" result="green"
                                       values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                        <feBlend in="redShift" in2="green" mode="screen" result="rg" />
                        <feBlend in="rg" in2="blueShift" mode="screen" result="rgb" />
                        <feGaussianBlur in="rgb" stdDeviation="0.5" result="glow" />
                        <feBlend in="rgb" in2="glow" mode="screen" />
                    </filter>

                    <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                        <stop offset="75%" stopColor="transparent" />
                        <stop offset="100%" stopColor="#232" stopOpacity="0.32" />
                    </radialGradient>
                </defs>

                <rect x="0" y="0" width="400" height="300" rx="25" fill="#24d8e6" />
                <rect x="3" y="3" width="394" height="294" rx="25" fill="#22a3a4" />
                <rect x="10" y="10" width="380" height="280" rx="18" fill="#4d826e" />

                <g id="screenGroup">
                    <rect x="20" y="24" width="360" height="260" rx="18" fill="#91e6d2" />

                    <g id="faceGroup" clipPath="url(#screenClip)" filter="url(#chromaFace)">
                        <path d="M120 70 Q140 55 160 70" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
                        <path d="M240 70 Q260 55 280 70" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />

                        <ellipse id="reflLeft"  cx="148" cy="108" rx="5" ry="6"  fill="#5fecd8" opacity="0.55" />
                        <ellipse id="reflRight" cx="268" cy="108" rx="5" ry="6"  fill="#5fecd8" opacity="0.55" />

                        <ellipse id="pupilLeft"  cx="140" cy="120" rx="12" ry="18" fill="#222" />
                        <ellipse id="pupilRight" cx="260" cy="120" rx="12" ry="18" fill="#222" />

                        <path
                            id="mouth"
                            d="M 150,198 Q 200,210 250,198 A 2,2 0 0 1 250,202 Q 200,214 150,202 A 2,2 0 0 1 150,198 Z"
                            fill="#222"
                        />
                    </g>

                    <rect
                        x="20" y="24" width="360" height="260" rx="18"
                        fill="url(#scanlines)"
                        clipPath="url(#screenClip)"
                        style={{ pointerEvents: "none" }}
                    />

                    <rect
                        x="20" y="24" width="360" height="260" rx="18"
                        fill="url(#vignette)"
                        clipPath="url(#screenClip)"
                        style={{ pointerEvents: "none" }}
                    />
                </g>
            </svg>

            <button style={{
                padding: "10px 20px",
                fontSize: "16px",
                borderRadius: "5px",
                cursor: "pointer",
            }}>
                Do Nothing
            </button>
        </div>
    );
}

export default App;