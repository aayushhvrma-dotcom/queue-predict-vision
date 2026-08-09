# QueuePredict Pro

You are an expert full-stack developer. Build a complete, production-ready React application called "QueuePredict". 

The application consists of two main parts:
1. A Cinematic Landing Page (index route).
2. The QueuePredict Interactive Map Application (app route).

Do NOT use generic placeholders. Implement real functionality, real UI components, and the exact styling specified below.

### TECH STACK
- Frontend: React 18, Tailwind CSS, Framer Motion, Lucide React
- Map: react-leaflet, leaflet (OpenStreetMap/Carto Dark tiles)
- Backend & Auth: Supabase (@supabase/supabase-js)
- Routing: React Router (or equivalent based on framework)

---

### PART 1: CINEMATIC LANDING PAGE (INDEX)
Build a single-page landing site with two full-height sections (Hero + Capabilities), both using looping background videos with custom JS crossfade, a shared liquid-glass design system, and Framer Motion entrance animations.

Fonts: Google Fonts 'Instrument Serif' (italic) for headings, 'Barlow' for body.
Border radius override: DEFAULT: "9999px" (pill).

Liquid-glass utilities (CSS):
.liquid-glass: background: rgba(255,255,255,0.01); background-blend-mode: luminosity; backdrop-filter: blur(4px); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); relative, hidden overflow. pseudo ::before with 1.4px padding linear gradient border mask.
.liquid-glass-strong: backdrop-filter: blur(50px); box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15).

FadingVideo Component:
Wraps a <video autoPlay muted playsInline> starting at opacity: 0. Crossfades on loop using requestAnimationFrame (no CSS transitions). 
Hero Video: https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4
Capabilities Video: https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4

Hero Section:
- Navbar: fixed top, liquid-glass pill with links (Home, Voyages, Worlds, Innovation, Plan Launch) and a "Claim a Spot" CTA.
- BlurText animated headline: "Venture Past Our Sky Across the Universe".
- Subheading: "Discover the universe in ways once unimaginable..."
- CTA: "Start Your Voyage" (Links to the QueuePredict App route).
- Stats row: Two liquid-glass cards (34.5 Min / 2.8B+).
- Partners: Aeon, Vela, Apex, Orbit, Zeno.

Capabilities Section:
- Header: "Production evolved"
- Grid of 3 liquid-glass cards (AI Scenery, Batch Production, Smart Lighting) with respective Material Icons and pill tags.

---

### PART 2: QUEUEPREDICT APPLICATION (APP ROUTE)
When the user clicks the main CTA on the landing page, they enter the QueuePredict application. This is an AI-powered real-time queue prediction platform.

MAIN PURPOSE:
Help users know if a place (banks, hospitals, etc.) is crowded, estimated wait times, and future predictions.

DESIGN SYSTEM (Premium Mid-Tone Theme):
- Background: #17151F (Deep charcoal)
- Surface/Cards: #211D2B (Dark purple/gray) with glass-like styles (bg-white/5, backdrop-blur)
- Primary Accent: #7C3AED & #9B5CFF (Violet gradients)
- Danger/High Crowd: #EF4444 & #DC2626 (Crimson red)
- Text: #F5F3FF (Off-white) and #A9A3B8 (Muted)
- No cyberpunk/neon extremes. Premium, trustworthy, soft shadows.

CORE FEATURES TO BUILD:
1. Real Interactive Map (react-leaflet):
   - Request browser geolocation on load. Center map on user.
   - Use Carto Dark map tiles to match the theme.
   - Display map markers for nearby locations (Banks initially).
   - Overlay a floating Search bar at the top.

2. Slide-out Details Panel:
   - When a map marker is clicked, slide in a panel (bottom on mobile, left/right side on desktop).
   - Display: Real address, Distance, Current Crowd Status (animated indicator), Estimated Wait Time.
   - Display: AI Forecast Graph (mock a 4-hour prediction graph).

3. Crowd Reporting System:
   - "Report Crowd" button opens a modal.
   - Options: Very Low, Low, Moderate, High, Very High.
   - Input for estimated waiting time (minutes).
   - Save this report to the Supabase database.

4. User Authentication:
   - Create a clean Auth screen (Sign Up / Log In).
   - Require authentication to submit a report or view the profile.

5. Navigation:
   - Desktop: Left sidebar with Logo, Map, Saved, Profile, Logout.
   - Mobile: Bottom navigation bar.

---

### PART 3: DATABASE SCHEMA (SUPABASE)
Write the integration to connect to a Supabase backend using these exact tables. Implement the SQL schema directly if the platform supports it, or assume this structure:

1. profiles (id UUID, name TEXT, email TEXT)
2. places (id UUID, name TEXT, address TEXT, latitude FLOAT, longitude FLOAT, category TEXT)
3. crowd_reports (id UUID, place_id UUID, user_id UUID, crowd_level TEXT, estimated_wait_mins INT)
4. saved_places (id UUID, user_id UUID, place_id UUID)

---

### STRICT REQUIREMENTS
- DO NOT redesign the Landing Page. Build it exactly as specified with the videos and liquid glass.
- EVERY BUTTON MUST WORK. Do not create fake UI.
- Handle error states (Location denied, API failure, Auth failure).
- Make the app fully responsive (mobile bottom nav, desktop sidebar).
- Do not expose API keys in the code (use environment variables).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://queue-predict-vision.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0ed0ca9b-b5d3-4cc2-81be-73fe40cad35d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
