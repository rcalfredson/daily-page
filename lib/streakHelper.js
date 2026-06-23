const STREAK_PING_DATE_KEY = 'streakPingLocalDate';

// top-level variable to hold the local date we last pinged
let streakPingDate = typeof localStorage === 'undefined'
  ? null
  : localStorage.getItem(STREAK_PING_DATE_KEY) || null;

export function localCalendarDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// Utility to check if “today” is the same day we last sent a ping
export function alreadyPingedToday() {
  if (!streakPingDate) return false;
  return streakPingDate === localCalendarDateKey();
}

// Utility to store “today” so we won't send again
export function markPingSentForToday() {
  const today = localCalendarDateKey();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STREAK_PING_DATE_KEY, today);
  }
  streakPingDate = today;
}

export function streakPing() {
  if (typeof userId === 'undefined' || !userId) return;

  fetch(`/api/v1/users/${userId}/streakPing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeZone: browserTimeZone() })
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
