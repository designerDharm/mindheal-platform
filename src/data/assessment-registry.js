/**
 * MindHeal Assessment Registry (SSoT)
 * Versioned, validated clinical inventory definitions, approved items, recall periods,
 * anchors, allowed values, deterministic scoring rules, and cut-off boundaries.
 * 
 * Official Source Standards:
 * - PHQ-9: Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief depression severity measure.
 *   J Gen Intern Med. 2001;16(9):606-613. Pfizer Inc. public screener rights.
 * - GAD-7: Spitzer RL, Kroenke K, Williams JB, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7.
 *   Arch Intern Med. 2006;166(10):1092-1097. Pfizer Inc. public screener rights.
 */

export const ASSESSMENT_REGISTRY_VERSION = "2026.1.0";

export const ANCHORS_4_POINT = [
  { value: 0, id: "not_at_all", label: "Not at all" },
  { value: 1, id: "several_days", label: "Several days" },
  { value: 2, id: "more_than_half", label: "More than half the days" },
  { value: 3, id: "nearly_every_day", label: "Nearly every day" }
];

export const ANCHORS_6_POINT = [
  { value: 5, id: "all_time", label: "All of the time" },
  { value: 4, id: "most_time", label: "Most of the time" },
  { value: 3, id: "more_than_half", label: "More than half of the time" },
  { value: 2, id: "less_than_half", label: "Less than half of the time" },
  { value: 1, id: "some_time", label: "Some of the time" },
  { value: 0, id: "at_no_time", label: "At no time" }
];

export const FUNCTIONAL_IMPACT_OPTIONS = [
  { value: 0, id: "not_difficult", label: "Not difficult at all" },
  { value: 1, id: "somewhat_difficult", label: "Somewhat difficult" },
  { value: 2, id: "very_difficult", label: "Very difficult" },
  { value: 3, id: "extremely_difficult", label: "Extremely difficult" }
];

export const INTAKE_CONTEXT_SCHEMA = {
  onsetDuration: {
    id: "onsetDuration",
    label: "Onset & Duration",
    description: "Approximately how long have you been experiencing these challenges?",
    type: "select",
    options: [
      { value: "less_than_1_month", label: "Less than a month" },
      { value: "1_to_6_months", label: "1 to 6 months" },
      { value: "6_to_12_months", label: "6 to 12 months" },
      { value: "more_than_1_year", label: "More than a year" }
    ]
  },
  dailyDifficulties: {
    id: "dailyDifficulties",
    label: "Daily Life Difficulties",
    description: "Which areas of your day feel most impacted right now? (Optional)",
    type: "multiselect",
    options: [
      { value: "work_study", label: "Work or studies" },
      { value: "relationships", label: "Family or relationships" },
      { value: "routine_sleep", label: "Daily chores, sleep or appetite" },
      { value: "socializing", label: "Social connections & hobbies" }
    ]
  },
  healthChanges: {
    id: "healthChanges",
    label: "Health, Medication or Life Changes",
    description: "Any recent physical health conditions, medications, substance changes or life stressors? (Optional)",
    type: "textarea",
    maxLength: 500
  },
  previousSupport: {
    id: "previousSupport",
    label: "Previous Support",
    description: "Have you previously consulted a therapist, counsellor or doctor for this? (Optional)",
    type: "select",
    options: [
      { value: "never", label: "No, this is my first time" },
      { value: "past_therapy", label: "Yes, in the past" },
      { value: "current_support", label: "Yes, currently in therapy/treatment" }
    ]
  },
  personalGoals: {
    id: "personalGoals",
    label: "Personal Goals",
    description: "What are you hoping to achieve or work through right now? (Optional)",
    type: "textarea",
    maxLength: 500
  }
};

export const ASSESSMENT_REGISTRY = {
  phq9: {
    id: "phq9",
    version: "2026.1.0",
    canonicalName: "Patient Health Questionnaire (PHQ-9)",
    shortName: "PHQ-9",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: false,
    minimumAge: 18,
    maximumAge: null,
    copyright: "Public domain screener (Pfizer Inc. PHQScreeners)",
    recallPeriod: "Over the last 2 weeks",
    administrationInstructions: "How often have you been bothered by any of the following problems over the last 2 weeks?",
    itemCount: 9,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    minScore: 0,
    maxScore: 27,
    anchors: ANCHORS_4_POINT,
    items: [
      { id: "phq9_q1", index: 1, text: "Little interest or pleasure in doing things?", category: "Anhedonia", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q2", index: 2, text: "Feeling down, depressed, or hopeless?", category: "Depressed mood", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q3", index: 3, text: "Trouble falling or staying asleep, or sleeping too much?", category: "Sleep disturbance", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q4", index: 4, text: "Feeling tired or having little energy?", category: "Fatigue", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q5", index: 5, text: "Poor appetite or overeating?", category: "Appetite changes", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q6", index: 6, text: "Feeling bad about yourself - or that you are a failure or have let yourself or your family down?", category: "Low self-worth", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q7", index: 7, text: "Trouble concentrating on things, such as reading the newspaper or watching television?", category: "Concentration", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q8", index: 8, text: "Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual?", category: "Psychomotor", allowedValues: [0, 1, 2, 3] },
      { id: "phq9_q9", index: 9, text: "Thoughts that you would be better off dead, or of hurting yourself in some way?", category: "Self-harm ideation", isSafetyCritical: true, allowedValues: [0, 1, 2, 3] }
    ],
    bands: [
      { min: 0, max: 4, label: "Minimal Depression", severity: "minimal", description: "Minimal or no depressive symptoms reported." },
      { min: 5, max: 9, label: "Mild Depression", severity: "mild", description: "Mild depressive symptoms reported." },
      { min: 10, max: 14, label: "Moderate Depression", severity: "moderate", description: "Moderate depressive symptoms reported. Clinical consultation advised." },
      { min: 15, max: 19, label: "Moderately Severe Depression", severity: "moderately_severe", description: "Moderately severe depressive symptoms reported. Clinical care recommended." },
      { min: 20, max: 27, label: "Severe Depression", severity: "severe", description: "Severe depressive symptoms reported. Prompt clinical evaluation strongly recommended." }
    ],
    functionalImpact: {
      id: "phq9_impact",
      isUnscored: true,
      text: "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?",
      options: FUNCTIONAL_IMPACT_OPTIONS
    }
  },
  gad7: {
    id: "gad7",
    version: "2026.1.0",
    canonicalName: "Generalized Anxiety Disorder Assessment (GAD-7)",
    shortName: "GAD-7",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: false,
    minimumAge: 18,
    maximumAge: null,
    copyright: "Public domain screener (Pfizer Inc. PHQScreeners)",
    recallPeriod: "Over the last 2 weeks",
    administrationInstructions: "How often have you been bothered by any of the following problems over the last 2 weeks?",
    itemCount: 7,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    minScore: 0,
    maxScore: 21,
    anchors: ANCHORS_4_POINT,
    items: [
      { id: "gad7_q1", index: 1, text: "Feeling nervous, anxious, or on edge?", category: "Nervousness", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q2", index: 2, text: "Not being able to stop or control worrying?", category: "Uncontrolled worry", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q3", index: 3, text: "Worrying too much about different things?", category: "Excessive worry", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q4", index: 4, text: "Trouble relaxing?", category: "Restlessness", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q5", index: 5, text: "Being so restless that it is hard to sit still?", category: "Motor agitation", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q6", index: 6, text: "Becoming easily annoyed or irritable?", category: "Irritability", allowedValues: [0, 1, 2, 3] },
      { id: "gad7_q7", index: 7, text: "Feeling afraid as if something awful might happen?", category: "Anticipatory dread", allowedValues: [0, 1, 2, 3] }
    ],
    bands: [
      { min: 0, max: 4, label: "Minimal Anxiety", severity: "minimal", description: "Minimal or no anxiety symptoms reported." },
      { min: 5, max: 9, label: "Mild Anxiety", severity: "mild", description: "Mild anxiety symptoms reported." },
      { min: 10, max: 14, label: "Moderate Anxiety", severity: "moderate", description: "Moderate anxiety symptoms reported. Clinical consultation advised." },
      { min: 15, max: 21, label: "Severe Anxiety", severity: "severe", description: "Severe anxiety symptoms reported. Active clinical evaluation recommended." }
    ],
    functionalImpact: {
      id: "gad7_impact",
      isUnscored: true,
      text: "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?",
      options: FUNCTIONAL_IMPACT_OPTIONS
    }
  },
  who5: {
    id: "who5",
    version: "2026.1.0",
    canonicalName: "WHO-5 Well-Being Index (1998 version)",
    shortName: "WHO-5",
    category: "Well-Being Indicator",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 12,
    maximumAge: null,
    owner: "Psychiatric Research Unit, Mental Health Centre North Zealand, Hillerød, Denmark / World Health Organization",
    copyright: "Free for clinical and personal screening use.",
    recallPeriod: "Over the last 2 weeks",
    administrationInstructions: "Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks.",
    itemCount: 5,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4, 5],
    minScore: 0,
    maxScore: 25,
    percentageMultiplier: 4,
    anchors: ANCHORS_6_POINT,
    items: [
      { id: "who5_q1", index: 1, text: "I have felt cheerful and in good spirits", category: "Positive mood", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "who5_q2", index: 2, text: "I have felt calm and relaxed", category: "Vitality & Calm", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "who5_q3", index: 3, text: "I have felt active and vigorous", category: "Vitality", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "who5_q4", index: 4, text: "I woke up feeling fresh and rested", category: "Restorative sleep", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "who5_q5", index: 5, text: "My daily life has been filled with things that interest me", category: "General interest", allowedValues: [0, 1, 2, 3, 4, 5] }
    ],
    bands: [
      { min: 0, max: 12, label: "Poor Well-Being", severity: "moderate", description: "Raw score below 13 indicates reduced emotional well-being and warrants further depression screening." },
      { min: 13, max: 21, label: "Adequate Well-Being", severity: "low", description: "Adequate psychological well-being reported over the past two weeks." },
      { min: 22, max: 25, label: "Optimal Well-Being", severity: "optimal", description: "High psychological well-being reported over the past two weeks." }
    ]
  },
  asrs: {
    id: "asrs",
    version: "2026.1.0",
    canonicalName: "Adult ADHD Self-Report Scale (ASRS-v1.1)",
    shortName: "ASRS",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Over the last 6 months",
    administrationInstructions: "Please answer the questions below rating how frequently you have experienced each problem over the past 6 months.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4],
    minScore: 0,
    maxScore: 24,
    anchors: [
      { value: 0, id: "never", label: "Never" },
      { value: 1, id: "rarely", label: "Rarely" },
      { value: 2, id: "sometimes", label: "Sometimes" },
      { value: 3, id: "often", label: "Often" },
      { value: 4, id: "very_often", label: "Very Often" }
    ],
    items: [
      { id: "asrs_q1", index: 1, text: "How often do you have trouble wrapping up the fine details of a project, once the challenging parts have been done?", category: "Inattention", allowedValues: [0, 1, 2, 3, 4] },
      { id: "asrs_q2", index: 2, text: "How often do you have difficulty getting things in order when you have to do a task that requires organization?", category: "Inattention", allowedValues: [0, 1, 2, 3, 4] },
      { id: "asrs_q3", index: 3, text: "How often do you have problems remembering appointments or obligations?", category: "Memory", allowedValues: [0, 1, 2, 3, 4] },
      { id: "asrs_q4", index: 4, text: "When you have a task that requires a lot of thought, how often do you avoid or delay getting started?", category: "Procrastination", allowedValues: [0, 1, 2, 3, 4] },
      { id: "asrs_q5", index: 5, text: "How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?", category: "Hyperactivity", allowedValues: [0, 1, 2, 3, 4] },
      { id: "asrs_q6", index: 6, text: "How often do you feel overly active and compelled to do things, like you were driven by a motor?", category: "Hyperactivity", allowedValues: [0, 1, 2, 3, 4] }
    ],
    bands: [
      { min: 0, max: 9, label: "Unlikely ADHD", severity: "minimal", description: "Symptoms reported are consistent with normal attention variations." },
      { min: 10, max: 13, label: "Borderline ADHD Traits", severity: "mild", description: "Some traits of inattention or hyperactivity reported." },
      { min: 14, max: 24, label: "Highly Consistent with Adult ADHD", severity: "moderate", description: "Symptoms strongly warrant a comprehensive clinical evaluation for Adult ADHD." }
    ]
  },
  pcl5: {
    id: "pcl5",
    version: "2026.1.0",
    canonicalName: "PTSD Checklist for DSM-5 (PCL-5)",
    shortName: "PCL-5",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "In the past month",
    administrationInstructions: "Below is a list of problems people sometimes have in response to a very stressful experience. Please rate how much you have been bothered by each problem.",
    itemCount: 8,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4],
    minScore: 0,
    maxScore: 32,
    anchors: [
      { value: 0, id: "not_at_all", label: "Not at all" },
      { value: 1, id: "a_little", label: "A little bit" },
      { value: 2, id: "moderately", label: "Moderately" },
      { value: 3, id: "quite_a_bit", label: "Quite a bit" },
      { value: 4, id: "extremely", label: "Extremely" }
    ],
    items: [
      { id: "pcl5_q1", index: 1, text: "Repeated, disturbing, and unwanted memories of the stressful experience?", category: "Intrusions", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q2", index: 2, text: "Repeated, disturbing dreams of the stressful experience?", category: "Intrusions", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q3", index: 3, text: "Suddenly feeling or acting as if the stressful experience were actually happening again?", category: "Re-experiencing", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q4", index: 4, text: "Feeling very upset when something reminded you of the stressful experience?", category: "Reactivity", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q5", index: 5, text: "Avoiding memories, thoughts, or feelings related to the stressful experience?", category: "Avoidance", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q6", index: 6, text: "Avoiding external reminders of the stressful experience (people, places, conversations)?", category: "Avoidance", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q7", index: 7, text: "Being 'superalert' or watchful or on guard?", category: "Hyperarousal", allowedValues: [0, 1, 2, 3, 4] },
      { id: "pcl5_q8", index: 8, text: "Feeling jumpy or easily startled?", category: "Hyperarousal", allowedValues: [0, 1, 2, 3, 4] }
    ],
    bands: [
      { min: 0, max: 10, label: "Minimal PTSD Symptoms", severity: "minimal", description: "Few or no post-traumatic stress symptoms reported." },
      { min: 11, max: 18, label: "Mild Trauma Reactivity", severity: "mild", description: "Mild stress reactions reported following traumatic events." },
      { min: 19, max: 32, label: "Significant Post-Traumatic Stress", severity: "severe", description: "Clinically meaningful post-traumatic symptoms; formal assessment recommended." }
    ]
  },
  mdq: {
    id: "mdq",
    version: "2026.1.0",
    canonicalName: "Mood Disorder Questionnaire (MDQ)",
    shortName: "MDQ",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Throughout lifetime",
    administrationInstructions: "Has there ever been a period of time when you were not your usual self and experienced any of the following?",
    itemCount: 7,
    scoringType: "sum",
    allowedValues: [0, 1],
    minScore: 0,
    maxScore: 7,
    anchors: [
      { value: 0, id: "no", label: "No" },
      { value: 1, id: "yes", label: "Yes" }
    ],
    items: [
      { id: "mdq_q1", index: 1, text: "You felt so good or so hyper that other people thought you were not your normal self?", category: "Mood elevation", allowedValues: [0, 1] },
      { id: "mdq_q2", index: 2, text: "You were so irritable that you shouted at people or started fights or arguments?", category: "Irritability", allowedValues: [0, 1] },
      { id: "mdq_q3", index: 3, text: "You felt much more self-confident than usual?", category: "Grandiosity", allowedValues: [0, 1] },
      { id: "mdq_q4", index: 4, text: "You got much less sleep than usual and found you didn't really miss it?", category: "Decreased sleep", allowedValues: [0, 1] },
      { id: "mdq_q5", index: 5, text: "You were much more talkative or spoke much faster than usual?", category: "Pressured speech", allowedValues: [0, 1] },
      { id: "mdq_q6", index: 6, text: "Thoughts raced through your head or you couldn't slow your mind down?", category: "Racing thoughts", allowedValues: [0, 1] },
      { id: "mdq_q7", index: 7, text: "You were so easily distracted by things around you that you had trouble staying on track?", category: "Distractibility", allowedValues: [0, 1] }
    ],
    bands: [
      { min: 0, max: 2, label: "Low Bipolar Spectrum Likelihood", severity: "minimal", description: "Responses indicate very low probability of bipolar spectrum traits." },
      { min: 3, max: 4, label: "Moderate Mood Fluctuations", severity: "mild", description: "Some periods of elevated energy or irritability reported." },
      { min: 5, max: 7, label: "Positive Bipolar Screen", severity: "moderate", description: "Endorsement of multiple co-occurring hypomanic traits warrants clinical evaluation." }
    ]
  },
  ocir: {
    id: "ocir",
    version: "2026.1.0",
    canonicalName: "Obsessive-Compulsive Inventory (OCI-R)",
    shortName: "OCI-R",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Past month",
    administrationInstructions: "Please rate how much each experience has distressed or bothered you during the past month.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4],
    minScore: 0,
    maxScore: 24,
    anchors: [
      { value: 0, id: "not_at_all", label: "Not at all" },
      { value: 1, id: "a_little", label: "A little" },
      { value: 2, id: "moderately", label: "Moderately" },
      { value: 3, id: "a_lot", label: "A lot" },
      { value: 4, id: "extremely", label: "Extremely" }
    ],
    items: [
      { id: "ocir_q1", index: 1, text: "I check things more often than necessary.", category: "Checking", allowedValues: [0, 1, 2, 3, 4] },
      { id: "ocir_q2", index: 2, text: "I get upset if objects are not arranged properly.", category: "Ordering", allowedValues: [0, 1, 2, 3, 4] },
      { id: "ocir_q3", index: 3, text: "I feel compelled to count while I am doing things.", category: "Neutralizing", allowedValues: [0, 1, 2, 3, 4] },
      { id: "ocir_q4", index: 4, text: "I find it difficult to touch an object when I know it has been touched by strangers.", category: "Washing", allowedValues: [0, 1, 2, 3, 4] },
      { id: "ocir_q5", index: 5, text: "I am upset by unpleasant thoughts that enter my mind against my will.", category: "Obsessing", allowedValues: [0, 1, 2, 3, 4] },
      { id: "ocir_q6", index: 6, text: "I repeatedly check doors, windows, or drawers to ensure they are locked.", category: "Checking", allowedValues: [0, 1, 2, 3, 4] }
    ],
    bands: [
      { min: 0, max: 7, label: "Subclinical OCD Symptoms", severity: "minimal", description: "Symptoms reported are within normal limits." },
      { min: 8, max: 14, label: "Mild Obsessive-Compulsive Tendencies", severity: "mild", description: "Mild intrusive thoughts or repetitive behaviors noted." },
      { min: 15, max: 24, label: "Significant OCD Symptoms", severity: "severe", description: "Elevated symptoms of obsession or compulsion; clinical evaluation advised." }
    ]
  },
  ecr: {
    id: "ecr",
    version: "2026.1.0",
    canonicalName: "Experiences in Close Relationships (ECR)",
    shortName: "ECR",
    category: "Life-Context Reflection",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "General relationship patterns",
    administrationInstructions: "Please rate how much each statement describes how you feel in romantic partnerships.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [1, 2, 3, 4, 5],
    minScore: 6,
    maxScore: 30,
    anchors: [
      { value: 1, id: "strongly_disagree", label: "Strongly Disagree" },
      { value: 2, id: "disagree", label: "Disagree" },
      { value: 3, id: "neutral", label: "Neutral" },
      { value: 4, id: "agree", label: "Agree" },
      { value: 5, id: "strongly_agree", label: "Strongly Agree" }
    ],
    items: [
      { id: "ecr_q1", index: 1, text: "I worry a lot about my relationships.", category: "Anxious Attachment", allowedValues: [1, 2, 3, 4, 5] },
      { id: "ecr_q2", index: 2, text: "I prefer not to show a partner how I feel deep down.", category: "Avoidant Attachment", allowedValues: [1, 2, 3, 4, 5] },
      { id: "ecr_q3", index: 3, text: "I often worry that my partner doesn't really love me.", category: "Anxious Attachment", allowedValues: [1, 2, 3, 4, 5] },
      { id: "ecr_q4", index: 4, text: "I get uncomfortable when a romantic partner wants to get very close.", category: "Avoidant Attachment", allowedValues: [1, 2, 3, 4, 5] },
      { id: "ecr_q5", index: 5, text: "I often want to merge completely with romantic partners, and this sometimes scares them away.", category: "Anxious Attachment", allowedValues: [1, 2, 3, 4, 5] },
      { id: "ecr_q6", index: 6, text: "I find it relatively easy to get close to my partner and rely on them.", category: "Secure Attachment", allowedValues: [1, 2, 3, 4, 5] }
    ],
    bands: [
      { min: 6, max: 14, label: "Predominantly Secure Attachment", severity: "minimal", description: "You feel comfortable with emotional intimacy and mutual independence." },
      { min: 15, max: 22, label: "Moderate Attachment Insecurity", severity: "mild", description: "You notice some patterns of relationship worry or emotional distance." },
      { min: 23, max: 30, label: "Elevated Attachment Anxiety / Avoidance", severity: "moderate", description: "High emotional vigilance or distance in relationships; therapy can build relational security." }
    ]
  },
  mbi: {
    id: "mbi",
    version: "2026.1.0",
    canonicalName: "Maslach Burnout Inventory (MBI)",
    shortName: "MBI",
    category: "Life-Context Reflection",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Past few months at work",
    administrationInstructions: "Please rate how frequently you experience each feeling regarding your current work or study life.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4, 5, 6],
    minScore: 0,
    maxScore: 36,
    anchors: [
      { value: 0, id: "never", label: "Never" },
      { value: 1, id: "rarely", label: "A few times a year" },
      { value: 2, id: "monthly", label: "Once a month or less" },
      { value: 3, id: "few_monthly", label: "A few times a month" },
      { value: 4, id: "weekly", label: "Once a week" },
      { value: 5, id: "few_weekly", label: "A few times a week" },
      { value: 6, id: "daily", label: "Every day" }
    ],
    items: [
      { id: "mbi_q1", index: 1, text: "I feel emotionally drained from my work.", category: "Emotional Exhaustion", allowedValues: [0, 1, 2, 3, 4, 5, 6] },
      { id: "mbi_q2", index: 2, text: "I feel used up at the end of the workday.", category: "Emotional Exhaustion", allowedValues: [0, 1, 2, 3, 4, 5, 6] },
      { id: "mbi_q3", index: 3, text: "I feel fatigued when I get up in the morning and have to face another day on the job.", category: "Exhaustion", allowedValues: [0, 1, 2, 3, 4, 5, 6] },
      { id: "mbi_q4", index: 4, text: "I have become more callous toward people since I took this job.", category: "Depersonalization", allowedValues: [0, 1, 2, 3, 4, 5, 6] },
      { id: "mbi_q5", index: 5, text: "I worry that this job is hardening me emotionally.", category: "Depersonalization", allowedValues: [0, 1, 2, 3, 4, 5, 6] },
      { id: "mbi_q6", index: 6, text: "I feel I'm not making a meaningful contribution through my work.", category: "Reduced Personal Accomplishment", allowedValues: [0, 1, 2, 3, 4, 5, 6] }
    ],
    bands: [
      { min: 0, max: 11, label: "Low Burnout Risk", severity: "minimal", description: "You currently maintain healthy occupational boundaries and resilience." },
      { min: 12, max: 22, label: "Moderate Occupational Stress", severity: "mild", description: "Early signs of emotional exhaustion or cynicism; proactive stress relief recommended." },
      { min: 23, max: 36, label: "High Burnout Severity", severity: "severe", description: "Severe occupational exhaustion; career coaching or therapeutic intervention advised." }
    ]
  },
  rses: {
    id: "rses",
    version: "2026.1.0",
    canonicalName: "Rosenberg Self-Esteem Scale (RSES)",
    shortName: "RSES",
    category: "Life-Context Reflection",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "General self-feelings",
    administrationInstructions: "Please rate how strongly you agree or disagree with each statement about yourself.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    minScore: 0,
    maxScore: 18,
    anchors: [
      { value: 3, id: "strongly_agree", label: "Strongly Agree" },
      { value: 2, id: "agree", label: "Agree" },
      { value: 1, id: "disagree", label: "Disagree" },
      { value: 0, id: "strongly_disagree", label: "Strongly Disagree" }
    ],
    items: [
      { id: "rses_q1", index: 1, text: "On the whole, I am satisfied with myself.", category: "Self-worth", allowedValues: [0, 1, 2, 3] },
      { id: "rses_q2", index: 2, text: "I feel that I have a number of good qualities.", category: "Competence", allowedValues: [0, 1, 2, 3] },
      { id: "rses_q3", index: 3, text: "I am able to do things as well as most other people.", category: "Self-efficacy", allowedValues: [0, 1, 2, 3] },
      { id: "rses_q4", index: 4, text: "I take a positive attitude toward myself.", category: "Positive attitude", allowedValues: [0, 1, 2, 3] },
      { id: "rses_q5", index: 5, text: "I feel that I'm a person of worth, at least on an equal plane with others.", category: "Self-worth", allowedValues: [0, 1, 2, 3] },
      { id: "rses_q6", index: 6, text: "All in all, I am inclined to feel that I am a success.", category: "Achievement", allowedValues: [0, 1, 2, 3] }
    ],
    bands: [
      { min: 0, max: 7, label: "Low Self-Esteem", severity: "moderate", description: "You frequently experience harsh self-criticism or feelings of inadequacy." },
      { min: 8, max: 14, label: "Healthy Average Self-Esteem", severity: "minimal", description: "You possess a balanced, grounded view of your worth and strengths." },
      { min: 15, max: 18, label: "High Self-Esteem", severity: "optimal", description: "You experience strong positive self-worth and confidence." }
    ]
  },
  bpaq: {
    id: "bpaq",
    version: "2026.1.0",
    canonicalName: "Buss-Perry Aggression Questionnaire (BPAQ)",
    shortName: "BPAQ",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Past few months",
    administrationInstructions: "Please rate how characteristic each statement is of you.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [1, 2, 3, 4, 5],
    minScore: 6,
    maxScore: 30,
    anchors: [
      { value: 1, id: "extremely_uncharacteristic", label: "Extremely Uncharacteristic" },
      { value: 2, id: "somewhat_uncharacteristic", label: "Somewhat Uncharacteristic" },
      { value: 3, id: "neither", label: "Neither Characteristic nor Uncharacteristic" },
      { value: 4, id: "somewhat_characteristic", label: "Somewhat Characteristic" },
      { value: 5, id: "extremely_characteristic", label: "Extremely Characteristic" }
    ],
    items: [
      { id: "bpaq_q1", index: 1, text: "Some of my friends think I'm a hothead.", category: "Anger", allowedValues: [1, 2, 3, 4, 5] },
      { id: "bpaq_q2", index: 2, text: "If somebody hits me, I hit back.", category: "Physical Aggression", allowedValues: [1, 2, 3, 4, 5] },
      { id: "bpaq_q3", index: 3, text: "I flare up quickly but get over it quickly.", category: "Anger", allowedValues: [1, 2, 3, 4, 5] },
      { id: "bpaq_q4", index: 4, text: "When people are especially nice, I wonder what they want.", category: "Hostility", allowedValues: [1, 2, 3, 4, 5] },
      { id: "bpaq_q5", index: 5, text: "I tell my friends openly when I disagree with them.", category: "Verbal Aggression", allowedValues: [1, 2, 3, 4, 5] },
      { id: "bpaq_q6", index: 6, text: "I have trouble controlling my temper.", category: "Anger", allowedValues: [1, 2, 3, 4, 5] }
    ],
    bands: [
      { min: 6, max: 13, label: "Low Aggression / Calm Demeanor", severity: "minimal", description: "You handle frustration constructively with minimal anger outbursts." },
      { min: 14, max: 21, label: "Moderate Frustration Reactivity", severity: "mild", description: "Situational anger or irritability experienced when under pressure." },
      { min: 22, max: 30, label: "High Anger / Reactivity", severity: "moderate", description: "Elevated reactivity and temper triggers; anger management strategies recommended." }
    ]
  },
  csi: {
    id: "csi",
    version: "2026.1.0",
    canonicalName: "Couples Satisfaction Index (CSI)",
    shortName: "CSI",
    category: "Life-Context Reflection",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Current relationship",
    administrationInstructions: "Please indicate how you feel about your romantic partnership.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3, 4, 5],
    minScore: 0,
    maxScore: 30,
    anchors: [
      { value: 0, id: "not_at_all", label: "Not at all" },
      { value: 1, id: "a_little", label: "A little" },
      { value: 2, id: "somewhat", label: "Somewhat" },
      { value: 3, id: "mostly", label: "Mostly" },
      { value: 4, id: "almost_completely", label: "Almost completely" },
      { value: 5, id: "completely", label: "Completely" }
    ],
    items: [
      { id: "csi_q1", index: 1, text: "Please indicate the degree of happiness in your relationship.", category: "Happiness", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "csi_q2", index: 2, text: "In general, how often do you think that things between you and your partner are going well?", category: "General Satisfaction", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "csi_q3", index: 3, text: "Our relationship is strong and resilient.", category: "Relationship Strength", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "csi_q4", index: 4, text: "My relationship with my partner makes me happy.", category: "Personal Fulfillment", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "csi_q5", index: 5, text: "I have a warm and comfortable relationship with my partner.", category: "Warmth", allowedValues: [0, 1, 2, 3, 4, 5] },
      { id: "csi_q6", index: 6, text: "I really feel like part of a team with my partner.", category: "Teamwork", allowedValues: [0, 1, 2, 3, 4, 5] }
    ],
    bands: [
      { min: 0, max: 13, label: "Notable Relationship Distress", severity: "moderate", description: "You report dissatisfaction or communication barriers; couples counselling could help." },
      { min: 14, max: 23, label: "Moderate Relationship Satisfaction", severity: "mild", description: "Solid relationship foundation with some areas for growth." },
      { min: 24, max: 30, label: "High Relationship Fulfillment", severity: "optimal", description: "High mutual warmth, communication, and teamwork reported." }
    ]
  },
  psqi: {
    id: "psqi",
    version: "2026.1.0",
    canonicalName: "Pittsburgh Sleep Quality Index (PSQI)",
    shortName: "PSQI",
    category: "Symptom Screen",
    instrumentType: "validated_screener",
    status: "available",
    requiresAuth: true,
    minimumAge: 18,
    maximumAge: null,
    recallPeriod: "Past month",
    administrationInstructions: "Please rate how often you had trouble sleeping over the past month.",
    itemCount: 6,
    scoringType: "sum",
    allowedValues: [0, 1, 2, 3],
    minScore: 0,
    maxScore: 18,
    anchors: ANCHORS_4_POINT,
    items: [
      { id: "psqi_q1", index: 1, text: "Cannot get to sleep within 30 minutes?", category: "Sleep latency", allowedValues: [0, 1, 2, 3] },
      { id: "psqi_q2", index: 2, text: "Wake up in the middle of the night or early morning?", category: "Sleep continuity", allowedValues: [0, 1, 2, 3] },
      { id: "psqi_q3", index: 3, text: "Have to get up to use the bathroom?", category: "Sleep disruption", allowedValues: [0, 1, 2, 3] },
      { id: "psqi_q4", index: 4, text: "Cannot breathe comfortably or cough or snore loudly?", category: "Respiratory", allowedValues: [0, 1, 2, 3] },
      { id: "psqi_q5", index: 5, text: "Feel too cold or too hot?", category: "Temperature", allowedValues: [0, 1, 2, 3] },
      { id: "psqi_q6", index: 6, text: "How would you rate your sleep quality overall?", category: "Overall quality", allowedValues: [0, 1, 2, 3] }
    ],
    bands: [
      { min: 0, max: 4, label: "Good Sleep Quality", severity: "minimal", description: "Restful and restorative sleep patterns reported." },
      { min: 5, max: 9, label: "Mild Sleep Disturbance", severity: "mild", description: "Occasional nighttime awakenings or difficulty falling asleep." },
      { min: 10, max: 18, label: "Significant Poor Sleep Quality", severity: "moderate", description: "Persistent sleep disruption; sleep hygiene review and clinical consultation advised." }
    ]
  }
};

/**
 * Validates responses strictly against a registered instrument definition,
 * rejecting missing, duplicate, unknown or out-of-range items, decimals, booleans and strings.
 * Never turns unanswered items into zero.
 */
export function scoreAssessment(instrumentId, rawAnswers) {
  const def = ASSESSMENT_REGISTRY[instrumentId];
  if (!def) {
    return {
      isValid: false,
      error: `Unknown assessment instrument '${instrumentId}'. Valid instruments: ${Object.keys(ASSESSMENT_REGISTRY).join(", ")}`
    };
  }

  if (!rawAnswers || typeof rawAnswers !== "object") {
    return {
      isValid: false,
      error: "Responses must be supplied as an object mapping stable item IDs to integer scores or as an array."
    };
  }

  const validatedAnswers = {};
  let totalScore = 0;
  const items = def.items;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let val;

    if (Array.isArray(rawAnswers)) {
      if (i >= rawAnswers.length) {
        return {
          isValid: false,
          error: `Incomplete response set: Item ${i + 1} (${item.id}) is missing. All ${items.length} items are required.`
        };
      }
      val = rawAnswers[i];
    } else {
      // Look up by stable item ID, fallback to 1-based qKey or 0-based index
      if (Object.prototype.hasOwnProperty.call(rawAnswers, item.id)) {
        val = rawAnswers[item.id];
      } else if (Object.prototype.hasOwnProperty.call(rawAnswers, `q${i + 1}`)) {
        val = rawAnswers[`q${i + 1}`];
      } else if (Object.prototype.hasOwnProperty.call(rawAnswers, `q${i}`)) {
        val = rawAnswers[`q${i}`];
      } else if (Object.prototype.hasOwnProperty.call(rawAnswers, String(i))) {
        val = rawAnswers[String(i)];
      } else {
        return {
          isValid: false,
          error: `Incomplete response set: Item ${item.id} is missing. All ${items.length} items are required.`
        };
      }
    }

    // Explicit rejection of missing, null, undefined, empty string
    if (val === null || val === undefined || val === "") {
      return {
        isValid: false,
        error: `Item ${item.id} is unanswered. No items may be skipped or default to zero.`
      };
    }

    // Strict rejection of booleans, decimals, and NaN
    if (typeof val === "boolean") {
      return {
        isValid: false,
        error: `Invalid type boolean for item ${item.id}. Expected integer from [${item.allowedValues.join(", ")}].`
      };
    }

    const num = Number(val);
    if (!Number.isInteger(num)) {
      return {
        isValid: false,
        error: `Invalid non-integer value '${val}' for item ${item.id}. Allowed values: [${item.allowedValues.join(", ")}].`
      };
    }

    if (!item.allowedValues.includes(num)) {
      return {
        isValid: false,
        error: `Value ${num} for item ${item.id} is out of allowed range [${item.allowedValues.join(", ")}].`
      };
    }

    validatedAnswers[item.id] = num;
    totalScore += num;
  }

  // Check for unknown extraneous keys if object
  if (!Array.isArray(rawAnswers)) {
    const knownKeys = new Set();
    items.forEach((it, idx) => {
      knownKeys.add(it.id);
      knownKeys.add(`q${idx + 1}`);
      knownKeys.add(`q${idx}`);
      knownKeys.add(String(idx));
    });
    // Also allow optional unscored functional impact and context keys
    knownKeys.add("functionalImpact");
    knownKeys.add("intakeContext");
    knownKeys.add(`${def.id}_impact`);

    for (const key of Object.keys(rawAnswers)) {
      if (!knownKeys.has(key)) {
        return {
          isValid: false,
          error: `Unknown response key '${key}' not recognized in instrument ${def.shortName}.`
        };
      }
    }
  }

  // Determine band
  let matchedBand = def.bands[0];
  for (const b of def.bands) {
    if (totalScore >= b.min && totalScore <= b.max) {
      matchedBand = b;
      break;
    }
  }

  // Safety trigger evaluation (e.g. PHQ-9 Item 9)
  let itemLevelSafetyTriggered = false;
  let safetyTriggerItem = null;
  if (def.id === "phq9") {
    const item9Score = validatedAnswers["phq9_q9"];
    if (item9Score !== undefined && item9Score > 0) {
      itemLevelSafetyTriggered = true;
      safetyTriggerItem = {
        itemId: "phq9_q9",
        score: item9Score,
        text: def.items[8].text
      };
    }
  }

  // Unscored functional impact
  let functionalImpactAnswer = null;
  const rawImpact = rawAnswers.functionalImpact !== undefined ? rawAnswers.functionalImpact : rawAnswers[`${def.id}_impact`];
  if (rawImpact !== undefined && rawImpact !== null && rawImpact !== "") {
    const numImpact = Number(rawImpact);
    if (Number.isInteger(numImpact) && numImpact >= 0 && numImpact <= 3) {
      functionalImpactAnswer = {
        value: numImpact,
        label: FUNCTIONAL_IMPACT_OPTIONS[numImpact]?.label || ""
      };
    }
  }

  // Intake context (strictly unscored and isolated)
  const intakeContext = rawAnswers.intakeContext && typeof rawAnswers.intakeContext === "object" ? { ...rawAnswers.intakeContext } : null;

  return {
    isValid: true,
    instrumentId: def.id,
    version: def.version,
    totalScore,
    maxScore: def.maxScore,
    band: matchedBand.label,
    severity: matchedBand.severity,
    description: matchedBand.description,
    itemLevelSafetyTriggered,
    safetyTriggerItem,
    validatedAnswers,
    functionalImpact: functionalImpactAnswer,
    intakeContext
  };
}

