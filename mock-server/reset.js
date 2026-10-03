import { copyFileSync } from "node:fs";
import { DB_PATH, SEED_PATH } from "./server.js";

copyFileSync(SEED_PATH, DB_PATH);
console.log("db.json restaurado a partir de db.seed.json");
