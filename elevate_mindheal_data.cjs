const fs = require('fs');

let content = fs.readFileSync('src/data/mindheal-data.js', 'utf8');

// Elevate AI Counselling
content = content.replace(
  /"A private, always-available chat companion for emotional reflection and first-step support."/g,
  '"A confidential, omnipresent AI companion designed for profound emotional introspection and immediate preliminary psychological support."'
);

// Elevate Human Counselling
content = content.replace(
  /"Book verified counsellors for text chat, audio sessions, video sessions, or group healing."/g,
  '"Consult credentialed clinical experts for immersive text, audio, high-definition video interventions, or collaborative group therapy."'
);

// Elevate CBT Tools
content = content.replace(
  /"Thought diary, mood tracker, coping cards, daily diary, tests, and guided exercises."/g,
  '"Comprehensive cognitive behavioral frameworks, including distortion tracking, resilience paradigms, and empirical psychometric evaluations."'
);

// Elevate Mood Tracker
content = content.replace(
  /"Log your daily emotional states to uncover hidden cognitive patterns and triggers."/g,
  '"Systematically document affective states to illuminate subconscious cognitive paradigms and mitigate psychological triggers."'
);

// Elevate Dream Analysis
content = content.replace(
  /"Submit typed dreams, photos, or voice recordings for reflective psychological analysis."/g,
  '"Provide narrative or multimedia dream transcripts for rigorous psychoanalytic interpretation and archetype deconstruction."'
);

// Elevate Handwriting
content = content.replace(
  /"Upload handwriting\/signature samples for personality and reflection-oriented reports."/g,
  '"Upload graphological specimens for sophisticated biometric and personality profiling through advanced stroke analysis."'
);

// Elevate Mind Games
content = content.replace(
  /"Short games and exercises for focus, memory, anxiety, grounding, and emotional awareness."/g,
  '"Neurocognitive interactive modules meticulously engineered to optimize executive function, emotional regulation, and immediate grounding."'
);

// Elevate Focus Tools
content = content.replace(
  /"Breathing exercises, Pomodoro timer, grounding, ambient sounds, and guided meditations."/g,
  '"Advanced physiological modulation techniques, encompassing structured breathwork, auditory soundscapes, and focused mindfulness interventions."'
);

// Elevate Healing Map
content = content.replace(
  /"Find verified counsellor clinics, rehabilitation centres, hospitals, and wellness spaces nearby."/g,
  '"Navigate an aggregated geo-spatial directory of accredited clinical sanctuaries, therapeutic retreats, and psychiatric institutions."'
);

// Elevate Group Sessions
content = content.replace(
  /"Counsellor-led group sessions for anxiety, grief, addiction recovery, trauma, and support circles."/g,
  '"Clinician-facilitated collective healing environments addressing complex trauma, prolonged grief, and systematic addiction recovery."'
);

fs.writeFileSync('src/data/mindheal-data.js', content);
console.log("mindheal-data.js elevated successfully.");
