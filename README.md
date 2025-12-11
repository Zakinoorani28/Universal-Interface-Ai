# AccessiAI — Universal Interface AI

Live Demo: [https://universal-interface-ai](https://ai.studio/apps/drive/1JRlp7_kLjZFPLqogpuyjnDJAYRTZuSp6?fullscreenApplet=true)

## Overview
AccessiAI converts website screenshots into actionable accessibility outputs (UI summary, step-by-step plan, JSON automation script, accessibility rewrite, and a downloadable A4 PDF). Built with Gemini 3 Pro in Google AI Studio Build.
Upload a screenshot or URL to generate visual summaries, step-by-step automation plans, JSON automation scripts, accessibility rewrites, voice commands, and a branded A4 PDF report.

---

## Key Features
- Multimodal visual analysis with Gemini 3 Pro (screenshot + optional page URL)
- UI interpretation and human-readable page summary
- Step-by-step execution plan & JSON automation script
- Accessibility rewrite and ARIA recommendations
- Voice commands + client-side TTS (play/pause/resume)
- Branded, paginated A4 PDF export (client-side, high-quality)
- Local-first design: sensitive operations and PDF generation occur in-browser when possible

---

## How to run locally
1. Clone repo
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000 (or the port shown)

## Notes
- The public demo runs in Google AI Studio (Gemini 3 Pro). Keep your AI Studio app published for judges.
- PDF generation happens client-side (html2canvas + jsPDF); ensure browser allows large canvas rendering.

## License
MIT
