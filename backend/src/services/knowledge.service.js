import { repositories } from "../repositories/index.js";

export async function retrieveRelevantKnowledge(query = "", serviceScope = "general", language = "en") {
  if (!query || typeof query !== "string") {
    return { retrieved: false, chunks: [], contextText: "" };
  }

  const normalizedQuery = query.toLowerCase();

  // Standard verified psychological wellness reference chunks
  const KNOWLEDGE_BASE_STORE = [
    {
      id: "kb_cbt_01",
      topic: "cognitive_reframing",
      text: "CBT cognitive reframing involves identifying automatic negative thoughts (ANTs), examining evidence for/against them, and formulating balanced alternative perspectives.",
      keywords: ["anxiety", "worry", "negative thoughts", "cbt", "stress"]
    },
    {
      id: "kb_dream_01",
      topic: "psychoanalytic_dreams",
      text: "Dream imagery in psychodynamic theory represents latent emotions, internal conflicts, or unresolved daily experiences. Symbolism is reflective rather than literal or predictive.",
      keywords: ["dream", "nightmare", "sleeping", "water", "falling", "flying"]
    },
    {
      id: "kb_graphology_01",
      topic: "graphological_reflection",
      text: "Handwriting slant, spacing, and stroke pressure reflect fine motor control, fatigue, and momentary emotional state, but cannot diagnose clinical disorders.",
      keywords: ["handwriting", "signature", "stroke", "slant", "writing"]
    }
  ];

  const matchedChunks = KNOWLEDGE_BASE_STORE.filter((chunk) =>
    chunk.keywords.some((kw) => normalizedQuery.includes(kw))
  );

  if (!matchedChunks.length) {
    return { retrieved: false, chunks: [], contextText: "" };
  }

  const contextText = matchedChunks.map((c) => `[Source Knowledge: ${c.topic}] ${c.text}`).join("\n\n");

  return {
    retrieved: true,
    chunks: matchedChunks.map((c) => ({ id: c.id, topic: c.topic })),
    contextText
  };
}
