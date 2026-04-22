import { knownCompanyDomains, knownCompanyTickers } from '../constants';

export function compactUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function cleanCompanyName(company: string): string {
  return company
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(
      /\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co|services|service|holdings|group|usa|us|the)\b/g,
      ' '
    )
    .replace(/[^a-z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function companyInitials(company: string): string {
  const words = company
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]).join('').toUpperCase() || 'W';
}

export function guessCompanyDomain(company: string): string {
  const cleaned = cleanCompanyName(company);

  const matchedKey = Object.keys(knownCompanyDomains).find((key) =>
    cleaned.includes(key)
  );
  if (matchedKey) return knownCompanyDomains[matchedKey];

  const domainLike = cleaned.split(' ').find((part) => part.includes('.') && part.length > 3);
  const domain = domainLike ?? `${cleaned.split(' ')[0]}.com`;
  return domain && domain !== '.com' ? domain : '';
}

export function guessCompanyTicker(company: string): string {
  const cleaned = cleanCompanyName(company);
  const matchedKey = Object.keys(knownCompanyTickers).find((key) =>
    cleaned.includes(key)
  );
  return matchedKey ? knownCompanyTickers[matchedKey] : '';
}

export function getLogoSources(company: string): string[] {
  const domain = guessCompanyDomain(company);
  if (!domain) return [];

  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://unavatar.io/${domain}`,
  ];
}
