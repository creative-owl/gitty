# Security policy

## Supported versions

The maintainers provide security updates for these versions:

| Version             | Supported          |
| ------------------- | ------------------ |
| Latest 0.x release  | :white_check_mark: |
| Older 0.x releases  | Best effort        |

## Security scope

Gitty is a local terminal application that reads repositories, diffs, patch files, stdin, and GitHub pull request metadata. Security-sensitive areas include:

- Shelling out to `git` and `gh`
- Expanding local paths and selecting repositories
- Opening pull request URLs
- Parsing untrusted diffs, patches, Markdown, Mermaid diagrams, and GitHub CLI output
- Rendering terminal UI content without leaking private repository data or credentials
- Handling very large inputs without unreasonable memory or CPU usage

Reports about these areas are in scope when they can cause command injection, credential disclosure, unsafe file access, remote content execution, supply-chain compromise, or denial of service beyond expected local resource usage.

## Reporting a vulnerability

If you believe you have found a security vulnerability in Gitty, report it through GitHub's private security channel by opening a [security advisory](https://github.com/creative-owl/gitty/security/advisories/new).

Do not report security vulnerabilities through public GitHub issues, discussions, pull requests, or comments. If the vulnerability is in a third-party library, report it to that library's maintainers.

When reporting, include:

- A concise description of the issue and impact
- Reproduction steps, a minimal patch or repository when safe to share, and expected versus actual behavior
- Affected Gitty version or commit SHA
- Operating system, terminal emulator, Bun version, Git version, and GitHub CLI version when relevant
- Any known mitigations or workarounds

Remove secrets, private repository names, local credentials, and confidential patch contents unless they are necessary to understand the report. If sensitive material is required, keep it inside the private advisory thread.

## Disclosure policy

When we receive a security vulnerability report, we assign it a primary handler. The handler confirms the problem, determines affected versions, evaluates severity, develops and ships a fix, and coordinates public disclosure with the reporter.

We aim to acknowledge new reports within 3 business days. For valid security issues, we aim to publish a fix and advisory within 60 calendar days of the initial report. Actively exploited vulnerabilities are treated as incidents and handled as quickly as a patch can be validated.

If we cannot ship a fix within 60 days, we will coordinate with the reporter on a disclosure plan and publish mitigation guidance where possible.

## Security updates

We release security updates after the patch is developed and tested. We notify users through the project's GitHub repository, publish release notes or security advisories on GitHub when appropriate, and publish a patched npm package when the affected code is in a released package.

## Security partners and acknowledgements

We credit reporters who want public acknowledgement after coordinated disclosure. Tell us how you would like to be credited in the private advisory thread.
