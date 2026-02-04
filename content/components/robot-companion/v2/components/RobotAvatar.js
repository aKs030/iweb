import { createElement } from 'react';
import htm from 'htm';

const html = htm.bind(createElement);

export const RobotAvatar = ({ animationRefs, onClick, mood }) => {
  const { eyesRef, leftPupilRef, rightPupilRef } = animationRefs;

  return html`
    <button className="robot-avatar" aria-label="Chat öffnen" onClick=${onClick}>
      <svg viewBox="0 0 100 100" className="robot-svg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="lidShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.35" />
          </filter>
          <linearGradient id="lidGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0b1220" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
          </linearGradient>
        </defs>

        <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" strokeWidth="2" />
        <circle cx="50" cy="15" r="3" className="robot-antenna-light" fill="#ff4444" />

        <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" strokeWidth="2" />
        <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" strokeWidth="2" />

        <g className="robot-eyes" ref=${eyesRef}>
          <circle className="robot-pupil" cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" ref=${leftPupilRef} />
          <path className="robot-lid" d="M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />

          <circle className="robot-pupil" cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" ref=${rightPupilRef} />
          <path className="robot-lid" d="M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
        </g>

        <path className="robot-legs" d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" strokeWidth="2" />

        <g className="robot-arms">
            <path className="robot-arm left" d="M30,62 Q20,70 25,80" fill="none" stroke="#40e0d0" strokeWidth="3" strokeLinecap="round" />
            <path className="robot-arm right" d="M70,62 Q80,70 75,80" fill="none" stroke="#40e0d0" strokeWidth="3" strokeLinecap="round" />
        </g>

        <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </button>
  `;
};
