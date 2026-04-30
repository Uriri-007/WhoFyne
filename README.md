# WhoFyne

WhoFyne is a Supabase-backed image voting gallery. Users can sign in, whitelisted creators can upload one optimized image per day, and the community can vote on uploads that feed a live leaderboard.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in your Supabase project URL and anon key.

3. Run the SQL in [supabase/schema.sql](supabase/schema.sql) from the Supabase SQL editor.

4. Follow the full setup notes in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

5. Start the app:

```bash
npm run dev
```
