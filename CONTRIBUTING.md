# Contributing to cap-js-retry

Thank you for your interest in contributing!

## Development Setup

```bash
npm install
npm run build
npm test
```

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat:` — new feature (minor version bump)
- `fix:` — bug fix (patch version bump)
- `BREAKING CHANGE:` in footer — major version bump

## Testing

All changes must include tests. Run:

```bash
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
```

## Linting

```bash
npm run lint      # Check
npm run lint:fix  # Auto-fix
npm run format    # Format with Prettier
```
