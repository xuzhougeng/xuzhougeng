# ClashMate Rule Adapter Upgrade Design

Date: 2026-05-05
Status: Draft approved in chat, written for review

## Summary

Upgrade `tools/clashmate/` from a basic Clash rule assembler into the main Mihomo rule adapter for local use.

The upgraded `ClashMate` should generate a complete, directly usable Mihomo configuration with two traffic paths:

1. First-party path: local direct connection or ordinary proxy groups
2. Second-hop path: AI traffic routed through a target proxy node that itself exits via `dialer-proxy`

`tools/dialer-proxy/` remains in the repository as a standalone transitional tool, but its long-term role becomes a capability source:

1. Relay and target proxy modeling
2. Built-in AI relay rule packs
3. Dual-hop YAML generation logic that can be reused by `ClashMate`

The initial AI relay scope must prioritize `OpenAI` and `Anthropic`. Other AI services remain optional extension packs.

## Goals

1. Make `ClashMate` the single entry point for generating the final Mihomo configuration.
2. Support rule-based split routing between first-party traffic and second-hop relay traffic.
3. Allow AI traffic to target a dedicated second-hop strategy group instead of ordinary proxy groups.
4. Keep the dual-hop chain explicit and inspectable:
   `rule -> AI-Relay -> target proxy -> Relay-Group -> relay proxy -> destination`
5. Preserve `dialer-proxy` as a separate tool while integrating its capabilities into `ClashMate`.
6. Leave room for future Mihomo process rules such as `PROCESS-NAME` and `PROCESS-PATH`.

## Non-Goals

1. Merge both tools into one page in this phase.
2. Remove `tools/dialer-proxy/` in this phase.
3. Auto-detect process names or application paths across platforms.
4. Build a complete AI vendor catalog in the initial release.
5. Support non-Mihomo kernels that do not understand `dialer-proxy`.

## Current State

### `tools/clashmate/`

Current capabilities:

1. Import subscription YAML from URL or file
2. Read proxies from the imported config
3. Add manual proxies, including proxies with `dialer-proxy`
4. Build ordinary proxy groups
5. Enable remote `rule-providers` and map them to selected groups
6. Generate final YAML output

Current gaps:

1. No dedicated model for relay proxies versus ordinary proxies
2. No dedicated model for target proxies used only for second-hop routing
3. No reserved `AI-Relay` strategy group
4. No built-in inline rule packs for OpenAI or Anthropic
5. Existing groups can accidentally mix ordinary proxies, relay proxies, and target proxies
6. No validation for broken dual-hop chains

### `tools/dialer-proxy/`

Current capabilities:

1. Parse relay proxy YAML snippets
2. Create a target proxy with `dialer-proxy`
3. Generate a standalone Clash/Mihomo YAML file
4. Provide a large inline AI domain rule list

Current gaps:

1. Acts as a standalone final config generator instead of a reusable capability layer
2. Rules are embedded into a dedicated output instead of being selectable from `ClashMate`
3. No separation between core AI relay rules and optional extension rules

## Proposed Product Boundary

### `ClashMate` becomes the final config generator

`ClashMate` should be responsible for:

1. Loading upstream subscription proxies
2. Managing ordinary proxy groups
3. Managing relay proxies and relay groups
4. Managing second-hop target proxies
5. Managing built-in and custom routing rules
6. Generating the final Mihomo YAML
7. Validating the full graph before output

### `dialer-proxy` becomes a capability source

`dialer-proxy` should remain usable as-is, but its logic should be treated as the source for:

1. Relay proxy parsing behavior
2. Target proxy field modeling
3. AI rule pack defaults
4. Dual-hop output semantics

Implementation should prefer extracting shared rule data and builder logic into reusable modules instead of duplicating large constant blocks in two places.

## Target User Flow

The `ClashMate` page should remain step-based, but include dual-hop routing as a first-class capability.

### Step 1: Import upstream proxies

Keep the existing subscription URL and YAML upload flow.

This step defines the ordinary proxy pool used by normal routing groups such as `Auto`, `Proxy`, and user-defined groups.

### Step 2: Configure dual-hop relay capability

Add a dedicated section for second-hop routing, with three subareas:

1. `Relay Proxies`
   Accept pasted YAML relay proxy snippets, similar to the current `dialer-proxy` input model.
2. `Relay Group`
   Define the group name and group type for the first hop. Default name: `Relay-Group`.
3. `Target Proxies`
   Define one or more second-hop target proxies. Each target proxy must reference the relay group through `dialer-proxy`.

### Step 3: Configure strategy groups

Keep ordinary group editing, but introduce reserved groups:

1. `Auto`
   Ordinary upstream proxies only
2. `Proxy`
   Ordinary upstream proxies only
3. `Relay-Group`
   Relay proxies only
4. `AI-Relay`
   Target proxies only

User-defined ordinary groups should also be limited to ordinary upstream proxies by default.

### Step 4: Assign rules

Rule targets should support three destination types:

1. `DIRECT`
2. Ordinary groups such as `Auto`, `Proxy`, or custom groups
3. Second-hop groups such as `AI-Relay`

This makes AI rules explicit instead of hiding them inside a generic proxy target.

### Step 5: Enhanced rules

Add a dedicated area for routing enhancements:

1. Built-in rule packs
2. Custom inline rules
3. Future process rule templates

### Step 6: Generate and inspect

Show both:

1. Final Mihomo YAML
2. A compact generation summary

The summary should list:

1. Number of ordinary upstream proxies
2. Number of relay proxies
3. Number of target proxies
4. Which rule packs point to `AI-Relay`
5. Which rule packs point to direct or ordinary groups

## Data Model

`ClashMate` should stop treating all proxies as a single undifferentiated pool.

### Proxy pools

Maintain separate in-memory pools:

1. `upstreamProxies`
   Proxies imported from the user subscription or YAML file
2. `relayProxies`
   First-hop relay proxies pasted or imported for the dual-hop chain
3. `targetProxies`
   Second-hop target proxies that must include a `dialer-proxy` reference

At YAML generation time, all three pools are flattened into the final `proxies` array, but the UI and validation logic must keep them distinct.

### Strategy groups

Maintain separate group concepts:

1. `ordinaryGroups`
   Built from `upstreamProxies`
2. `relayGroup`
   Built from `relayProxies`
3. `secondHopGroups`
   Built from `targetProxies`

The initial reserved second-hop group is `AI-Relay`.

### Rule sources

Represent rule sources in three categories:

1. `remoteProviders`
   Existing remote `RULE-SET` sources already supported by `ClashMate`
2. `builtInRulePacks`
   Inline packs derived from `dialer-proxy`
3. `customRules`
   User-entered inline rules, including future Mihomo process rules

## Configuration Generation Model

The final Mihomo YAML should be generated in five layers.

### 1. Base settings

Keep current base settings support:

1. `port`
2. `socks-port`
3. `allow-lan`
4. `mode`
5. `log-level`
6. `external-controller`

These values should override imported config values only for the known editable fields. The generator should avoid unintentionally discarding unrelated Mihomo settings from the imported configuration unless explicitly replaced by the user.

### 2. Proxies

The final `proxies` array should contain:

1. Ordinary upstream proxies
2. Relay proxies
3. Target proxies with `dialer-proxy: Relay-Group`

Target proxies must never be auto-mixed into ordinary groups.

### 3. Proxy groups

Reserved groups:

1. `Auto`
   Type `url-test`, members from ordinary upstream proxies only
2. `Proxy`
   Type `select`, members from ordinary upstream proxies only
3. `Relay-Group`
   Type chosen by the user, members from relay proxies only
4. `AI-Relay`
   Default type `select`, members from target proxies only

User-defined groups:

1. Default to ordinary upstream proxies only
2. May be extended later if there is a clear use case
3. Must not silently absorb relay or target proxies in v1

### 4. Rule sources

#### Remote providers

Keep the existing remote provider model from `ClashMate` for ordinary routing packs such as streaming, social, or regional sets.

#### Built-in inline packs

Introduce built-in inline rule packs, especially for second-hop AI routing.

Initial packs:

1. `Core AI Relay`
   Enabled by default
   Target default: `AI-Relay`
2. `Extended AI Relay`
   Optional
   Target default: `AI-Relay`

#### Custom rules

Allow users to enter raw Mihomo rules, including:

1. `DOMAIN`
2. `DOMAIN-SUFFIX`
3. `DOMAIN-KEYWORD`
4. `PROCESS-NAME`
5. `PROCESS-PATH`

### 5. Rule order

Rule order must be stable and explicit:

1. User custom forced rules
2. Built-in inline AI rule packs
3. Remote provider rules
4. `GEOIP,CN,DIRECT`
5. `MATCH,Auto`

This order ensures that manually curated or AI-specific relay rules win before broader provider-based routing.

## Built-In Rule Pack Design

### Core AI Relay

This is the primary second-hop pack for the initial release.

Default target: `AI-Relay`

Initial scope:

1. `openai.com`
2. `chatgpt.com`
3. `oaistatic.com`
4. `oaiusercontent.com`
5. `anthropic.com`
6. `claude.ai`
7. `claude.com`
8. `claudeusercontent.com`

The minimum required scope is the domain set above. Implementation should also preserve the existing essential OpenAI supporting domains already curated in `tools/dialer-proxy/`, such as asset or CDN hostnames that are needed for stable product access.

The intent is to keep the first production path tightly focused on `OpenAI` and `Anthropic`, without collapsing coverage to only the root domains.

### Extended AI Relay

Optional pack for broader AI ecosystem coverage.

Possible initial entries:

1. `githubcopilot.com`
2. `cursor.sh`
3. `openrouter.ai`
4. `perplexity.ai`
5. `gemini.google.com`
6. `generativelanguage.googleapis.com`
7. Other existing domains already curated in `dialer-proxy`

This pack should remain separate so the default path stays small and predictable.

### Process rule templates

Process rules should be supported as templates or editable rows, not as hardcoded defaults.

Examples:

1. `PROCESS-NAME,Codex,AI-Relay`
2. `PROCESS-NAME,ChatGPT,AI-Relay`
3. `PROCESS-NAME,Claude,AI-Relay`
4. `PROCESS-PATH,<platform-specific path>,AI-Relay`

These rules should be disabled by default because names and paths vary by OS and installation method.

## Validation Rules

Generation should fail fast when the dual-hop graph is incomplete or inconsistent.

### Dual-hop chain validation

1. If any rule pack targets `AI-Relay`, then `AI-Relay` must exist.
2. If `AI-Relay` exists, at least one valid target proxy must exist.
3. If any target proxy exists, the referenced relay group must exist.
4. If the relay group exists, it must contain at least one relay proxy.

### Group membership validation

1. Ordinary groups may only contain ordinary upstream proxies.
2. `Relay-Group` may only contain relay proxies.
3. `AI-Relay` may only contain target proxies.

### Reference validation

1. No duplicate proxy names across all pools
2. No empty required group names
3. No missing `server` or `port` on relay or target proxies
4. No `dialer-proxy` reference pointing to a non-existent relay group
5. No rules targeting non-existent groups

### Output gating

If validation fails, the UI should show specific blocking errors and refuse to generate YAML.

## Generation Summary

Before or alongside the YAML output, show a compact summary such as:

1. `Upstream Proxies: 18`
2. `Relay Proxies: 2`
3. `Target Proxies: 1`
4. `Core AI Relay -> AI-Relay`
5. `Extended AI Relay -> disabled`
6. `Default fallback -> Auto`

This summary is intended to catch misrouting before the user exports the config.

## Migration Strategy

### For `ClashMate`

1. Preserve the existing import and ordinary group workflow
2. Add new relay and target sections incrementally
3. Preserve current remote provider support
4. Upgrade rule assignment UI to understand second-hop groups

### For `dialer-proxy`

1. Keep the standalone page operational
2. Extract reusable rule data and builder helpers when practical
3. Treat it as the transitional capability layer instead of removing it

## Error Handling

The page should present user-facing validation messages for:

1. Invalid subscription fetch or YAML parse failures
2. Invalid relay YAML snippet parse failures
3. Empty relay proxy list when second-hop routing is enabled
4. Incomplete target proxy definitions
5. Duplicate proxy names
6. Invalid custom rules

Errors should be actionable and tied to the failing section whenever possible.

## Testing Strategy

Testing should cover both pure data generation and UI-driven configuration assembly.

### Data-level tests

1. Import config with ordinary proxies only
2. Generate config with relay and target proxies present
3. Verify target proxies include correct `dialer-proxy`
4. Verify reserved groups contain only the intended proxy pool
5. Verify rule ordering is stable
6. Verify duplicate names and broken references block output

### UI-level tests

1. User imports subscription
2. User adds relay proxies
3. User adds a target proxy
4. User enables `Core AI Relay`
5. User generates YAML and sees summary

### Manual verification targets

1. OpenAI traffic is routed through `AI-Relay`
2. Anthropic traffic is routed through `AI-Relay`
3. Non-matching traffic falls back to ordinary routing
4. Invalid chain configuration is blocked before export

## Acceptance Criteria

The upgrade is complete when all of the following are true:

1. `ClashMate` can generate a complete Mihomo config without using `dialer-proxy` as the final output step.
2. AI relay rules for `OpenAI` and `Anthropic` can target `AI-Relay`.
3. `AI-Relay` routes through target proxies that use `dialer-proxy` and a valid `Relay-Group`.
4. Ordinary proxy groups remain isolated from relay and target proxy pools.
5. Broken second-hop graphs are rejected with clear validation errors.
6. `dialer-proxy` remains functional as a standalone transitional tool.

## Open Follow-Up Items For Planning

These are not open questions for the design itself; they are implementation planning items:

1. Decide whether shared logic lives under `tools/shared/` or another browser-safe module path
2. Decide how built-in rule packs are stored and edited
3. Decide the exact UI layout for relay and target editing inside `ClashMate`
4. Decide whether to preserve the current `Auto` group name or rename the default ordinary fallback group
