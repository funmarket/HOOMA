export function normalizeGamerGameName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function slugifyGamerGameName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
