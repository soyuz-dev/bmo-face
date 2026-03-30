// App.tsx
import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import "./App.css";

function App() {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current) {
            // Pupils move from -20 to 20
            gsap.fromTo(
                ["#pupilLeft", "#pupilRight", "#pupilHighlightLeft", "#pupilHighlightRight"],
                { x: -20 },
                { x: 20, duration: 1, yoyo: true, repeat: -1, ease: "power1.inOut" }
            );
        }
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "20px"
        }}>
            <svg
                ref={svgRef}
                width="400"
                height="300"
                viewBox="0 0 400 300"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* background */}
                <rect x="0" y="0" width="400" height="300" rx="25" fill="#86d8e7" />

                {/* left eye */}
                <circle id="leftEye" cx="140" cy="120" r="40" fill="white" />
                <circle id="pupilLeft" cx="140" cy="120" r="16" fill="#222" />
                <circle id="pupilHighlightLeft" cx="134" cy="114" r="5" fill="white" />

                {/* right eye */}
                <circle id="rightEye" cx="260" cy="120" r="40" fill="white" />
                <circle id="pupilRight" cx="260" cy="120" r="16" fill="#222" />
                <circle id="pupilHighlightRight" cx="254" cy="114" r="5" fill="white" />

                {/* eyebrows */}
                <path id="leftBrow" d="M110 70 Q140 55 170 70" stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />
                <path id="rightBrow" d="M230 70 Q260 55 290 70" stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />

                {/* mouth */}
                <path id="mouth" d="M150 200 Q200 230 250 200" stroke="#222" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>

            <button style={{ padding: "10px 20px", fontSize: "16px", borderRadius: "5px", cursor: "pointer" }}>
                Do Nothing
            </button>
        </div>
    );
}

export default App;