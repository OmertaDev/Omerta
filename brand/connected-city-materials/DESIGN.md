# Design and handoff

The direction is a noir editorial feature: large ivory serif headlines, brass emphasis, cinematic photographs and visible ledger rules. It reuses Omertà’s existing display font and generated campaign footage. Palette: ink #101616, ivory #eee8db, brass #c7af79, teal #aacac0. Body type is 18px Arial; heading sizes scale from 38–116px. Spacing uses a 20/30/40/60/100px rhythm with responsive gutters. Square surfaces, one-pixel rules, no decorative shadows.

Screen order: introduction → three mechanisms → built/next availability → screening room → supporting materials → one primary Explore Omertà CTA. The page is a standalone draft, not a production deployment. No email collection, analytics, wallet interaction, transaction or account configuration is added.

Desktop uses paired editorial columns. At 850px gaps and typography tighten; at 600px sections stack and navigation wraps. The availability table scrolls horizontally in its labeled focusable region. Film selection remains a native labeled select; changes pause playback and announce selection without autoplay. Download links remain available after media failure. Keyboard focus is visible, headings are semantic, and a skip link reaches main content. Reduced motion disables smooth scrolling; background motion never autoplays. No forms, authentication, modal, empty data or submission states are present.

Use the included preview server. Publishing is a separate action. The portable package uses relative assets, so media and supporting pages must stay beside index.html. A published deployment should set its canonical URL and absolute Open Graph image URL after a destination is selected.
