import { api } from "./src/services/mock-api.js";
api.getState().then(console.log).catch(console.error);
