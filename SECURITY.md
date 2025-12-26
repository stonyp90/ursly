# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version  | Supported          |
| -------- | ------------------ |
| Latest   | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

- **Email**: [security@ursly.io](mailto:security@ursly.io)
- **GitHub Security Advisory**: Use the [Security tab](https://github.com/stonyp90/Ursly/security/advisories/new) in the repository

Please include the following information in your report:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s) related to the manifestation of the issue**
- **The location of the affected source code** (tag/branch/commit or direct URL)
- **Step-by-step instructions to reproduce the issue**
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the issue**, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Security Best Practices

### For Users

- **Keep Ursly VFS updated** to the latest version
- **Use strong, unique credentials** for storage providers
- **Enable two-factor authentication** on cloud storage accounts when available
- **Review file permissions** before sharing files
- **Be cautious** when connecting to untrusted storage sources

### For Developers

- **Never commit secrets** (API keys, passwords, tokens) to the repository
- **Use environment variables** for sensitive configuration
- **Keep dependencies updated** and review security advisories
- **Follow secure coding practices** and review code before merging
- **Report security issues** responsibly through the proper channels

## Disclosure Policy

When we receive a security bug report, we will assign it to a primary handler. This person will coordinate the fix and release process, involving the following steps:

1. **Confirm the problem** and determine the affected versions
2. **Audit code** to find any similar problems
3. **Prepare fixes** for all releases still under maintenance
4. **Release fixes** and publish security advisories

We aim to respond to security reports within 48 hours and provide regular updates on the progress of the fix.

## Security Updates

Security updates will be released as:

- **Patch releases** for critical vulnerabilities (CVSS 9.0-10.0)
- **Minor releases** for high-severity vulnerabilities (CVSS 7.0-8.9)
- **Regular releases** for medium/low-severity vulnerabilities (CVSS < 7.0)

All security fixes will be documented in the [CHANGELOG.md](CHANGELOG.md).

## Recognition

We appreciate responsible disclosure of security vulnerabilities. With your permission, we will acknowledge your contribution in our security advisories and release notes.

## Security Checklist

Before submitting code, ensure:

- [ ] No hardcoded secrets or credentials
- [ ] Input validation and sanitization
- [ ] Proper error handling (no sensitive data in error messages)
- [ ] Dependencies are up to date
- [ ] Security headers are configured correctly
- [ ] Authentication and authorization are properly implemented
- [ ] Data encryption in transit and at rest where applicable

Thank you for helping keep Ursly VFS and our users safe!
