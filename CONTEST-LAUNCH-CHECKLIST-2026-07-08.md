# ESP32 Circuit Playground Contest Launch Checklist

> For Hermes: execute this plan against the existing vanilla-JS app in /home/hermes/esp32. Optimize for public clarity, visible Hy3 involvement, and fast contest readiness. Do not rewrite the frontend stack unless the current code blocks a must-have contest feature.

Goal: ship a public, easy-to-understand Hy3-powered web demo that is strong enough for the Novita x Hy3 Build Challenge submission and polished enough to keep extending after launch.

Architecture: keep deterministic wiring/pin planning in local app logic, and use Hy3 for sketch adaptation, beginner-friendly explanations, and refinement via chat. Build around one flagship visible flow: Weather Station -> add Rain Gauge -> add Anemometer.

Tech stack: static vanilla JS frontend, Vercel deploy, serverless /api/agent handler, OpenRouter Hy3 model, public GitHub repo, X/Discord submission assets.

Contest constraints verified:
- Public project required
- Hy3 must be meaningfully used
- Result should be easy to understand / visible
- Public X post required with:
  - @TencentHunyuan
  - @novita_labs
  - #Hy3Novita
- X post should include proof item(s): screenshot, video, live demo, GitHub repo, or project page
- Submit the X post link in Discord before deadline
- Deadline: Jul 21, 2026 8:59:59 AM PT

Animation budget note:
- We have $100 in Novita credits available if lightweight animation/video generation clearly improves the submission assets.
- Do not spend credits on speculative polish before the core live demo is solid.

---

## Success criteria

The launch is good enough when all of the following are true:
- A public user can open the app and understand it in under 10 seconds.
- The app visibly shows Hy3 doing useful work, not just sitting in a chat box.
- Weather Station + Rain Gauge + Anemometer works as the hero flow.
- Module changes automatically update the sketch.
- The wiring diagram is visually trustworthy and screenshot-worthy.
- We have a public URL, public repo, clean screenshots, and a short demo clip.
- We have submission-ready X copy and Discord submission info.

---

## Priority legend

- MUST = required for contest-quality launch
- SHOULD = high-value if time allows before submission
- NICE = post-launch or only if extremely cheap

---

## Phase 1 — Lock the flagship flow (MUST)

### 1. Confirm source of truth
Objective: ensure local repo is the real working app and all new work lands there.

Files:
- Repo: `/home/hermes/esp32`

Checklist:
- [x] Recovered deployed frontend into repo
- [x] Added tracked package/api scaffolding
- [x] Committed recovered baseline
- [x] Started weather pulse module slice
- [ ] Push local repo to GitHub after review/approval
- [ ] Confirm Vercel deploy source/path from this repo

Verification:
- `git -C /home/hermes/esp32 log --oneline -n 5`
- GitHub repo visibly contains the app source, not just README

### 2. Finish the hero interaction path
Objective: make the demo story strong even if nothing else ships.

Files:
- Modify: `/home/hermes/esp32/modules.js`
- Modify: `/home/hermes/esp32/pinmap.js`
- Modify: `/home/hermes/esp32/fallback.js`
- Modify: `/home/hermes/esp32/app.js`

Checklist:
- [x] Add `rain_gauge`
- [x] Add `anemometer`
- [x] Add deterministic warnings and pin allocation
- [x] Add automatic regeneration on module changes
- [ ] Verify both modules behave correctly on repeated toggles
- [ ] Verify chat history/refinement still behaves sanely after auto-regeneration

Verification:
- Select Weather Station
- Toggle Rain Gauge on -> code updates
- Toggle Anemometer on -> code updates
- Toggle one off -> code updates again
- No broken state, no duplicate pin claims, no stuck UI

### 3. Make the auto-update feel intentional
Objective: make module-driven sketch updates feel polished rather than noisy.

Files:
- Modify: `/home/hermes/esp32/app.js`
- Modify: `/home/hermes/esp32/style.css`

Checklist:
- [ ] Replace generic fallback/status wording with concise contest-friendly wording
- [ ] Add a short visible “Hy3 updated the sketch for your hardware” state
- [ ] Keep silent auto-regeneration from flooding the chat log
- [ ] Preserve explicit user chat turns as the “deeper explanation” path

Verification:
- Preset click gives one clean status update
- Module toggle gives one clean update
- Chat log remains readable after 3-5 configuration changes

---

## Phase 2 — Make it screenshot/video worthy (MUST)

### 4. Upgrade diagram realism for the weather hero path
Objective: make the board/modules/wiring obviously visual and trustworthy.

Files:
- Modify: `/home/hermes/esp32/diagram.js`
- Modify: `/home/hermes/esp32/style.css`
- Optional assets if needed: `/home/hermes/esp32/assets/...`

Checklist:
- [ ] Improve DevKit board rendering so it looks less placeholder-ish
- [ ] Give Rain Gauge a distinct realistic sensor representation
- [ ] Give Anemometer a distinct realistic sensor representation
- [ ] Improve wire labeling and color consistency
- [ ] Make warning/callout text legible in screenshots
- [ ] Keep rendering deterministic and fast

Visual guidance:
- Prefer realistic breakout/field-hardware hybrid style
- Do not overcomplicate with a full CAD look
- Use consistent colors for power, ground, I2C, pulse inputs

Verification:
- Capture one full-app screenshot and one diagram-focused screenshot
- Both should be understandable without narration

### 5. Improve page framing for first-time viewers
Objective: help judges/X viewers understand the app instantly.

Files:
- Modify: `/home/hermes/esp32/index.html`
- Modify: `/home/hermes/esp32/style.css`

Checklist:
- [ ] Add a short hero subtitle explaining the product in one line
- [ ] Add a short “How it works” cue if needed
- [ ] Make the right panel clearly read as Hy3-powered
- [ ] Make the generated sketch section feel obviously central to the value

Suggested hero copy direction:
- “Build ESP32 projects visually. Add components, get safe wiring, and let Hy3 adapt the code.”

Verification:
- A cold viewer should understand what the app does in 5-10 seconds

---

## Phase 3 — Make Hy3 obviously meaningful (MUST)

### 6. Tighten the Hy3 agent prompt and output contract
Objective: make Hy3 visibly useful and aligned with contest judging.

Files:
- Modify: `/home/hermes/esp32/api/agent.js`
- Modify if needed: `/home/hermes/esp32/app.js`

Checklist:
- [ ] Instruct Hy3 to be concise and beginner-friendly
- [ ] Instruct Hy3 to explain what changed after module additions
- [ ] Instruct Hy3 never to invent pin assignments
- [ ] Pass deterministic hardware plan clearly into the prompt
- [ ] Prefer delta-aware explanations (“I added rain measurement using ...”)
- [ ] Return code + short explanation + optional warnings in a stable shape

Target behavior examples:
- “I added a rain gauge on GPIO13 using interrupt-based pulse counting. Each tip adds to rainfall total, but you should confirm the mm-per-tip constant for your exact sensor.”
- “I added an anemometer on GPIO14 using pulse counting. Wind speed depends on your sensor calibration, so I left a constant to tune.”

Verification:
- Run 3 test prompts against live agent path
- Output should be concise, grounded, and visibly tied to selected hardware

### 7. Make fallback mode contest-safe
Objective: ensure the public demo still looks competent if the live agent is unavailable.

Files:
- Modify if needed: `/home/hermes/esp32/fallback.js`
- Modify if needed: `/home/hermes/esp32/app.js`

Checklist:
- [ ] Fallback code should look plausible, not toy-like
- [ ] Fallback serial lines should reinforce the visual story
- [ ] Fallback messaging should not sound broken or apologetic
- [ ] UI should still communicate that Hy3 is the intended live path

Verification:
- Disable agent key / simulate failure
- Confirm the demo still feels intentional and useful

---

## Phase 4 — Public launch readiness (MUST)

### 8. Deploy and verify the public app
Objective: get the updated app live and verified end-to-end.

Files:
- Repo: `/home/hermes/esp32`
- Vercel project: `esp32-playground`

Checklist:
- [ ] Push approved commits to GitHub
- [ ] Deploy to Vercel
- [ ] Verify live URL loads cleanly
- [ ] Verify Weather Station hero flow on production
- [ ] Verify `/api/agent` works in production with intended model path
- [ ] Verify fallback still works if agent fails

Verification:
- Public URL loads on desktop cleanly
- Hero flow works without console errors
- One screenshot from prod and one short prod screen recording captured

### 9. Clean up the repo for public viewing
Objective: make the GitHub repo itself count as strong proof.

Files:
- Modify: `/home/hermes/esp32/README.md`
- Optional: `/home/hermes/esp32/docs/...`

Checklist:
- [ ] Rewrite README to explain the project clearly
- [ ] Add live demo link
- [ ] Add 2-3 screenshots or GIFs if practical
- [ ] Explain Hy3’s role explicitly
- [ ] Explain deterministic pin planning explicitly
- [ ] Add local run/deploy instructions

Verification:
- Repo page should make sense to a stranger without additional context

---

## Phase 5 — Submission assets (MUST)

### 10. Capture submission visuals
Objective: produce assets for X and Discord that show the app instantly.

Artifacts:
- Full-page screenshot
- Diagram close-up
- 20-45 second screen recording
- Optional GIF teaser

Hero capture sequence:
1. Open the app
2. Click Weather Station
3. Add Rain Gauge
4. Show diagram/code update
5. Add Anemometer
6. Show second update
7. Show Hy3 explanation / updated sketch / serial monitor
8. End on the fully configured weather setup

Checklist:
- [ ] Capture still screenshot of the polished app
- [ ] Capture a short clean video of the hero sequence
- [ ] Trim dead time
- [ ] Ensure text is readable in the recording

Animation/credits note:
- Only use Novita credits if a lightweight animation materially improves the X post or demo reel
- Best candidates:
  - short branded motion intro/outro
  - looped UI teaser clip
  - subtle explainer asset
- Avoid spending credits on flashy but non-explanatory motion

### 11. Draft the X submission post
Objective: prepare a post that is clear, compliant, and shareable.

Checklist:
- [ ] Explain the project in one sentence
- [ ] State what Hy3 is doing meaningfully
- [ ] Attach screenshot or video
- [ ] Include live demo link
- [ ] Include GitHub repo link
- [ ] Include required tags:
  - @TencentHunyuan
  - @novita_labs
  - #Hy3Novita

Suggested structure:
- Hook: what the app does
- Why it’s cool: visual wiring + automatic code adaptation
- Why Hy3 matters: writes/adapts the firmware and explains the build
- Links: live demo + repo
- Media: screenshot/video

Draft template:
“Built an ESP32 Circuit Playground with Hy3: a visual web demo where you start from a preset, add hardware like a rain gauge or anemometer, get a safe wiring diagram instantly, and Hy3 adapts the Arduino sketch and explains the changes.

Live demo: <url>
GitHub: <url>

@TencentHunyuan @novita_labs #Hy3Novita”

### 12. Submit in Discord
Objective: complete the valid contest submission.

Checklist:
- [ ] Publish the public X post
- [ ] Copy the X post URL
- [ ] Submit the link in Discord before deadline
- [ ] Save the final submission link(s) in project notes

---

## High-value SHOULD items

### A. Add a “what changed” summary card
- Short panel that summarizes the latest hardware delta
- Example: “Added Rain Gauge on GPIO13; updated sketch with pulse counting and rainfall total.”

### B. Add one-click demo mode
- A simple scripted UI sequence for recording a perfect clip quickly

### C. Add one more weather-adjacent module if cheap
Good candidates:
- light sensor
- UV sensor
Do not add this until the hero flow is fully polished.

### D. Add small tasteful animation only if it supports clarity
Possible uses:
- subtle panel transitions
- animated wire highlight on newly added module
- simple serial activity pulse
Avoid novelty animation that hurts readability.

---

## NICE / post-submission items

- More presets
- More modules beyond the hero flow
- Framework migration
- More advanced visual asset pipeline
- Richer firmware examples
- Social promo variants / extended landing page

---

## Risks to avoid

- Do not broaden scope before the hero flow is excellent.
- Do not spend days on architecture cleanup that users can’t see.
- Do not let Hy3 invent hardware assignments.
- Do not rely on fragile live-only behavior without a graceful fallback.
- Do not produce a crowded UI that hurts screenshot readability.
- Do not spend Novita credits on animation before the core demo is submission-ready.

---

## Recommended next build order

1. Diagram realism upgrade for Rain Gauge + Anemometer
2. Hy3 prompt/output tightening in `/api/agent.js`
3. Page framing/hero copy cleanup in `index.html` + `style.css`
4. Production deploy and verify
5. README/public repo cleanup
6. Screenshot + video capture
7. X post draft and submission

---

## Definition of done for contest launch

We are done enough to submit when:
- The live demo is public and stable
- The hero flow is polished and easy to understand
- Hy3’s role is obvious
- The repo is public and clear
- We have a clean screenshot and short demo clip
- The X post is drafted with required tags
- The Discord submission path is ready
