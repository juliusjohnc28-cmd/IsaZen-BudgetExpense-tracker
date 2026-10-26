# IsaZen Budget and Expense Manager

Expense and budget manager for a business. Static site (no build step) on Cloudflare Pages, with Supabase for sign-in and the database.

## Structure
```
budget-tracker/
├── functions/api/chat.js  <- Peso AI (Cloudflare Pages Function, calls Gemini)
├── public/            <- the website
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── companion.js   <- Peso chat UI
│   └── config.js      <- put your Supabase keys here
├── supabase/schema.sql
└── README.md
```

## 1. Supabase
1. Create a free project at supabase.com.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the **Project URL** and **anon public key** into `public/config.js`.
4. (Optional, easier testing) Authentication > Providers > Email > turn off "Confirm email".

## 2. Cloudflare Pages (free pages.dev)
**Option A: drag and drop.** Cloudflare dashboard > Workers & Pages > Create > Pages > Upload assets > upload the `public` folder.

**Option B: command line.**
```
npx wrangler pages deploy public --project-name my-budget-tracker
```

**Option C: Git.** Push this folder to GitHub, connect it in Pages, build command: none, output directory: `public`.

## 3. Final step
In Supabase > Authentication > URL Configuration, set **Site URL** to your `https://<name>.pages.dev` address.

## Forgot password
The sign-in screen has a **Forgot password?** link that emails a reset link. In Supabase > Authentication > URL Configuration, make sure your `https://<n>.pages.dev` address is the **Site URL** and is also listed under **Redirect URLs**, otherwise the link will not return to your app. (Optional) Customize the email under Authentication > Email Templates > Reset Password.

## Full name and Google sign-up
Sign-up asks for a **Full name** (required), stored with the account and used in the greeting, the sidebar and printed reports. Existing users can click **Add your name** / **Edit profile** under their email in the sidebar.

The **Continue with Google** button works once you switch the provider on in Supabase (Authentication > Providers > Google). Until then the button shows a friendly "not turned on yet" message.

Callback URL to give Google: `https://<your-project-ref>.supabase.co/auth/v1/callback` (your project ref is in `public/config.js`).

**Google:** Google Cloud Console > Google Auth Platform: create a project, set up the consent screen (External), then Clients > Create client > Web application. Add the callback URL above as an Authorized redirect URI and your site address (`https://<name>.pages.dev`) as an Authorized JavaScript origin. Copy the Client ID and Client secret into Supabase > Authentication > Providers > Google and enable it. Publish the app under Audience so everyone can sign in.

Also make sure your `https://<name>.pages.dev` address is the **Site URL** and is listed under **Redirect URLs** (with `/**` at the end) in Supabase > Authentication > URL Configuration.

## Use
- **Stores**: add each business or branch by name.
- **Transactions**: pick the store, choose Income or Expense, enter the amount in the green row and press Enter. Click any cell to edit.
- **Overview**: income, expenses and net per store and per month. Green ▲ means profit, red ▼ means loss, across all stores.
- **Overall (Transactions tab)**: the *Overall · All stores* tile adds up income from every store. Open it to record business-wide expenses such as salary and maintenance; they are deducted from the overall income (also shown on Overview). Re-run `supabase/schema.sql` once to create the new table.
- **Reports**: pick a period (this month, last month, this week, this year, all time or a custom range) and which stores to include, then download **CSV**, **Excel** (Summary, All entries and Overall expenses sheets) or **PDF** (opens the print dialog; choose *Save as PDF*). Totals show each store plus the overall net after overall expenses.
- **History**: every add, edit and delete is logged with old and new values.
- Search filters the current sheet; the month picker and store filter narrow the numbers.

Each account sees only its own stores and data.

## Peso, the AI companion (Gemini, free tier)
1. Get a free key at https://aistudio.google.com/apikey
2. Store it as a secret (never put it in public/):
```
npx wrangler pages secret put GEMINI_API_KEY --project-name my-budget-tracker-dp6
```
3. Deploy from the project root (the folder that contains `wrangler.toml`, `functions/` and `public/`):
```
npx wrangler pages deploy
```
Peso tries `gemini-3-flash-preview`, then `gemini-3.1-flash-lite-preview`, then `gemini-flash-latest`. Optional: set a `GEMINI_MODEL` variable to put your own model name first. (Google retired the 2.5 models in mid-2026, so old names return 404.)
Peso only answers signed-in users and only sees the numbers your browser sends with each question.

### Error: "User location is not supported for the API use"
Google rejects Gemini calls from some regions. A Pages Function normally runs in the Cloudflare data center nearest the visitor, which can be one Google blocks. `wrangler.toml` sets `[placement] region = "gcp:us-central1"` so the function runs near a US region instead. If it still happens, try `aws:us-east-1` or `gcp:europe-west1` in that file and redeploy.


## Business and Personal spaces
Use the **Business / Personal** switch at the top of every page. Personal has no stores: it tracks your own income and expenses, a **Budgets** tab (monthly limit per category), spending by category, Reports and History. Business and personal data never mix. **Run the new section at the bottom of `supabase/schema.sql` once** (Supabase > SQL Editor) before adding personal entries.


## Utang tracker (Personal)
Personal > **Utang** tab: record who owes you and who you owe, with due dates, part payments and a Paid mark. Run `supabase/utang.sql` once in the Supabase SQL Editor.

## Wallets (Personal)
Personal > **Wallets** tab: add Cash, GCash, Maya and bank accounts, each with a starting balance. Pick a wallet when you add an income or expense, and move money between wallets with **Transfer** (optional fee is deducted from the source wallet). Balance = starting balance + income − expenses assigned to the wallet ± transfers. Older entries without a wallet are not counted. Run `supabase/wallets.sql` once in the Supabase SQL Editor.

## Peso: exchange rates, business tips
Peso can now answer "USD to PHP today?" (live mid-market rates fetched by `functions/api/chat.js` from open.er-api.com, cached 1 hour, no extra key needed), give business and money tips in a light, playful tone, and still answers from your own numbers. Redeploy the function (`npx wrangler pages deploy`) to pick this up.

Wallet templates: in Personal > Wallets, tap a bank or e-wallet (GCash, Maya, MariBank, GoTyme, BDO, BPI, Metrobank, UnionBank, Landbank and more) to prefill its name, type and color. Wallets show as card-style tiles in that color. Colors are approximate; use Edit to change them.

Wallet cards: each card has **＋ Transaction** (income/expense with an optional Ref no. such as a GCash or bank reference), **⇄ Transfer** (prefilled From), **Activity** (last 8 movements with refs), **Adjust** (type the balance your real app shows; the difference goes into the starting balance, not income/expense) and a **Hide balances** privacy toggle. Re-run `supabase/wallets.sql` once to add the `ref` column.

## Savings goals (Personal)
Personal > **Goals** tab: create goals (emergency fund, travel, gadget...) with a target amount and optional target date. Use **＋ Add money** and **Withdraw** to move money in and out; optionally pick a wallet so its balance goes down (or back up) too. Each goal shows progress, what's left and about how much to save per month. Run `supabase/goals.sql` once in the Supabase SQL Editor (after `wallets.sql`).

## Install on your phone (PWA)
The web app is installable. Redeploy (`npx wrangler pages deploy`), then open your site URL on the phone:
- **Android (Chrome):** an "Install IsaZen" banner appears, or menu (⋮) > Install app / Add to Home screen.
- **iPhone (Safari):** Share > Add to Home Screen.
It opens full screen with its own icon, no browser bar. It needs internet for your data; offline it opens and shows an offline notice. New versions load automatically (network first).
Files: `manifest.webmanifest`, `sw.js`, `pwa.js`, `icon-*.png` (icons were made from `mark.png`; replace the three `icon-*.png` with a sharper 512x512 logo if you have one).

### Real Android / iOS store app (optional, later)
1. Easiest: go to pwabuilder.com, enter your deployed site URL, and download the Android package (.aab/.apk) to upload to Google Play (one-time $25 developer fee).
2. iOS App Store needs a Mac with Xcode and an Apple Developer account ($99/year); Capacitor (capacitor.js.org) can wrap `public/` for both platforms.


## Offline mode

After you open the app online once, it works with no internet:

- The app and your last data are kept on the phone. It opens offline, signed in.
- Adding, editing and deleting (transactions, stores, wallets, transfers, goals, utang) are saved on the phone and shown right away.
- When the connection returns they are sent to Supabase in order, then the real data reloads. A bar at the top shows what is waiting.
- Needs internet: Peso (AI), sign-in/sign-up, profile, budgets, passcode and reset.
- Signing out with unsynced changes asks you first, because they would be lost.
- Edits made on two devices at once: the last one to sync wins.
