-- Add exciting events for Juan Bar (bar_id = 11)
-- Run this SQL script to populate events for the bar

-- Event 1: Live DJ Night
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'DJ Night: Electric Beats',
  'Get ready for an unforgettable night with DJ Pulse spinning the hottest tracks! Dance the night away with amazing beats, special drink promos, and an electric atmosphere.',
  '2026-03-28',
  '21:00:00',
  '02:00:00',
  150,
  'active',
  NOW(),
  NOW()
);

-- Event 2: Ladies Night
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'Ladies Night Special',
  'Ladies drink FREE all night! Enjoy complimentary cocktails, live music, and a vibrant party atmosphere. Bring your squad for an amazing night out!',
  '2026-03-29',
  '20:00:00',
  '01:00:00',
  120,
  'active',
  NOW(),
  NOW()
);

-- Event 3: Live Band Performance
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'Live Band: The Groove Masters',
  'Experience live music at its finest! The Groove Masters will be performing your favorite rock, pop, and OPM hits. Great music, great vibes, great times!',
  '2026-04-02',
  '20:30:00',
  '23:30:00',
  100,
  'active',
  NOW(),
  NOW()
);

-- Event 4: Karaoke Championship
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'Karaoke Championship Night',
  'Show off your singing skills and compete for amazing prizes! Open mic karaoke with cash prizes for the top 3 performers. Free entry, unlimited fun!',
  '2026-04-05',
  '19:00:00',
  '23:00:00',
  80,
  'active',
  NOW(),
  NOW()
);

-- Event 5: Weekend Party Blast
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'Weekend Party Blast',
  'Kick off the weekend with our biggest party of the month! Special drink buckets, party games, giveaways, and non-stop entertainment. Dress to impress!',
  '2026-04-12',
  '21:00:00',
  '03:00:00',
  200,
  'active',
  NOW(),
  NOW()
);

-- Event 6: Acoustic Session
INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
VALUES (
  11,
  'Chill Acoustic Session',
  'Unwind with soothing acoustic performances by local artists. Perfect for a relaxed evening with friends. Enjoy craft cocktails and good music in a cozy atmosphere.',
  '2026-04-15',
  '19:00:00',
  '22:00:00',
  60,
  'active',
  NOW(),
  NOW()
);

-- Check the inserted events
SELECT id, title, event_date, start_time, end_time, description 
FROM bar_events 
WHERE bar_id = 11 
ORDER BY event_date ASC;
