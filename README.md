# integral

Parametric furniture parts, modeled in [ClassCAD](https://classcad.ch): each part is a
history-based `.ofb` that opens in [Buerligons](https://buerligons.io), where its dimensions can
be changed and the model rebuilds.

| Part | Folder | Files |
|---|---|---|
| Zigzag chair | [`zigzag-chair/`](zigzag-chair/) | build script, `.ofb`, STEP, renders; parameters and a comparison with smlibpy in its README |

The parts are built by scripts run through the ClassCAD MCP (`@classcad/mcp`), which this repo
enables as a Claude Code plugin (`.claude/settings.json`). Each folder's README says how to rebuild it.
