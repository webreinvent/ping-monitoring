# LNPM MCP Server Usage by Step

| MCP Server | Tools Used | Steps | Purpose |
|---|---|---|---|
| **memory** | `search_nodes`, `open_nodes`, `create_entities`, `add_observations`, `create_relations` | 0, 1, 3, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17 | Load prior task context (Step 0); persist scope, code analysis, plan, UAT/test/E2E results, impact, patterns, lessons learned (Steps 1, 3, 5, 6, 7, 11–17) |
| **filesystem** | `ls`, `find`, `read`, `read_many`, `grep`, `stat`, `tree` | 3, 5, 16, 17 | Explore `ai-milestones-and-tasks/`, `docs/`, `requirements/` (Step 3); read task files and code (Step 5); read/update docs (Steps 16–17) |
| **git** | `git_status`, `git_branch`, `git_checkout`, `git_log`, `git_diff`, `git_commit`, `git_add` | 0, 2, 18 | Verify git state (Step 0); create feature branch (Step 2); audit diff + commit (Step 18) |
| **gitnexus** | `query`, `context`, `impact`, `detect_changes` | 5, 10, 14 | Code graph: find related symbols (Step 5); blast radius of changes (Steps 10, 14) |
| **llmkb** | `space_search_tool`, `space_read_tool`, `space_entities_tool` | 3, 5, 15 | Project knowledge base: search requirements/architecture (Step 3); read entity details (Step 5); write back learnings (Step 15) |
| **llmkb-local** | Same as llmkb | 3, 5, 15 | Local LLM knowledge base (same use as llmkb, for locally-stored project knowledge) |
| **nuxt** | `get-documentation-page`, `list-documentation-pages`, `get-changelog` | 4, 9 | Nuxt 4 API reference during research (Step 4) and implementation (Step 9) |
| **context7** | `resolve-library-id`, `query-docs` | 4 | Library documentation for any tech not in `reference-tech-stack.md` (Step 4) |
| **playwright** | `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_console_messages`, `browser_take_screenshot` | 11 | Interactive UAT for dashboard (Step 11) — navigate, interact, screenshot, check console |
| **browsermcp** | `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_get_console_logs` | 11 | Alternative browser automation for UAT (Step 11) — use if playwright MCP is unavailable |
| **sequential-thinking** | `sequentialthinking` | 7, 10 | Structured reasoning for implementation plan (Step 7) and code quality audit (Step 10) |
| **everything** | `get-env`, `get-roots-list` | 0 | Debugging MCP configuration; verify workspace roots (Step 0, rarely needed) |
| **genicui** | `find_ui_component`, `render_component` | 6 | UI component discovery/rendering for UI/UX planning (Step 6) — optional, use if a component catalog is available |

## Notes

- **memory MCP** is the primary persistence layer for this workflow. Every step that produces an intermediate artifact (scope, analysis, plan, results) writes a tagged note here.
- **gitnexus** is most valuable for cross-stack tasks where you need to understand the blast radius of a type change or a new API endpoint.
- **playwright MCP** is the primary UAT tool for dashboard tasks. Use `browser_snapshot` to get element refs before clicking. Check `browser_get_console_logs` after each navigation.
- **Do NOT use** `mcp__git__git_push` or any push operation — per the "No unconfirmed commits" rule, pushing requires explicit user confirmation (Step 18).
