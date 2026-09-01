# Security Policy

## Research-use context

This project is decision-support software for prostate-cancer surgical planning,
used under IRB STUDY-14-00050 (Mount Sinai). It is **not FDA cleared** and must
not be used for autonomous clinical decision-making. Security issues that could
affect patient-data confidentiality or the integrity of model outputs are taken
seriously.

## Supported versions

Only the `main` branch is supported. Fixes are applied there and deployed from it.

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report privately using one of:

1. GitHub's [private vulnerability reporting](https://github.com/Urology-AI/digital-twin/security/advisories/new)
   (Security → Advisories → Report a vulnerability).
2. Email the maintainers at **adidix99@gmail.com** with the details below.

Include:

- A description of the issue and the impact you believe it has.
- Steps to reproduce (proof-of-concept, affected URL/endpoint, or code path).
- Any known mitigations.

### What to expect

- Acknowledgement within **5 business days**.
- An initial assessment and severity rating within **10 business days**.
- Coordinated disclosure once a fix is available; we will credit reporters who
  wish to be named.

## Scope

In scope:

- The React frontend (`src/`) and its build/deploy pipeline.
- The optional FastAPI backend (`backend/`), including the admin-token-gated
  `/api/config` and `/api/test` endpoints.
- Handling of clinical input JSON and `localStorage` persistence.

Out of scope:

- The external vLLM-compatible chat endpoint proxied by the backend (report to
  its operator).
- Findings that require a compromised host or physical access.
- Missing security headers on third-party static hosting without a demonstrated
  impact.

## Handling clinical data

Do not include real patient data (PHI) in bug reports, test fixtures, issues, or
pull requests. Use synthetic cases only.
