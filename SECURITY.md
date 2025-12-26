# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1.0 | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** create a public GitHub issue

Security vulnerabilities should be reported privately to protect users until a fix is available.

### 2. Email Security Team

Send an email to: **security@ursly.io**

Include the following information:
- Type of vulnerability
- Affected component/version
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (see below)

### 4. Severity Levels

| Severity | Response Time | Description |
|----------|---------------|-------------|
| **Critical** | 24-48 hours | Remote code execution, data breach, authentication bypass |
| **High** | 7 days | Privilege escalation, sensitive data exposure |
| **Medium** | 30 days | Information disclosure, denial of service |
| **Low** | 90 days | Best practice violations, minor issues |

### 5. Disclosure Policy

- We will acknowledge receipt of your report within 48 hours
- We will keep you informed of our progress
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We will coordinate public disclosure after a fix is available

### 6. What We Expect

- **Do**: Report vulnerabilities responsibly
- **Do**: Give us reasonable time to fix before disclosure
- **Do**: Act in good faith

- **Don't**: Access or modify data without permission
- **Don't**: Disrupt our services
- **Don't**: Violate any laws

## Security Best Practices

### For Users

- Keep Ursly VFS updated to the latest version
- Use strong, unique passwords for storage accounts
- Enable 2FA where available
- Review file permissions regularly
- Report suspicious activity immediately

### For Developers

- Follow secure coding practices
- Keep dependencies updated
- Review security advisories regularly
- Use secrets management (never commit secrets)
- Follow the principle of least privilege

## Security Updates

Security updates are released as:
- **Patch releases** (e.g., 1.1.4 → 1.1.5) for critical/high severity
- **Minor releases** (e.g., 1.1.x → 1.2.0) for medium severity
- **Major releases** (e.g., 1.x → 2.0) for architectural changes

## Security Scanning

We use automated security scanning:
- Dependency vulnerability scanning (npm audit, cargo audit)
- Secrets scanning (Gitleaks)
- Code security scanning (SAST)
- Container scanning (Trivy)
- License compliance checks

## Contact

- **Security Email**: security@ursly.io
- **General Support**: support@ursly.io
- **GitHub Issues**: For non-security issues only

Thank you for helping keep Ursly VFS secure! 🔒
