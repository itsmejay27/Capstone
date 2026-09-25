-- Plans now target an audience; students get their own Free and Plus plans.
alter table subscription_plans add column if not exists audience text not null default 'instructor'
  check (audience in ('instructor','student'));

insert into subscription_plans (id, name, description, price_centavos, currency, interval, features, max_classrooms, max_exams_per_month, sort_order, is_active, audience)
values
 ('student_free', 'Student Free', 'Everything you need to join classes and take exams.', 0, 'PHP', 'month',
  '["Join any number of classes","Take quizzes and exams","See grades and feedback","Study Hub: flashcards and practice"]'::jsonb,
  null, null, 10, true, 'student'),
 ('student_plus', 'Student Plus', 'More AI study help for exam season.', 4900, 'PHP', 'month',
  '["Everything in Student Free","AI summaries and concept maps from your materials","Unlimited AI flashcard decks and practice sets","Study planner and progress tracking","Reviewer generator"]'::jsonb,
  null, null, 11, true, 'student')
on conflict (id) do update set name = excluded.name, description = excluded.description, price_centavos = excluded.price_centavos,
  features = excluded.features, sort_order = excluded.sort_order, is_active = true, audience = excluded.audience;
