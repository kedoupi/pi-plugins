#!/usr/bin/env node
import { runAssistant } from "../src/assistant.mjs";

try {
  await runAssistant({ handleSignals: true });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
