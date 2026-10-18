# Notes for Claude

## GitHub work goes through Haiku agents

Delegate commits and all other GitHub work to a subagent running on Haiku (Agent tool with `model: "haiku"`).
That covers staging and committing, pushing, opening, updating and merging pull requests, PR comments and replies, and checking CI.

The main session makes and verifies the code changes, then gives the agent everything it needs:
- the branch
- the files to stage
- the commit message
- the PR title and body
- whether to merge

The agent reports back the commit SHA, PR link and merge result.
