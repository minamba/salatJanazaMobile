export function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Quoted groups ("EL KAFFE" "KHADIJA") mark compound names.
// Returns { familleNom, display } — quotes never appear in output.
export function parseNomDefunt(str) {
  if (!str) return { familleNom: '', display: '' };
  const regex = /"([^"]+)"/g;
  const quoted = [];
  let m;
  while ((m = regex.exec(str)) !== null) quoted.push(m[1].trim());
  if (quoted.length >= 1) return { familleNom: quoted[0], display: quoted.join(' ') };
  const trimmed = str.trim();
  return { familleNom: trimmed.split(/\s+/)[0] ?? '', display: trimmed };
}

export function formatNomDefunt(str) {
  return parseNomDefunt(str ?? '').display;
}
