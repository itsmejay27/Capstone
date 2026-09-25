-- NVIDIA was removed from the app; plan features now name Google Gemini only.
update subscription_plans
set features = (
  select jsonb_agg(case
    when f = 'Gemini engine only' then to_jsonb('Google Gemini AI'::text)
    when f = 'All AI engines, including NVIDIA' then to_jsonb('All Google Gemini models'::text)
    else to_jsonb(f) end order by ord)
  from jsonb_array_elements_text(features) with ordinality as t(f, ord)
)
where features::text ilike '%nvidia%' or features::text ilike '%Gemini engine only%';
