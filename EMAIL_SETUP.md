# Email notifications (Resend)

The app can email a class when an announcement is posted, when an assignment is created, and
when a student's work is graded.

## Why the key is not in `.env` as `VITE_RESEND_API_KEY`

Vite **inlines every `VITE_*` variable into the public JavaScript bundle.** A Resend key
shipped that way is readable by anyone who opens devtools on the deployed site, who could then
send mail as your domain, exhaust your quota, and get your sending domain blacklisted.
Resend's API also rejects browser-origin requests (no CORS), so a direct call from the client
would fail regardless.

The key therefore lives **only** as a Supabase secret, read by an Edge Function that the
browser calls. Verified: `npx vite build && grep -r "re_" dist/` finds nothing.

```
Browser ──▶ supabase.functions.invoke('send-email') ──▶ Edge Function ──▶ Resend API
                                                        (holds the key)
```

## Setup

### 1. Rotate the key first

The key currently in `.env` was pasted into a chat transcript. Treat it as compromised:
generate a new one at <https://resend.com/api-keys> and revoke the old one.

### 2. Set the secrets on Supabase

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set RESEND_API_KEY=re_your_new_key
supabase secrets set RESEND_FROM="OMSC Exam Generator <no-reply@yourdomain.edu.ph>"
```

### 3. Deploy the function

```bash
supabase functions deploy send-email
```

### 4. Verify

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"template":"announcement","to":["you@example.com"],
       "data":{"className":"Test Class","title":"Hello","authorName":"Instructor"}}'
```

## Sending domain

Until you verify a domain in Resend, `onboarding@resend.dev` **only delivers to the email
address that owns the Resend account**. Students will not receive anything. To send to a real
class, verify your institution's domain at <https://resend.com/domains> and set `RESEND_FROM`
to an address on it.

## What is sent, and when

| Trigger | Template | Recipients |
| --- | --- | --- |
| Announcement posted (not edits/pins) | `announcement` | Enrolled students |
| Assignment or question published (not materials, not edits) | `assignment` | Enrolled students |
| Submission graded and returned | `graded` | The one student |
| Due-soon reminder | `due_reminder` | Not yet scheduled — see below |

Recipients go in **BCC**, so a class email never exposes the roster's addresses.

Every send is fire-and-forget: a mail outage can never stop an announcement being posted or an
assignment being created. Failures are logged to the console, not surfaced as errors.

## Limits and hardening

The function is invoked with the project's **anon key**, which every visitor has. It is
constrained by an allow-list of templates (arbitrary subject/body is refused), a 50-recipient
cap per call, and per-field validation. That is enough to stop casual abuse but is **not**
authentication. To make it a real boundary you need Supabase Auth and a JWT check inside the
function.

`due_reminder` is implemented in the function but nothing calls it yet — it needs a scheduled
job (Supabase cron or a GitHub Action) that queries work due in the next 24h. That is not
wired up.

## Files

| Path | Purpose |
| --- | --- |
| `supabase/functions/send-email/index.ts` | Edge Function; holds the key, renders the HTML |
| `src/app/services/emailService.ts` | Client wrapper; never sees the key |
| `.env` | Local copy of the secret — **gitignored**, never committed |
| `.env.example` | Placeholders and this warning, safe to commit |
