---
description: How to host the Solitaire game on the web
---

This project is a **static web application**, which means it can be hosted for free on many platforms. Here are the two easiest ways to share your game with the world.

## First Time Git Setup

If you haven't used Git on this computer before, you need to configure your identity. Run these commands in your terminal (using your actual name and email):

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

## Option 1: GitHub Pages (Recommended)

If you are using GitHub to store your code, this is the most integrated option.

1.  **Push your code to GitHub**
    - Create a new repository on GitHub.
    - Run the following commands in your terminal (replace `YOUR_USERNAME` and `YOUR_REPO`):
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    git push -u origin main
    ```

2.  **Enable Pages**
    - Go to your repository **Settings** on GitHub.
    - Click **Pages** in the left sidebar.
    - Under **Branch**, select `main` and keep the folder as `/ (root)`.
    - Click **Save**.

3.  **Play!**
    - GitHub will tell you your URL (usually `https://your-username.github.io/your-repository/`).
    - It might take 1-2 minutes to go live.

## Option 2: Netlify Drop (Easiest, No Git required)

If you just want to put it online right now without using Git commands:

1.  Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2.  Open your file explorer to `/Users/ventura/Documents/Antigravity`.
3.  **Drag and drop** the entire `Antigravity` folder onto the browser window.
4.  Netlify will deploy it instantly and give you a random URL (e.g., `silly-salamander-123456.netlify.app`).

## Option 3: Vercel

1.  If you have the Vercel CLI installed:
    ```bash
    npx vercel
    ```
2.  Follow the prompts (say "Yes" to everything).
3.  It will deploy and give you a URL.
