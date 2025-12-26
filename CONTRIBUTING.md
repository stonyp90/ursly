# Contributing to Ursly VFS

Thank you for your interest in contributing to Ursly VFS! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment details**: OS, version, Node.js version, Rust version
- **Error messages** or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Clear title and description**
- **Use case**: Why is this feature useful?
- **Proposed solution** (if you have one)
- **Alternatives considered**

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Ensure all tests pass**: `npm test`
6. **Run linting**: `npm run lint`
7. **Commit your changes** using [conventional commits](https://www.conventionalcommits.org/)
8. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Write clear commit messages
- Reference related issues
- Update documentation if needed
- Ensure CI checks pass

## Development Setup

### Prerequisites

- **Node.js**: 24.x or later
- **npm**: 10.x or later
- **Rust**: 1.70+ (for Tauri)
- **Platform Tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: `libwebkit2gtk-4.0-dev`, `libssl-dev`

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Ursly.git
cd Ursly

# Install dependencies
npm install

# Run development server
cd apps/vfs-desktop
npm run tauri:dev
```

## Coding Standards

### TypeScript/React

- Use TypeScript for all new code
- Follow existing code style
- Use functional components with hooks
- Prefer named exports
- Write self-documenting code

### Rust

- Follow Rust naming conventions
- Use `rustfmt` for formatting
- Add documentation comments for public APIs
- Handle errors explicitly

### CSS

- Use CSS variables for theming
- Follow BEM-like naming conventions
- Keep styles modular and scoped

### Testing

- Write tests for new features
- Aim for good test coverage
- Use descriptive test names
- Test edge cases

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(vfs): add S3 storage adapter

Add support for AWS S3 storage backend with authentication
and bucket listing capabilities.

Closes #123
```

```
fix(ui): resolve theme toggle flicker

The theme toggle was causing a visual flicker when switching
between dark and light modes. Fixed by debouncing the state
update.

Fixes #456
```

## Project Structure

```
ursly/
├── apps/
│   └── vfs-desktop/     # Tauri desktop application
│       ├── src/         # React frontend
│       └── src-tauri/   # Rust backend
├── website/             # Marketing website
└── package.json         # Root package configuration
```

## Questions?

- **GitHub Issues**: [Open an issue](https://github.com/stonyp90/Ursly/issues/new)
- **Discussions**: [GitHub Discussions](https://github.com/stonyp90/Ursly/discussions)

Thank you for contributing to Ursly VFS! 🎉
