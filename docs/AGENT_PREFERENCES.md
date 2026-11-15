# Agent preferences

Use this file for stable human preferences about how agents should collaborate. It intentionally contains no personal preferences in the template.

Add only preferences that materially change agent behavior and are expected to apply across tasks. Examples of appropriate categories include communication style, desired checkpoints, delegation limits, verification expectations, acceptable autonomy, and preferred artifact formats.

Do not store secrets, identity details, private history, temporary task instructions, or preferences inferred from a single interaction. Ask the user before recording a preference that they did not state directly.

Use this format:

```markdown
## Preference title

- Instruction: The behavior agents should follow.
- Applies when: The tasks or conditions covered by the preference.
- Reason: Why this preference helps the user, if useful.
- Confirmed: YYYY-MM-DD or unknown.
```

Delete or revise a preference when the user explicitly changes it. Keep this file short enough that an agent can apply every active entry.
