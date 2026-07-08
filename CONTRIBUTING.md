# Contributing to AROHAN

Thank you for your interest in contributing to AROHAN — the Autonomous Safety Monitoring System! 🎉

We welcome contributions of all kinds: bug fixes, new features, documentation improvements, and more.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

---

## 🤝 Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## 🚀 Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ronin.git
   cd ronin
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/shaddy-pv/ronin.git
   ```
4. **Set up your environment** — see [Development Setup](#development-setup)

---

## 💡 How to Contribute

### Reporting Bugs
- Use the **Bug Report** issue template
- Include steps to reproduce, expected vs actual behaviour, and your environment details

### Suggesting Features
- Use the **Feature Request** issue template
- Explain the use case and why it would benefit the project

### Submitting Code
- Check existing issues and PRs to avoid duplication
- For large changes, open an issue first to discuss the approach
- Keep PRs focused — one feature or fix per PR

---

## 🌿 Branch Naming

| Type | Format | Example |
|---|---|---|
| Feature | `feature/short-description` | `feature/add-smoke-sensor` |
| Bug fix | `fix/short-description` | `fix/rover-disconnect-crash` |
| Documentation | `docs/short-description` | `docs/update-api-reference` |
| Refactor | `refactor/short-description` | `refactor/hazard-score-logic` |

---

## ✍️ Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**
```
feat(backend): add gas leak threshold configuration
fix(frontend): correct rover status badge colour
docs(api): add WebSocket event reference
```

---

## 🔄 Pull Request Process

1. Sync your fork with upstream before starting:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```
2. Create your feature branch from `main`
3. Write/update tests where applicable
4. Ensure the frontend builds: `cd frontend && npm run build`
5. Update docs if your change affects behaviour or API
6. Open a PR against the `main` branch
7. Fill in the PR template completely
8. Request review from a maintainer

PRs will be merged once:
- ✅ CI checks pass
- ✅ At least 1 maintainer approval
- ✅ No unresolved review comments

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Python 3.8+
- Firebase CLI (`npm install -g firebase-tools`)

### Frontend
```bash
cd frontend
cp .env.example .env
# Fill in your Firebase credentials in .env
npm install
npm run dev
# Runs at http://localhost:8080
```

### Backend (CV Server)
```bash
cd backend
cp .env.example .env
# Fill in your credentials in .env
pip install -r requirements_cv.txt
python start_cv_backend.py
# Runs at http://localhost:5000
```

### Face Recognition Setup
Place face images in `backend/known_faces/<person_name>/` (minimum 3 photos per person).  
See `backend/known_faces/README.md` for the exact structure.

---

## 📁 Project Structure

```
ronin/
├── frontend/           # React 18 + TypeScript dashboard
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Route-level page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── services/   # API/Firebase service layer
│   │   ├── contexts/   # React contexts (Auth, Firebase)
│   │   └── lib/        # Utility functions
│   └── package.json
├── backend/            # Python Flask CV backend
│   ├── cv_backend.py   # Main server (face recog + hazard detection)
│   ├── known_faces/    # Face training data (gitignored)
│   └── requirements_cv.txt
├── AROHAN_Rover_FINAL/ # Arduino rover firmware
├── AROHAN-GIT/         # Hackathon prototype (separate codebase)
├── docs/               # Full technical documentation
└── firebase.json       # Firebase project config
```

---

## ❓ Questions?

Open a [GitHub Discussion](../../discussions) or reach out via issues.  
We're happy to help! 🚀
