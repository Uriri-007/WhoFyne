# Supabase setup for WhoFyne

This project has been moved from Firebase to Supabase. Use this setup before real data starts coming in.

## 1. Create the Supabase project

1. Create a Supabase project.
2. Go to **Project Settings > API**.
3. Copy:
   - Project URL
   - Publishable/anon key
4. Create `.env.local` from `.env.example` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-or-publishable-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 2. Run the SQL

Open **SQL Editor** in Supabase and run:

```sql
-- Paste the full contents of supabase/schema.sql here.
```

That script creates:

- `profiles` for public user profiles.
- `uploads` for image metadata.
- `votes` for one vote per user per upload.
- `whitelist` for uploader access.
- A public Storage bucket called `uploads`.
- RLS policies, constraints, and triggers.

## 3. Configure Auth

In **Authentication > Providers**:

- Enable Email provider if you want email/password signup.
- Enable Google provider if you want Google login.

For Google OAuth, add the Supabase callback URL shown in the Google provider settings to your Google Cloud OAuth client.

In **Authentication > URL Configuration**:

- Site URL: your deployed URL, or `http://localhost:3000` for local testing.
- Redirect URLs: add `http://localhost:3000/**` and your production domain.

## 4. Add uploader/admin access

Admins are currently recognized by either:

- `okhaiuri@gmail.com`
- `ogboumahokhai@gmail.com`
- A Supabase Auth app metadata role of `admin`

To whitelist an uploader, run:

```sql
insert into public.whitelist (email)
values ('creator@example.com')
on conflict (email) do nothing;
```

The old Firebase bug where users could whitelist themselves is fixed. Only admins can modify `whitelist` through the API, and direct SQL changes require database access.

## 5. What the database now enforces

- Users cannot upload unless their email is whitelisted or they are admins.
- Users can upload only one image per day.
- Images are stored in Supabase Storage, not inside database rows.
- Users cannot vote on their own uploads.
- Users can vote only once per upload.
- Vote totals are maintained by database triggers, not by client-side writes.
- Profile vote totals and upload vote totals cannot be directly edited by normal users.
