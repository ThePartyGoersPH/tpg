require('dotenv').config();
const pool = require('./config/database');

async function insertEvents() {
  try {
    console.log('Inserting events for Juan Bar...');

    const events = [
      {
        title: 'DJ Night: Electric Beats',
        description: 'Get ready for an unforgettable night with DJ Pulse spinning the hottest tracks! Dance the night away with amazing beats, special drink promos, and an electric atmosphere.',
        event_date: '2026-03-28',
        start_time: '21:00:00',
        end_time: '02:00:00',
        max_capacity: 150
      },
      {
        title: 'Ladies Night Special',
        description: 'Ladies drink FREE all night! Enjoy complimentary cocktails, live music, and a vibrant party atmosphere. Bring your squad for an amazing night out!',
        event_date: '2026-03-29',
        start_time: '20:00:00',
        end_time: '01:00:00',
        max_capacity: 120
      },
      {
        title: 'Live Band: The Groove Masters',
        description: 'Experience live music at its finest! The Groove Masters will be performing your favorite rock, pop, and OPM hits. Great music, great vibes, great times!',
        event_date: '2026-04-02',
        start_time: '20:30:00',
        end_time: '23:30:00',
        max_capacity: 100
      },
      {
        title: 'Karaoke Championship Night',
        description: 'Show off your singing skills and compete for amazing prizes! Open mic karaoke with cash prizes for the top 3 performers. Free entry, unlimited fun!',
        event_date: '2026-04-05',
        start_time: '19:00:00',
        end_time: '23:00:00',
        max_capacity: 80
      },
      {
        title: 'Weekend Party Blast',
        description: 'Kick off the weekend with our biggest party of the month! Special drink buckets, party games, giveaways, and non-stop entertainment. Dress to impress!',
        event_date: '2026-04-12',
        start_time: '21:00:00',
        end_time: '03:00:00',
        max_capacity: 200
      },
      {
        title: 'Chill Acoustic Session',
        description: 'Unwind with soothing acoustic performances by local artists. Perfect for a relaxed evening with friends. Enjoy craft cocktails and good music in a cozy atmosphere.',
        event_date: '2026-04-15',
        start_time: '19:00:00',
        end_time: '22:00:00',
        max_capacity: 60
      }
    ];

    for (const event of events) {
      const [result] = await pool.query(
        `INSERT INTO bar_events (bar_id, title, description, event_date, start_time, end_time, max_capacity, status, created_at, updated_at)
         VALUES (11, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [event.title, event.description, event.event_date, event.start_time, event.end_time, event.max_capacity]
      );
      console.log(`✓ Inserted: ${event.title} (ID: ${result.insertId})`);
    }

    console.log('\n✅ All events inserted successfully!');
    
    const [allEvents] = await pool.query(
      `SELECT id, title, event_date, start_time, end_time FROM bar_events WHERE bar_id = 11 ORDER BY event_date ASC`
    );
    
    console.log('\n📅 Juan Bar Events:');
    allEvents.forEach(e => {
      console.log(`  - ${e.title} on ${e.event_date} at ${e.start_time}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting events:', error);
    process.exit(1);
  }
}

insertEvents();
