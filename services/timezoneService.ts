export interface TimezoneInfo {
  timezone: string;
  abbreviation: string;
  offset: string;
}

export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    console.error('Failed to detect timezone:', error);
    return 'UTC';
  }
}

export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || 'UTC';
  } catch (error) {
    console.error('Failed to get timezone abbreviation:', error);
    return 'UTC';
  }
}

export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });

    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || '+00:00';
  } catch (error) {
    console.error('Failed to get timezone offset:', error);
    return '+00:00';
  }
}

export function getTimezoneInfo(timezone: string, date: Date = new Date()): TimezoneInfo {
  return {
    timezone,
    abbreviation: getTimezoneAbbreviation(timezone, date),
    offset: getTimezoneOffset(timezone, date),
  };
}

export function convertToTimezone(date: Date | string, timezone: string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const values: Record<string, string> = {};

  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return new Date(
    `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
  );
}

export function formatDateTimeInTimezone(
  date: Date | string,
  timezone: string,
  includeSeconds = false
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  if (includeSeconds) {
    options.second = '2-digit';
  }

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const formattedDate = formatter.format(dateObj);
  const abbreviation = getTimezoneAbbreviation(timezone, dateObj);

  return `${formattedDate} ${abbreviation}`;
}

export function formatTimeInTimezone(
  date: Date | string,
  timezone: string,
  includeSeconds = false
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  if (includeSeconds) {
    options.second = '2-digit';
  }

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const formattedTime = formatter.format(dateObj);
  const abbreviation = getTimezoneAbbreviation(timezone, dateObj);

  return `${formattedTime} ${abbreviation}`;
}

export function createDateTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const combined = `${dateStr}T${timeStr}`;
  const localDate = new Date(combined);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(localDate);
  const values: Record<string, string> = {};

  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  const utcDate = new Date(
    `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}Z`
  );

  return utcDate;
}

export function dateToLocalInputValue(date: Date | string, timezone: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const values: Record<string, string> = {};

  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function getTimeRemaining(endDate: Date | string): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const total = end.getTime() - new Date().getTime();

  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { total, days, hours, minutes, seconds };
}

export function formatDuration(hours: number): string {
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  return `${days} day${days === 1 ? '' : 's'} ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
}
