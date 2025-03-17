// top-level variable to hold the date we last pinged
let streakPingDate = localStorage.getItem('streakPingDate') || null;

// Utility to check if “today” is the same day we last sent a ping
export function alreadyPingedToday() {
  if (!streakPingDate) return false;
  // Compare the stored date to today’s date (UTC)
  const todayUTC = new Date().toISOString().slice(0, 10); // e.g. "2025-03-15"
  return streakPingDate === todayUTC;
}

// Utility to store “today” so we won't send again
export function markPingSentForToday() {
  const todayUTC = new Date().toISOString().slice(0, 10);
  localStorage.setItem('streakPingDate', todayUTC);
  streakPingDate = todayUTC;
}

export function streakPing() {
  if (!userId) return;

  fetch(`/api/v1/users/${userId}/streakPing`, {
    method: 'POST'
  })
    .then(res => {
      if (!res.ok) throw new Error('Streak update failed');
      return res.json();
    })
    .then(data => {
      markPingSentForToday(); // So we won't do it again today
    })
    .catch(err => console.error('Error calling streak endpoint:', err));
}