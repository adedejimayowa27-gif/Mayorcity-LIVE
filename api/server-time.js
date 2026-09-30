// Vercel Function: returns the server's current time in milliseconds.
//
// Phones and laptops often have slightly wrong clocks. The match clock and
// goal alerts use this so the host and every viewer agree on the time
// (see src/utils/serverTime.js), instead of trusting each device's own clock.

export function GET() {
  return new Response(JSON.stringify({ now: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
