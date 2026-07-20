export function addUtcDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function makeDaily({ fromDate = '2025-07-21', days = 365, countForIndex = () => 1 } = {}) {
  return Array.from({ length: days }, (_, index) => ({
    date: addUtcDays(fromDate, index),
    contributionCount: countForIndex(index),
  }));
}

export function makeContributionPayload({ fromDate, toDate, countForDate = () => 1 }) {
  const days = [];
  for (let date = fromDate; date <= toDate; date = addUtcDays(date, 1)) {
    days.push({ date, contributionCount: countForDate(date) });
  }

  return {
    data: {
      viewer: { login: 'github-actions[bot]' },
      user: {
        contributionsCollection: {
          hasAnyRestrictedContributions: true,
          restrictedContributionsCount: days.length,
          contributionCalendar: {
            totalContributions: days.reduce((sum, day) => sum + day.contributionCount, 0),
            weeks: [{ contributionDays: days }],
          },
        },
      },
      rateLimit: { cost: 1 },
    },
  };
}

export function makeCollectorResults({
  fromDate = '2025-07-21',
  days = 365,
  countForIndex = (index) => index % 8,
} = {}) {
  const daily = makeDaily({ fromDate, days, countForIndex });
  return {
    contributions: {
      daily,
      totalContributions: daily.reduce((sum, day) => sum + day.contributionCount, 0),
      hasAnyRestrictedContributions: true,
      restrictedContributionsCount: 17,
    },
    totalStars: 1645,
    authoredPullRequests: 1196,
    authoredIssues: 39,
  };
}
