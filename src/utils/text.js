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
  if (quoted.length >= 2) return { familleNom: quoted[0], display: quoted.join(' ') };
  if (quoted.length === 1) return { familleNom: '', display: quoted[0] };
  const trimmed = str.trim();
  const parts = trimmed.split(/\s+/);
  return { familleNom: parts.length > 1 ? parts[0] : '', display: trimmed };
}

export function formatNomDefunt(str) {
  return parseNomDefunt(str ?? '').display;
}

// Build the nomDefunt string from separate nom/prenom fields.
// Both filled  → "NOM" "PRÉNOM"  (parsed as familleNom=NOM)
// One filled   → plain text (no quotes)
export function buildNomDefunt(nom, prenom) {
  const n = (nom ?? '').trim();
  const p = (prenom ?? '').trim();
  if (n && p) return `"${n}" "${p}"`;
  // Prenom only: wrap in quotes so parseNomDefunt treats it as prenom (familleNom='')
  // even when prenom contains spaces like "El Bachir"
  if (p) return `"${p}"`;
  return n;
}

// Split a stored nomDefunt string back into { nom, prenom } for editing.
export function splitNomDefunt(str) {
  if (!str) return { nom: '', prenom: '' };
  const regex = /"([^"]+)"/g;
  const quoted = [];
  let m;
  while ((m = regex.exec(str)) !== null) quoted.push(m[1].trim());
  if (quoted.length >= 2) return { nom: quoted[0], prenom: quoted.slice(1).join(' ') };
  if (quoted.length === 1) return { nom: '', prenom: quoted[0] };
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 2) return { nom: parts[0], prenom: parts.slice(1).join(' ') };
  return { nom: '', prenom: str.trim() };
}
