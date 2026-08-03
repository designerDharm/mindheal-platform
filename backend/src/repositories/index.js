import { memoryRepositories } from "./memory/index.js";
import { postgresRepositories } from "./postgres/index.js";

const repositoryDriver = process.env.REPOSITORY_DRIVER || "memory";

if (!["memory", "postgres"].includes(repositoryDriver)) {
  throw new Error(`Unsupported REPOSITORY_DRIVER "${repositoryDriver}". Use "memory" or "postgres".`);
}

if (repositoryDriver === "postgres") {
  assertRepositoryContract(postgresRepositories, memoryRepositories);
}

export const repositories = repositoryDriver === "postgres" ? postgresRepositories : memoryRepositories;

function assertRepositoryContract(candidate, reference) {
  const missing = [];
  for (const [namespace, methods] of Object.entries(reference)) {
    if (!candidate[namespace]) {
      missing.push(namespace);
      continue;
    }
    for (const methodName of Object.keys(methods)) {
      if (typeof methods[methodName] === "function" && typeof candidate[namespace][methodName] !== "function") {
        missing.push(`${namespace}.${methodName}`);
      }
    }
  }

  if (missing.length) {
    throw new Error(`Postgres repository contract incomplete: ${missing.join(", ")}`);
  }
}
