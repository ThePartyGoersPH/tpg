# GitHub Upload Tutorial

This guide will walk you through uploading your thesis backend project to GitHub.

## Prerequisites

- Git installed on your computer ([Download Git](https://git-scm.com/downloads))
- A GitHub account ([Sign up here](https://github.com/join))

## Step 1: Verify Git Installation

Open PowerShell or Command Prompt and verify Git is installed:

```powershell
git --version
```

If Git is not installed, download and install it from the link above.

## Step 2: Configure Git (First Time Only)

If this is your first time using Git, configure your username and email:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Initialize Git Repository (If Not Already Done)

Navigate to your project directory:

```powershell
cd c:\Users\Admin\deploy\thesis-backend
```

Check if Git is already initialized:

```powershell
git status
```

If you see "fatal: not a git repository", initialize Git:

```powershell
git init
```

## Step 4: Review .gitignore File

Your project already has a `.gitignore` file. This ensures sensitive files (like `.env`) won't be uploaded to GitHub.

**IMPORTANT**: Never commit your `.env` file as it contains sensitive credentials. The `.gitignore` should already exclude it.

## Step 5: Stage Your Files

Add all files to Git staging:

```powershell
git add .
```

Check what will be committed:

```powershell
git status
```

Verify that `.env` is NOT listed (it should be ignored).

## Step 6: Create Your First Commit

Commit your files with a descriptive message:

```powershell
git commit -m "Initial commit: Thesis HR System backend"
```

## Step 7: Create a New Repository on GitHub

1. Go to [GitHub](https://github.com)
2. Click the **+** icon in the top-right corner
3. Select **New repository**
4. Fill in the details:
   - **Repository name**: `thesis-backend` (or your preferred name)
   - **Description**: "Backend API for Thesis HR System"
   - **Visibility**: Choose **Private** (recommended for thesis projects) or **Public**
   - **DO NOT** initialize with README, .gitignore, or license (you already have these)
5. Click **Create repository**

## Step 8: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/thesis-backend.git
git branch -M main
git push -u origin main
```

**Replace `YOUR-USERNAME`** with your actual GitHub username.

### Alternative: Using SSH (More Secure)

If you prefer SSH (recommended for frequent use):

1. First, set up SSH keys following [GitHub's SSH guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
2. Then use:

```powershell
git remote add origin git@github.com:YOUR-USERNAME/thesis-backend.git
git branch -M main
git push -u origin main
```

## Step 9: Authenticate

When you push for the first time, you'll be prompted to authenticate:

- **HTTPS**: You'll need a Personal Access Token (not your password)
  - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
  - Generate new token with `repo` scope
  - Use this token as your password

- **SSH**: No password needed if you set up SSH keys correctly

## Step 10: Verify Upload

1. Go to your GitHub repository URL: `https://github.com/YOUR-USERNAME/thesis-backend`
2. Verify all files are uploaded
3. **Double-check** that `.env` is NOT visible (only `.env.example` should be there)

## Future Updates

After making changes to your code, upload updates with:

```powershell
# Stage changes
git add .

# Commit with a descriptive message
git commit -m "Description of changes"

# Push to GitHub
git push
```

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `git status` | Check current status and changes |
| `git add .` | Stage all changes |
| `git add filename` | Stage specific file |
| `git commit -m "message"` | Commit staged changes |
| `git push` | Upload commits to GitHub |
| `git pull` | Download latest changes from GitHub |
| `git log` | View commit history |
| `git diff` | See unstaged changes |

## Troubleshooting

### Error: "remote origin already exists"

```powershell
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/thesis-backend.git
```

### Error: "failed to push some refs"

```powershell
git pull origin main --rebase
git push
```

### Accidentally Committed .env File

If you accidentally committed your `.env` file:

```powershell
# Remove from Git but keep local file
git rm --cached .env

# Commit the removal
git commit -m "Remove .env from repository"

# Push changes
git push
```

**IMPORTANT**: If `.env` was already pushed to GitHub, consider it compromised. Change all passwords and API keys immediately.

## Best Practices

1. **Never commit sensitive data**: Always use `.env` files for credentials
2. **Write meaningful commit messages**: Describe what changed and why
3. **Commit frequently**: Small, focused commits are better than large ones
4. **Pull before push**: If working with others, always pull latest changes first
5. **Use branches**: For new features, create branches: `git checkout -b feature-name`

## Security Checklist

Before pushing to GitHub, verify:

- [ ] `.env` is in `.gitignore`
- [ ] No passwords or API keys in code
- [ ] `.env.example` has placeholder values only
- [ ] Database credentials are not hardcoded
- [ ] No sensitive SQL dumps with real data

## Additional Resources

- [GitHub Documentation](https://docs.github.com)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Connecting to GitHub with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

**Need Help?** If you encounter issues, check the error message carefully and search GitHub's documentation or Stack Overflow for solutions.
