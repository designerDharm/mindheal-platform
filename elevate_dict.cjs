const fs = require('fs');

let content = fs.readFileSync('src/utils/i18n.js', 'utf8');

// Elevate English Dictionary
const replacements = [
  ['"Find Counsellors": "Find Counsellors"', '"Find Counsellors": "Discover Clinical Experts"'],
  ['"About Us": "About Us"', '"About Us": "Our Philosophy"'],
  ['"Dashboard": "Dashboard"', '"Dashboard": "Command Center"'],
  ['"Get Started": "Get Started"', '"Get Started": "Commence Journey"'],
  ['"Start Free with AI": "Start Free with AI"', '"Start Free with AI": "Initiate Autonomous Support"'],
  ['"Go to Dashboard": "Go to Dashboard"', '"Go to Dashboard": "Enter Command Center"'],
  ['"Book a Therapist": "Book a Therapist"', '"Book a Therapist": "Schedule Clinical Intervention"'],
  ['"Verified Experts": "Verified Experts"', '"Verified Experts": "Credentialed Authorities"'],
  ['"The System is Broken. We Fixed It.": "The System is Broken. We Fixed It."', '"The System is Broken. We Fixed It.": "The Paradigm was Flawed. We Engineered the Solution."'],
  ['"The Waiting List Trap": "The Waiting List Trap"', '"The Waiting List Trap": "The Bureaucratic Delay"'],
  ['"The Language Barrier": "The Language Barrier"', '"The Language Barrier": "Linguistic Accessibility"'],
  ['"The Stigma Tax": "The Stigma Tax"', '"The Stigma Tax": "The Societal Stigma"'],
  ['"An Entire Clinic in Your Pocket.": "An Entire Clinic in Your Pocket."', '"An Entire Clinic in Your Pocket.": "A Comprehensive Clinical Ecosystem in Your Hands."'],
  ['"Try it Now": "Try it Now"', '"Try it Now": "Experience Now"'],
  ['"Play Now": "Play Now"', '"Play Now": "Engage Module"'],
  ['"Start Focusing": "Start Focusing"', '"Start Focusing": "Initiate Focus Sequence"'],
  ['"Open Map": "Open Map"', '"Open Map": "Access Geospatial Directory"'],
  ['"Take a Test": "Take a Test"', '"Take a Test": "Commence Psychometric Evaluation"'],
  ['"Start Journaling": "Start Journaling"', '"Start Journaling": "Initiate Cognitive Journaling"'],
  ['"Browse Courses": "Browse Courses"', '"Browse Courses": "Explore Academic Modules"'],
  ['"Simple, Transparent Pricing": "Simple, Transparent Pricing"', '"Simple, Transparent Pricing": "Equitable, Transparent Economics"'],
  ['"Get Immediate Help": "Get Immediate Help"', '"Get Immediate Help": "Request Immediate Intervention"'],
  ['"Simple Process": "Simple Process"', '"Simple Process": "Streamlined Methodology"'],
  ['"Choose Your Path": "Choose Your Path"', '"Choose Your Path": "Select Your Therapeutic Trajectory"'],
  ['"Begin Healing": "Begin Healing"', '"Begin Healing": "Commence Cognitive Restoration"'],
  ['"Grow Your Practice": "Grow Your Practice"', '"Grow Your Practice": "Expand Your Clinical Footprint"'],
  ['"Know Thyself": "Know Thyself"', '"Know Thyself": "Cognitive Self-Actualization"']
];

for (const [orig, elevated] of replacements) {
  content = content.replace(orig, elevated);
}

fs.writeFileSync('src/utils/i18n.js', content);
console.log("English dictionary elevated.");
