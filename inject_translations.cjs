const fs = require('fs');

let content = fs.readFileSync('src/utils/i18n.js', 'utf8');

const additionalTranslations = {
  "hi": {
    "Discover Clinical Experts": "नैदानिक विशेषज्ञों की खोज करें",
    "Our Philosophy": "हमारा दर्शन",
    "Command Center": "कमांड सेंटर",
    "Commence Journey": "यात्रा प्रारंभ करें",
    "Initiate Autonomous Support": "स्वायत्त सहायता प्रारंभ करें",
    "Enter Command Center": "कमांड सेंटर में प्रवेश करें",
    "Schedule Clinical Intervention": "नैदानिक हस्तक्षेप अनुसूची",
    "Credentialed Authorities": "प्रमाणित अधिकारी",
    "The Paradigm was Flawed. We Engineered the Solution.": "प्रतिमान दोषपूर्ण था। हमने समाधान तैयार किया।",
    "The Bureaucratic Delay": "नौकरशाही की देरी",
    "Linguistic Accessibility": "भाषाई पहुंच",
    "The Societal Stigma": "सामाजिक कलंक",
    "A Comprehensive Clinical Ecosystem in Your Hands.": "आपके हाथों में एक व्यापक नैदानिक पारिस्थितिकी तंत्र।",
    "Experience Now": "अब अनुभव करें",
    "Engage Module": "मॉड्यूल संलग्न करें",
    "Initiate Focus Sequence": "फोकस अनुक्रम प्रारंभ करें",
    "Access Geospatial Directory": "भू-स्थानिक निर्देशिका तक पहुंचें",
    "Commence Psychometric Evaluation": "मनोमितीय मूल्यांकन प्रारंभ करें",
    "Initiate Cognitive Journaling": "संज्ञानात्मक जर्नलिंग प्रारंभ करें",
    "Explore Academic Modules": "अकादमिक मॉड्यूल का अन्वेषण करें",
    "Equitable, Transparent Economics": "समान, पारदर्शी अर्थशास्त्र",
    "Request Immediate Intervention": "तत्काल हस्तक्षेप का अनुरोध करें",
    "Streamlined Methodology": "सुव्यवस्थित कार्यप्रणाली",
    "Select Your Therapeutic Trajectory": "अपने चिकित्सीय प्रक्षेपवक्र का चयन करें",
    "Commence Cognitive Restoration": "संज्ञानात्मक बहाली प्रारंभ करें",
    "Expand Your Clinical Footprint": "अपने नैदानिक पदचिह्न का विस्तार करें",
    "Cognitive Self-Actualization": "संज्ञानात्मक आत्म-साक्षात्कार",
    "A confidential, omnipresent AI companion designed for profound emotional introspection and immediate preliminary psychological support.": "गहन भावनात्मक आत्मनिरीक्षण और तत्काल प्रारंभिक मनोवैज्ञानिक सहायता के लिए डिज़ाइन किया गया एक गोपनीय, सर्वव्यापी एआई साथी।",
    "Consult credentialed clinical experts for immersive text, audio, high-definition video interventions, or collaborative group therapy.": "इमर्सिव टेक्स्ट, ऑडियो, हाई-डेफिनिशन वीडियो हस्तक्षेप, या सहयोगात्मक समूह थेरेपी के लिए प्रमाणित नैदानिक विशेषज्ञों से परामर्श लें।",
    "Comprehensive cognitive behavioral frameworks, including distortion tracking, resilience paradigms, and empirical psychometric evaluations.": "व्यापक संज्ञानात्मक व्यवहार ढांचे, जिसमें विरूपण ट्रैकिंग, लचीलापन प्रतिमान और अनुभवजन्य मनोमितीय मूल्यांकन शामिल हैं।",
    "Systematically document affective states to illuminate subconscious cognitive paradigms and mitigate psychological triggers.": "अवचेतन संज्ञानात्मक प्रतिमानों को रोशन करने और मनोवैज्ञानिक ट्रिगर्स को कम करने के लिए भावात्मक अवस्थाओं का व्यवस्थित रूप से दस्तावेजीकरण करें।",
    "Provide narrative or multimedia dream transcripts for rigorous psychoanalytic interpretation and archetype deconstruction.": "कठोर मनोविश्लेषणात्मक व्याख्या और मूलरूप विखंडन के लिए कथा या मल्टीमीडिया स्वप्न प्रतिलेख प्रदान करें।",
    "Upload graphological specimens for sophisticated biometric and personality profiling through advanced stroke analysis.": "उन्नत स्ट्रोक विश्लेषण के माध्यम से परिष्कृत बायोमेट्रिक और व्यक्तित्व प्रोफाइलिंग के लिए ग्राफोलॉजिकल नमूने अपलोड करें।",
    "Neurocognitive interactive modules meticulously engineered to optimize executive function, emotional regulation, and immediate grounding.": "कार्यकारी कार्य, भावनात्मक विनियमन और तत्काल ग्राउंडिंग को अनुकूलित करने के लिए सावधानीपूर्वक इंजीनियर किए गए न्यूरोकोग्निटिव इंटरैक्टिव मॉड्यूल।",
    "Advanced physiological modulation techniques, encompassing structured breathwork, auditory soundscapes, and focused mindfulness interventions.": "उन्नत शारीरिक मॉड्यूलेशन तकनीक, जिसमें संरचित श्वास कार्य, श्रवण ध्वनियां और केंद्रित माइंडफुलनेस हस्तक्षेप शामिल हैं।",
    "Navigate an aggregated geo-spatial directory of accredited clinical sanctuaries, therapeutic retreats, and psychiatric institutions.": "मान्यता प्राप्त नैदानिक अभयारण्यों, चिकित्सीय रिट्रीट और मनोरोग संस्थानों की एकत्रित भू-स्थानिक निर्देशिका को नेविगेट करें।",
    "Clinician-facilitated collective healing environments addressing complex trauma, prolonged grief, and systematic addiction recovery.": "जटिल आघात, लंबे समय तक दुःख और व्यवस्थित व्यसन वसूली को संबोधित करते हुए चिकित्सक द्वारा सुगम सामूहिक उपचार वातावरण।"
  },
  "ar": {
    "Discover Clinical Experts": "اكتشف الخبراء السريريين",
    "Our Philosophy": "فلسفتنا",
    "Command Center": "مركز القيادة",
    "Commence Journey": "ابدأ الرحلة",
    "Initiate Autonomous Support": "بدء الدعم المستقل",
    "Enter Command Center": "أدخل مركز القيادة",
    "Schedule Clinical Intervention": "جدولة التدخل السريري",
    "Credentialed Authorities": "السلطات المعتمدة",
    "The Paradigm was Flawed. We Engineered the Solution.": "كان النموذج معيبًا. لقد صممنا الحل.",
    "The Bureaucratic Delay": "التأخير البيروقراطي",
    "Linguistic Accessibility": "إمكانية الوصول اللغوي",
    "The Societal Stigma": "الوصمة المجتمعية",
    "A Comprehensive Clinical Ecosystem in Your Hands.": "نظام بيئي سريري شامل بين يديك.",
    "Experience Now": "جرب الآن",
    "Engage Module": "تفعيل الوحدة",
    "Initiate Focus Sequence": "بدء تسلسل التركيز",
    "Access Geospatial Directory": "الوصول إلى الدليل الجغرافي المكاني",
    "Commence Psychometric Evaluation": "بدء التقييم النفسي",
    "Initiate Cognitive Journaling": "بدء التدوين المعرفي",
    "Explore Academic Modules": "استكشاف الوحدات الأكاديمية",
    "Equitable, Transparent Economics": "اقتصاديات عادلة وشفافة",
    "Request Immediate Intervention": "طلب تدخل فوري",
    "Streamlined Methodology": "منهجية مبسطة",
    "Select Your Therapeutic Trajectory": "اختر مسارك العلاجي",
    "Commence Cognitive Restoration": "بدء الاستعادة المعرفية",
    "Expand Your Clinical Footprint": "توسيع بصمتك السريرية",
    "Cognitive Self-Actualization": "تحقيق الذات المعرفي",
    "A confidential, omnipresent AI companion designed for profound emotional introspection and immediate preliminary psychological support.": "رفيق ذكاء اصطناعي سري وحاضر دائمًا مصمم للتأمل العاطفي العميق والدعم النفسي الأولي الفوري.",
    "Consult credentialed clinical experts for immersive text, audio, high-definition video interventions, or collaborative group therapy.": "استشر خبراء سريريين معتمدين للحصول على نصوص غامرة أو صوتيات أو تدخلات فيديو عالية الدقة أو علاج جماعي تعاوني.",
    "Comprehensive cognitive behavioral frameworks, including distortion tracking, resilience paradigms, and empirical psychometric evaluations.": "أطر سلوكية معرفية شاملة، بما في ذلك تتبع التشوه، ونماذج المرونة، والتقييمات النفسية التجريبية.",
    "Systematically document affective states to illuminate subconscious cognitive paradigms and mitigate psychological triggers.": "توثيق الحالات العاطفية بشكل منهجي لتسليط الضوء على النماذج المعرفية اللاواعية وتخفيف المحفزات النفسية.",
    "Provide narrative or multimedia dream transcripts for rigorous psychoanalytic interpretation and archetype deconstruction.": "تقديم نصوص أحلام سردية أو وسائط متعددة للتفسير التحليلي النفسي الصارم وتفكيك النموذج الأصلي.",
    "Upload graphological specimens for sophisticated biometric and personality profiling through advanced stroke analysis.": "تحميل عينات خطية للحصول على ملفات تعريف بيومترية وشخصية متطورة من خلال تحليل الضربات المتقدم.",
    "Neurocognitive interactive modules meticulously engineered to optimize executive function, emotional regulation, and immediate grounding.": "وحدات تفاعلية عصبية معرفية مصممة بدقة لتحسين الوظيفة التنفيذية والتنظيم العاطفي والتأريض الفوري.",
    "Advanced physiological modulation techniques, encompassing structured breathwork, auditory soundscapes, and focused mindfulness interventions.": "تقنيات التعديل الفسيولوجي المتقدمة، والتي تشمل عمل التنفس المنظم، والمناظر الصوتية السمعية، وتدخلات اليقظة المركزة.",
    "Navigate an aggregated geo-spatial directory of accredited clinical sanctuaries, therapeutic retreats, and psychiatric institutions.": "تصفح دليلاً جغرافياً مكانياً مجمعاً للملاذات السريرية المعتمدة، والخلوات العلاجية، والمؤسسات النفسية.",
    "Clinician-facilitated collective healing environments addressing complex trauma, prolonged grief, and systematic addiction recovery.": "بيئات التعافي الجماعي التي ييسرها الأطباء وتتصدى للصدمات المعقدة والحزن المطول والتعافي المنهجي من الإدمان."
  }
};

// Add to hi
const hiMatch = content.indexOf('"hi": {');
if (hiMatch !== -1) {
  let hiInsert = '';
  for (const [k, v] of Object.entries(additionalTranslations.hi)) {
    hiInsert += `    "${k}": "${v}",\n`;
  }
  content = content.slice(0, hiMatch + 8) + hiInsert + content.slice(hiMatch + 8);
}

// Add to ar
const arMatch = content.indexOf('"ar": {');
if (arMatch !== -1) {
  let arInsert = '';
  for (const [k, v] of Object.entries(additionalTranslations.ar)) {
    arInsert += `    "${k}": "${v}",\n`;
  }
  content = content.slice(0, arMatch + 8) + arInsert + content.slice(arMatch + 8);
}

fs.writeFileSync('src/utils/i18n.js', content);
console.log("Dictionary updated with missing translations.");
