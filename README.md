# ADS Empire Meta Business Suite integration

## Deployment
1. Back up the existing GitHub repository and Vercel deployment.
2. Copy `index.html` and `api/meta.js` into your repository root, preserving all other files. If the existing app has a different entrypoint, merge the changes instead of overwriting.
3. Set the following Vercel environment variables (Project > Settings > Environment Variables):
   - `SUPABASE_URL` = your existing Supabase project URL
   - `SUPABASE_ANON_KEY` = your existing public/anon key
   - `META_ACCESS_TOKEN` = a valid Meta system-user token with authorized asset access; never use a client-side token
   - `META_AD_ACCOUNT_ID` = numeric ad account ID (with or without `act_`)
   - `META_PAGE_ID` = numeric Facebook Page ID
   - `META_ALLOWED_EMAILS` = comma-separated approved Supabase user email addresses
   - `META_GRAPH_VERSION` = Meta Graph API version supported by your app, e.g. `v22.0`; verify currently supported version before deploying
4. Redeploy on Vercel; log in to the existing app and open **Meta Business Suite** > **Refresh Meta Data**.

## Meta setup
Create a Meta developer app with Marketing API access, associate it with the business and assets, and issue a properly permissioned token. Ads reporting commonly requires `ads_read`; Facebook lead retrieval requires `leads_retrieval` and access to the Page/forms (often `pages_show_list` and `pages_read_engagement` depending on flow). Business verification, app review, and advanced access may be required for production. Assign the system user to the ad account and Page.

## Safeguards / limitations
- This is a **read-only** integration. It does not change existing Supabase tables, CRM leads, campaign records, or publishing workflows.
- The token remains server-side. The server checks Supabase login and an email allowlist.
- Meta results are live and are not written to Supabase. Lead form data contains personal information; only authorize appropriate staff.
- First 100 campaigns and first 100 insight rows are shown. Up to 20 forms and first 100 leads per form are fetched. Pagination is **not** fully implemented; counts can be incomplete.
- This is not a full Meta Business Suite replacement. Messaging, publishing, webhook ingestion, token renewal, and CRM deduplication are not implemented.
- For larger volumes, add pagination, rate-limit handling, and a separate opt-in lead import flow with deduplication and privacy controls.
- Existing app stores business records in one `app_data` JSON blob per user, not normalized tables; do not auto-merge Meta leads into it without a migration design.
- The public Supabase anon key in `index.html` is not a secret, but never publish a service-role key. Review RLS policies.
