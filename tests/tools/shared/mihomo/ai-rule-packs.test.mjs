import test from "node:test";
import assert from "node:assert/strict";

import {
  coreAiRelay,
  extendedAiRelay,
  renderRulePackLines,
} from "../../../../tools/shared/mihomo/ai-rule-packs.mjs";

const expectedCoreLines = [
  "  # > ChatGPT",
  "  - DOMAIN-SUFFIX,ai.com,{target}",
  "  - DOMAIN-SUFFIX,chatgpt.com,{target}",
  "  - DOMAIN-SUFFIX,openai.com,{target}",
  "",
  "  # > Chat GPT API & CDN",
  "  - DOMAIN,chat.openai.com.cdn.cloudflare.net,{target}",
  "  - DOMAIN,openaiapi-site.azureedge.net,{target}",
  "  - DOMAIN,openaicom-api-bdcpf8c6d2e9atf6.z01.azurefd.net,{target}",
  "  - DOMAIN,openaicomproductionae4b.blob.core.windows.net,{target}",
  "  - DOMAIN,production-openaicom-storage.azureedge.net,{target}",
  "  - DOMAIN-SUFFIX,cdn.oaistatic.com,{target}",
  "  - DOMAIN-SUFFIX,oaiusercontent.com,{target}",
  "  - DOMAIN,o33249.ingest.sentry.io,{target}",
  "",
  "  # > Claude",
  "  - DOMAIN-SUFFIX,anthropic.com,{target}",
  "  - DOMAIN-SUFFIX,claude.ai,{target}",
  "  - DOMAIN-SUFFIX,claude.com,{target}",
  "  - DOMAIN-SUFFIX,claudeusercontent.com,{target}",
];

const expectedExtendedLines = [
  "  # > Augment",
  "  - DOMAIN-SUFFIX,augment.com,{target}",
  "  - DOMAIN-SUFFIX,augmentcode.com,{target}",
  "",
  ...expectedCoreLines,
  "",
  "  # > Cerebras",
  "  - DOMAIN-SUFFIX,cerebras.ai,{target}",
  "",
  "  # > Chorus",
  "  - DOMAIN-SUFFIX,chorus.sh,{target}",
  "",
  "  # > Cloudflare AI Gateway",
  "  - DOMAIN,gateway.ai.cloudflare.com,{target}",
  "",
  "  # > Copilot",
  "  - DOMAIN-SUFFIX,githubcopilot.com,{target}",
  "  - DOMAIN-SUFFIX,microsoftonline.com,{target}",
  "  - DOMAIN,copilot.microsoft.com,{target}",
  "",
  "  # > Cursor",
  "  - DOMAIN-SUFFIX,cursor.sh,{target}",
  "",
  "  # > DIA",
  "  - DOMAIN-SUFFIX,diabrowser.engineering,{target}",
  "",
  "  # > Dify.AI",
  "  - DOMAIN-SUFFIX,dify.ai,{target}",
  "",
  "  # > GitHub",
  "  - DOMAIN-SUFFIX,github.com,{target}",
  "  - DOMAIN-SUFFIX,githubusercontent.com,{target}",
  "  - DOMAIN-SUFFIX,github.io,{target}",
  "",
  "  # > Google AI Studio",
  "  - DOMAIN-KEYWORD,alkalimakersuite-pa.clients6.google.com,{target}",
  "  - DOMAIN-SUFFIX,aistudio.google.com,{target}",
  "  - DOMAIN-SUFFIX,makersuite.google.com,{target}",
  "  - DOMAIN-SUFFIX,generativeai.google,{target}",
  "  - DOMAIN,ai.google.dev,{target}",
  "  - DOMAIN,alkalicore-pa.clients6.google.com,{target}",
  "  - DOMAIN,waa-pa.clients6.google.com,{target}",
  "",
  "  # > Google DeepMind",
  "  - DOMAIN-SUFFIX,deepmind.com,{target}",
  "  - DOMAIN-SUFFIX,deepmind.google,{target}",
  "",
  "  # > Google Generative Language API",
  "  - DOMAIN-SUFFIX,generativelanguage.googleapis.com,{target}",
  "  - DOMAIN-SUFFIX,geller-pa.googleapis.com,{target}",
  "  - DOMAIN-SUFFIX,proactivebackend-pa.googleapis.com,{target}",
  "",
  "  # > Google Gemini",
  "  - DOMAIN-SUFFIX,aisandbox-pa.googleapis.com,{target}",
  "  - DOMAIN-SUFFIX,apis.google.com,{target}",
  "  - DOMAIN-SUFFIX,bard.google.com,{target}",
  "  - DOMAIN-SUFFIX,gemini.google.com,{target}",
  "  - DOMAIN-SUFFIX,robinfrontend-pa.googleapis.com,{target}",
  "",
  "  # > Google Cloud & APIs",
  "  - DOMAIN-SUFFIX,google.com,{target}",
  "  - DOMAIN-SUFFIX,googleapis.com,{target}",
  "",
  "  # > Google NotebookLM",
  "  - DOMAIN-SUFFIX,notebooklm.google,{target}",
  "  - DOMAIN-SUFFIX,notebooklm.google.com,{target}",
  "",
  "  # > Grok",
  "  - DOMAIN-SUFFIX,x.ai,{target}",
  "  - DOMAIN-SUFFIX,grok.com,{target}",
  "",
  "  # > Groq",
  "  - DOMAIN-SUFFIX,groq.com,{target}",
  "",
  "  # > Jasper",
  "  - DOMAIN-SUFFIX,clipdrop.co,{target}",
  "  - DOMAIN-SUFFIX,jasper.ai,{target}",
  "",
  "  # > JetBrains",
  "  - DOMAIN-SUFFIX,jetbrains.ai,{target}",
  "",
  "  # > Meta AI",
  "  - DOMAIN-SUFFIX,meta.ai,{target}",
  "",
  "  # > OpenArt",
  "  - DOMAIN-SUFFIX,openart.ai,{target}",
  "",
  "  # > OpenRouter",
  "  - DOMAIN-SUFFIX,openrouter.ai,{target}",
  "",
  "  # > Perplexity AI",
  "  - DOMAIN-SUFFIX,perplexity.ai,{target}",
  "",
  "  # > PubMed / NCBI",
  "  - DOMAIN-SUFFIX,ncbi.nlm.nih.gov,{target}",
  "  - DOMAIN-SUFFIX,nlm.nih.gov,{target}",
  "",
  "  # > POE",
  "  - DOMAIN-SUFFIX,poe.com,{target}",
  "",
  "  # > Siri",
  "  - DOMAIN-SUFFIX,apple-relay.apple.com,{target}",
  "  - DOMAIN-SUFFIX,apple-relay.fastly-edge.com,{target}",
  "  - DOMAIN-SUFFIX,apple-relay.cloudflare.com,{target}",
  "  - DOMAIN-SUFFIX,guzzoni.apple.com,{target}",
  "  - DOMAIN-SUFFIX,cp4.cloudflare.com,{target}",
  "  - DOMAIN-SUFFIX,gspe1-ssl.ls.apple.com,{target}",
  "  - DOMAIN-SUFFIX,smoot.apple.com,{target}",
  "",
  "  # > Sora",
  "  - DOMAIN-SUFFIX,sora.com,{target}",
  "  - DOMAIN,sora-cdn.oaistatic.com,{target}",
  "",
  "  # > Windsurf",
  "  - DOMAIN-SUFFIX,windsurf.com,{target}",
  "  - DOMAIN-SUFFIX,codeium.com,{target}",
  "  - DOMAIN-SUFFIX,codeiumdata.com,{target}",
  "",
  "  # > Zed",
  "  - DOMAIN-SUFFIX,zed.dev,{target}",
];

test("coreAiRelay preserves the curated OpenAI and Anthropic source sequence", () => {
  assert.equal(coreAiRelay.target, "AI-Relay");
  assert.deepEqual(coreAiRelay.lines, expectedCoreLines);
});

test("extendedAiRelay preserves the curated full source sequence", () => {
  assert.equal(extendedAiRelay.target, "AI-Relay");
  assert.deepEqual(extendedAiRelay.lines, expectedExtendedLines);
});

test("extendedAiRelay stays reusable and omits standalone terminal fallback rules", () => {
  assert.equal(
    extendedAiRelay.lines.some(line => line.includes("MATCH,DIRECT")),
    false
  );
});

test("renderRulePackLines replaces {target} across the ordered built-in packs", () => {
  assert.deepEqual(
    renderRulePackLines(coreAiRelay, "Relay-A"),
    expectedCoreLines.map(line => line.replaceAll("{target}", "Relay-A"))
  );

  assert.deepEqual(
    renderRulePackLines(extendedAiRelay, "Relay-B"),
    expectedExtendedLines.map(line => line.replaceAll("{target}", "Relay-B"))
  );
});
